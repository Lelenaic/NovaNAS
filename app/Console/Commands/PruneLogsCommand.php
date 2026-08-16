<?php

namespace App\Console\Commands;

use App\Models\Setting;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Symfony\Component\Finder\Finder;

/**
 * Prunes old log lines from every file in the logs directory.
 *
 * Log entries always start with a timestamp. We keep the file contents from the
 * first line whose timestamp is newer than the retention cutoff; everything
 * before that line (including multi-line stack traces) is deleted. Both the
 * bracketed Laravel format ("[2026-08-15 16:39:05]") and the space-indented
 * queue worker format ("  2026-08-15 16:39:05 ...") are supported.
 *
 * Files are streamed line-by-line so very large logs never need to be loaded
 * fully into memory, and only the (small, recent) tail is rewritten.
 */
class PruneLogsCommand extends Command
{
    protected $signature = 'logs:prune
        {--days= : Override the configured retention in days}
        {--dry-run : Report what would be deleted without modifying any files}';

    protected $description = 'Delete log lines older than the configured retention period';

    private const SETTING_KEY = 'logs.auto_delete_days';

    public function handle(): int
    {
        $days = $this->option('days')
            ? (int) $this->option('days')
            : (int) Setting::getValue(self::SETTING_KEY);

        $cutoff = now()->subDays($days);
        $dryRun = (bool) $this->option('dry-run');

        $this->info("Pruning log lines older than {$cutoff->toDateTimeString()} (retention: {$days} days)"
            .($dryRun ? ' [dry-run]' : ''));

        $finder = (new Finder)
            ->files()
            ->in(storage_path('logs'))
            ->ignoreDotFiles(true)
            ->followLinks();

        $totalBytes = 0;
        $totalLines = 0;
        $filesPruned = 0;

        foreach ($finder as $file) {
            $path = $file->getPathname();

            if (! is_writable($path)) {
                $this->warn("Skipping non-writable file: {$path}");

                continue;
            }

            $result = $this->pruneFile($path, $cutoff, $dryRun);

            if ($result['bytes'] > 0) {
                $filesPruned++;
                $totalBytes += $result['bytes'];
                $totalLines += $result['lines'];

                $this->line(sprintf(
                    '  %s: removed %d lines (%s)',
                    $path,
                    $result['lines'],
                    $this->humanSize($result['bytes'])
                ));
            }
        }

        $this->info(sprintf(
            'Done. %d file(s) pruned, %d lines removed, %s freed%s.',
            $filesPruned,
            $totalLines,
            $this->humanSize($totalBytes),
            $dryRun ? ' (dry-run, nothing changed)' : ''
        ));

        return self::SUCCESS;
    }

    /**
     * Prune a single log file, keeping from the first line newer than the cutoff.
     *
     * @return array{bytes: int, lines: int}
     */
    protected function pruneFile(string $path, Carbon $cutoff, bool $dryRun): array
    {
        $handle = fopen($path, 'r');

        if ($handle === false) {
            return ['bytes' => 0, 'lines' => 0];
        }

        $offset = null;
        $hasTimestamp = false;
        $pattern = '/^\s*\[?(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]?/';

        while (($line = fgets($handle)) !== false) {
            $lineStart = ftell($handle) - strlen($line);

            if (preg_match($pattern, $line, $matches)) {
                $hasTimestamp = true;
                $timestamp = Carbon::createFromFormat('Y-m-d H:i:s', $matches[1]);

                if ($timestamp && $timestamp->greaterThanOrEqualTo($cutoff)) {
                    $offset = $lineStart;

                    break;
                }
            }
        }

        fclose($handle);

        // No line newer than the cutoff was found.
        if ($offset === null) {
            if (! $hasTimestamp) {
                // Cannot determine age from this file; leave it untouched.
                return ['bytes' => 0, 'lines' => 0];
            }

            // Every line is older than the cutoff: the whole file is obsolete.
            $oldBytes = filesize($path);
            $oldLines = $this->countNewlines($path, $oldBytes);

            if (! $dryRun && $oldBytes > 0) {
                file_put_contents($path, '');
            }

            return ['bytes' => $dryRun ? $oldBytes : $oldBytes, 'lines' => $oldLines];
        }

        if ($offset === 0) {
            // Nothing to delete.
            return ['bytes' => 0, 'lines' => 0];
        }

        $oldBytes = $offset;
        $oldLines = $this->countNewlines($path, $offset);

        if (! $dryRun) {
            $source = fopen($path, 'r');

            if ($source === false) {
                return ['bytes' => 0, 'lines' => 0];
            }

            fseek($source, $offset);
            $tail = stream_get_contents($source);
            fclose($source);

            file_put_contents($path, $tail);
        }

        return ['bytes' => $oldBytes, 'lines' => $oldLines];
    }

    /**
     * Count newline characters within the first $length bytes of a file.
     */
    protected function countNewlines(string $path, int $length): int
    {
        if ($length <= 0) {
            return 0;
        }

        $handle = fopen($path, 'r');

        if ($handle === false) {
            return 0;
        }

        $count = 0;
        $remaining = $length;
        $chunkSize = 65536;

        while ($remaining > 0 && ! feof($handle)) {
            $chunk = fread($handle, min($chunkSize, $remaining));

            if ($chunk === false) {
                break;
            }

            $remaining -= strlen($chunk);
            $count += substr_count($chunk, "\n");
        }

        fclose($handle);

        return $count;
    }

    protected function humanSize(int $bytes): string
    {
        if ($bytes < 1024) {
            return $bytes.' B';
        }

        if ($bytes < 1024 * 1024) {
            return round($bytes / 1024, 1).' KB';
        }

        return round($bytes / (1024 * 1024), 1).' MB';
    }
}
