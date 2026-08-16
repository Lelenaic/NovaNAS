<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Process;

/**
 * Controller for viewing and searching log files.
 *
 * Reads are performed with efficient shell utilities (tail/head/grep) so that
 * very large log files never need to be loaded fully into memory. Line windows
 * are anchored from the end of the file to support incremental "load older" and
 * the default "show the last N lines" behaviour.
 */
class LogViewerController extends Controller
{
    /**
     * List all log files with their size and modification time.
     */
    public function files(): JsonResponse
    {
        $directory = $this->logsDirectory();

        $files = [];

        foreach ($this->logFiles($directory) as $path) {
            $relative = ltrim(substr($path, strlen($directory)), DIRECTORY_SEPARATOR);

            $files[] = [
                'name' => $relative,
                'size' => filesize($path),
                'lines' => $this->countLines($path),
                'mtime' => filemtime($path),
            ];
        }

        // Put the primary application log first, then sort alphabetically.
        usort($files, function (array $a, array $b): int {
            if ($a['name'] === 'laravel.log') {
                return -1;
            }

            if ($b['name'] === 'laravel.log') {
                return 1;
            }

            return $a['name'] <=> $b['name'];
        });

        return response()->json(['files' => $files]);
    }

    /**
     * Count the number of lines in a file efficiently using wc.
     */
    protected function countLines(string $path): int
    {
        $result = Process::run(['wc', '-l', $path]);

        if ($result->failed()) {
            return 0;
        }

        $output = trim($result->output());
        $parts = preg_split('/\s+/', $output);

        return isset($parts[0]) ? (int) $parts[0] : 0;
    }

    /**
     * Return a window of lines from the end of a log file.
     *
     * `skip_from_end` is the number of trailing lines already displayed; the
     * returned chunk is the next `take` lines that are older than those.
     */
    public function view(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => 'required|string',
            'take' => 'sometimes|integer|min:1|max:1000',
            'skip_from_end' => 'sometimes|integer|min:0|max:10000000',
        ]);

        $file = $validated['file'];
        $take = (int) ($validated['take'] ?? 100);
        $skip = (int) ($validated['skip_from_end'] ?? 0);

        $path = $this->resolveFile($file);

        if ($path === null) {
            return response()->json(['message' => 'Log file not found.'], 404);
        }

        $size = filesize($path);
        $total = $skip + $take;

        $tail = Process::run(['tail', '-n', (string) $total, $path]);

        if ($tail->failed()) {
            return response()->json(['message' => 'Unable to read log file.'], 500);
        }

        $tailOutput = $tail->output();
        $lenTotal = strlen($tailOutput);

        $lines = explode("\n", rtrim($tailOutput, "\n"));
        // For skip=0 this is the last $take lines; for skip>0 it is the oldest
        // $take lines of the trailing window (i.e. the next older chunk).
        $lines = array_slice($lines, 0, $take);

        if ($lines === [''] && $lenTotal === 0) {
            $lines = [];
        }

        $startOffset = $size - $lenTotal;

        return response()->json([
            'file' => $file,
            'lines' => $lines,
            'loaded_from_end' => $skip + count($lines),
            'has_more' => $startOffset > 0,
            'size' => $size,
        ]);
    }

    /**
     * Search across all log files.
     *
     * Uses grep in extended-regex mode for efficient streaming search. Results
     * are capped to avoid exhausting memory on very large files.
     */
    public function search(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'query' => 'required|string|min:1|max:255',
            'limit' => 'sometimes|integer|min:1|max:20000',
            'file' => 'sometimes|string',
        ]);

        $query = $validated['query'];
        $limit = (int) ($validated['limit'] ?? 5000);

        if (! empty($validated['file'])) {
            $target = $this->resolveFile($validated['file']);

            if ($target === null) {
                return response()->json(['message' => 'Log file not found.'], 404);
            }

            $files = [$target];
        } else {
            $files = $this->logFiles($this->logsDirectory());
        }

        if ($files === []) {
            return response()->json(['matches' => [], 'count' => 0]);
        }

        // Always case-insensitive for a simpler, more forgiving search.
        $args = ['grep', '-n', '-E', '-i'];

        $args[] = '-m';
        $args[] = (string) $limit;
        $args[] = '--';
        $args[] = $query;

        foreach ($files as $file) {
            $args[] = $file;
        }

        $process = Process::timeout(120)->run($args);

        $exitCode = $process->exitCode();

        // grep exits 1 when there are no matches (not a failure).
        if ($exitCode === 1) {
            return response()->json([
                'matches' => [],
                'count' => 0,
                'limit' => $limit,
                'truncated' => false,
            ]);
        }

        // grep exits 2 on a bad pattern or other error.
        if ($exitCode !== 0) {
            $error = trim($process->errorOutput());

            if (str_contains(strtolower($error), 'invalid')
                || str_contains(strtolower($error), 'regex')
                || str_contains(strtolower($error), 'pattern')
            ) {
                return response()->json([
                    'message' => 'Invalid search pattern. Use a valid regular expression.',
                ], 422);
            }

            return response()->json([
                'message' => 'Search failed: '.$error,
            ], 500);
        }

        $directory = $this->logsDirectory();
        $matches = [];
        $raw = rtrim($process->output(), "\n");

        if ($raw !== '') {
            foreach (explode("\n", $raw) as $line) {
                $firstColon = strpos($line, ':');

                if ($firstColon === false) {
                    continue;
                }

                $filePart = substr($line, 0, $firstColon);
                $rest = substr($line, $firstColon + 1);
                $secondColon = strpos($rest, ':');

                if ($secondColon === false) {
                    $lineNo = 0;
                    $content = $rest;
                } else {
                    $lineNo = (int) substr($rest, 0, $secondColon);
                    $content = substr($rest, $secondColon + 1);
                }

                $relative = ltrim(substr($filePart, strlen($directory)), DIRECTORY_SEPARATOR);

                $matches[] = [
                    'file' => $relative,
                    'line' => $lineNo,
                    'content' => $content,
                ];
            }
        }

        return response()->json([
            'matches' => $matches,
            'count' => count($matches),
            'limit' => $limit,
            'truncated' => count($matches) >= $limit,
        ]);
    }

    /**
     * Resolve a user supplied relative file name to a real, readable path
     * inside the logs directory (preventing path traversal).
     */
    protected function resolveFile(string $file): ?string
    {
        $directory = realpath($this->logsDirectory());

        if ($directory === false) {
            return null;
        }

        $target = realpath($directory.DIRECTORY_SEPARATOR.$file);

        if ($target === false
            || strncmp($target, $directory, strlen($directory)) !== 0
            || ! is_file($target)
            || ! is_readable($target)
        ) {
            return null;
        }

        return $target;
    }

    /**
     * Get all regular, non-hidden files inside the logs directory (recursively).
     *
     * @return array<int, string>
     */
    protected function logFiles(string $directory): array
    {
        if (! is_dir($directory)) {
            return [];
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS)
        );

        $files = [];

        foreach ($iterator as $file) {
            if ($file->isFile() && $file->getFilename()[0] !== '.') {
                $files[] = $file->getPathname();
            }
        }

        return $files;
    }

    protected function logsDirectory(): string
    {
        return storage_path('logs');
    }
}
