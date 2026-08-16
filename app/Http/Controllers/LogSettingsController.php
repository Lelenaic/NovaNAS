<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;

/**
 * Controller for managing log auto-deletion settings.
 */
class LogSettingsController extends Controller
{
    public const SETTING_KEY = 'logs.auto_delete_days';

    /**
     * Get current log settings and log folder statistics.
     */
    public function index(): JsonResponse
    {
        $retentionDays = (int) Setting::getValue(self::SETTING_KEY);

        $stats = $this->getLogStats();

        return response()->json([
            'auto_delete_days' => $retentionDays,
            'total_size_bytes' => $stats['total_size_bytes'],
            'file_count' => $stats['file_count'],
        ]);
    }

    /**
     * Update the auto-deletion retention period.
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'auto_delete_days' => 'required|integer|min:1|max:3650',
        ]);

        Setting::setValue(self::SETTING_KEY, (string) $validated['auto_delete_days']);

        return response()->json([
            'message' => 'Log settings saved successfully.',
            'auto_delete_days' => (int) $validated['auto_delete_days'],
        ]);
    }

    /**
     * Trigger an immediate log pruning using the configured retention.
     */
    public function prune(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'dry_run' => 'sometimes|boolean',
        ]);

        $exitCode = Artisan::call('logs:prune', [
            '--dry-run' => (bool) ($validated['dry_run'] ?? false),
        ]);

        if ($exitCode !== 0) {
            return response()->json([
                'message' => 'Failed to prune logs: '.Artisan::output(),
            ], 500);
        }

        return response()->json([
            'message' => 'Log pruning completed.',
            'output' => Artisan::output(),
        ]);
    }

    /**
     * Collect statistics about the log folder.
     *
     * @return array{total_size_bytes: int, file_count: int}
     */
    protected function getLogStats(): array
    {
        $totalSize = 0;
        $fileCount = 0;

        foreach ($this->logFiles() as $path) {
            $totalSize += filesize($path);
            $fileCount++;
        }

        return [
            'total_size_bytes' => $totalSize,
            'file_count' => $fileCount,
        ];
    }

    /**
     * Get all regular files inside the log folder (recursively).
     *
     * @return iterable<string>
     */
    protected function logFiles(): iterable
    {
        $directory = storage_path('logs');

        if (! is_dir($directory)) {
            return;
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS)
        );

        foreach ($iterator as $file) {
            if ($file->isFile()) {
                yield $file->getPathname();
            }
        }
    }
}
