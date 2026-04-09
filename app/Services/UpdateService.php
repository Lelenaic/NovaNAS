<?php

namespace App\Services;

use App\Models\Setting;
use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

/**
 * System Update Service
 *
 * Handles apt package management operations including updates, upgrades,
 * and tracking update status.
 */
class UpdateService
{
    /**
     * Setting key for storing last update timestamp.
     */
    protected const LAST_UPDATE_KEY = 'system.last_apt_update';

    /**
     * Start a full system upgrade in the background and return a job ID for tracking.
     * Uses non-interactive flags to avoid prompts.
     *
     * @return array{success: bool, message: string, job_id?: string, error?: string}
     */
    public function startUpgrade(): array
    {
        $jobId = 'upgrade_'.time().'_'.uniqid();
        $outputFile = storage_path('logs/upgrade_'.$jobId.'.log');
        $pidFile = storage_path('logs/upgrade_'.$jobId.'.pid');

        try {
            // Create the output directory if it doesn't exist
            $logDir = dirname($outputFile);
            if (! is_dir($logDir)) {
                mkdir($logDir, 0755, true);
            }

            // Write initial status
            file_put_contents($outputFile, 'Starting system upgrade at '.now()->format('Y-m-d H:i:s')."\n");

            // Start the upgrade process in background using nohup
            $command = 'sudo DEBIAN_FRONTEND=noninteractive apt full-upgrade --assume-yes -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"';

            // Execute in background and redirect output
            $fullCommand = "nohup {$command} >> ".escapeshellarg($outputFile).' 2>&1 & echo $! > '.escapeshellarg($pidFile);
            exec($fullCommand);

            // Store job info in cache for tracking
            \Illuminate\Support\Facades\Cache::put("upgrade_job_{$jobId}", [
                'output_file' => $outputFile,
                'pid_file' => $pidFile,
                'started_at' => now(),
            ], 3600); // 1 hour cache

            return [
                'success' => true,
                'message' => 'System upgrade started',
                'job_id' => $jobId,
            ];
        } catch (\Exception $e) {
            if (file_exists($outputFile)) {
                file_put_contents($outputFile, 'Error: '.$e->getMessage()."\n", FILE_APPEND);
            }

            return [
                'success' => false,
                'message' => 'Failed to start system upgrade',
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get the status and output of a running upgrade job.
     *
     * @return array{running: bool, output: string, completed: bool, success?: bool, error?: string}
     */
    public function getUpgradeStatus(string $jobId): array
    {
        $cacheKey = "upgrade_job_{$jobId}";
        $jobData = \Illuminate\Support\Facades\Cache::get($cacheKey);

        if (! $jobData) {
            return [
                'running' => false,
                'output' => 'Job not found or expired',
                'completed' => true,
            ];
        }

        $outputFile = $jobData['output_file'];
        $pidFile = $jobData['pid_file'];
        $output = '';

        if (file_exists($outputFile)) {
            $output = file_get_contents($outputFile);
        }

        // Check if process is still running by checking PID
        $running = false;
        if (file_exists($pidFile)) {
            $pid = trim(file_get_contents($pidFile));
            if (is_numeric($pid)) {
                // Check if process exists
                $running = posix_kill($pid, 0);
            }
        }

        if ($running) {
            return [
                'running' => true,
                'output' => $output,
                'completed' => false,
            ];
        }

        // Process completed - clean up and check result
        \Illuminate\Support\Facades\Cache::forget($cacheKey);

        // Check if upgrade was successful
        // Look for success indicators rather than just absence of errors
        $hasErrors = preg_match('/(E:\s|Errno|apt.*failed|dpkg.*error|Errors were encountered|error.*exit|failed.*exit)/i', $output);
        $hasSuccessIndicators = preg_match('/(Setting up|Processing triggers|upgrade completed|packages upgraded)/i', $output);

        // Consider successful if no clear errors and has success indicators
        $success = ! $hasErrors && $hasSuccessIndicators;

        $completionMessage = $success
            ? 'System upgrade completed successfully at '.now()->format('Y-m-d H:i:s')."\n"
            : 'System upgrade failed at '.now()->format('Y-m-d H:i:s')."\n";

        file_put_contents($outputFile, $completionMessage, FILE_APPEND);

        if ($success) {
            // Update the last update timestamp
            Setting::setValue(self::LAST_UPDATE_KEY, now()->toISOString());
        }

        // Clean up files
        @unlink($pidFile);

        return [
            'running' => false,
            'output' => file_get_contents($outputFile),
            'completed' => true,
            'success' => $success,
            'error' => $success ? null : 'Upgrade process failed - check output for details',
        ];
    }

    /**
     * Synchronously check for available updates and update badge count (for cron jobs).
     *
     * @return array{success: bool, message: string, output?: string, error?: string}
     */
    public function checkForUpdates(): array
    {
        try {
            $process = new Process([
                'sudo', 'apt', 'update',
            ]);

            $process->setTimeout(300); // 5 minutes timeout
            $process->run();

            if ($process->isSuccessful()) {
                // Update the last update timestamp
                Setting::setValue(self::LAST_UPDATE_KEY, now()->toISOString());

                // Update badge count for updates app
                $status = $this->getUpdateStatus();
                $this->updateBadgeCount('updates', $status['count'] ?? 0);

                return [
                    'success' => true,
                    'message' => 'Package lists updated successfully',
                    'output' => $process->getOutput(),
                ];
            } else {
                return [
                    'success' => false,
                    'message' => 'Failed to update package lists',
                    'error' => $process->getErrorOutput(),
                ];
            }
        } catch (ProcessFailedException $e) {
            return [
                'success' => false,
                'message' => 'Failed to check for updates',
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Update badge count for an app (generic notification system).
     *
     * @param  string  $appIdentifier  The app identifier
     * @param  int  $count  The badge count (0 to clear)
     */
    public function updateBadgeCount(string $appIdentifier, int $count): void
    {
        // Store in database/cache for persistence
        $key = "app_badge_{$appIdentifier}";
        if ($count > 0) {
            \Illuminate\Support\Facades\Cache::put($key, $count, now()->addDays(7)); // 7 days expiry
        } else {
            \Illuminate\Support\Facades\Cache::forget($key);
        }
    }

    /**
     * Get badge count for an app.
     *
     * @param  string  $appIdentifier  The app identifier
     * @return int The badge count
     */
    public function getBadgeCount(string $appIdentifier): int
    {
        $key = "app_badge_{$appIdentifier}";

        return \Illuminate\Support\Facades\Cache::get($key, 0);
    }

    /**
     * Start checking for updates in the background with real-time logging.
     *
     * @return array{success: bool, message: string, job_id?: string, error?: string}
     */
    public function startCheckForUpdates(): array
    {
        $jobId = 'check_'.time().'_'.uniqid();
        $outputFile = storage_path('logs/check_'.$jobId.'.log');
        $pidFile = storage_path('logs/check_'.$jobId.'.pid');

        try {
            // Create the output directory if it doesn't exist
            $logDir = dirname($outputFile);
            if (! is_dir($logDir)) {
                mkdir($logDir, 0755, true);
            }

            // Write initial status
            file_put_contents($outputFile, 'Checking for available updates at '.now()->format('Y-m-d H:i:s')."\n");

            // Start the check process in background using nohup
            $command = 'sudo apt update';

            // Execute in background and redirect output
            $fullCommand = "nohup {$command} >> ".escapeshellarg($outputFile).' 2>&1 & echo $! > '.escapeshellarg($pidFile);
            exec($fullCommand);

            // Store job info in cache for tracking
            \Illuminate\Support\Facades\Cache::put("check_job_{$jobId}", [
                'output_file' => $outputFile,
                'pid_file' => $pidFile,
                'started_at' => now(),
            ], 3600); // 1 hour cache

            return [
                'success' => true,
                'message' => 'Update check started',
                'job_id' => $jobId,
            ];
        } catch (\Exception $e) {
            if (file_exists($outputFile)) {
                file_put_contents($outputFile, 'Error: '.$e->getMessage()."\n", FILE_APPEND);
            }

            return [
                'success' => false,
                'message' => 'Failed to start update check',
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get the status and output of a running update check job.
     *
     * @return array{running: bool, output: string, completed: bool, success?: bool, error?: string}
     */
    public function getCheckStatus(string $jobId): array
    {
        $cacheKey = "check_job_{$jobId}";
        $jobData = \Illuminate\Support\Facades\Cache::get($cacheKey);

        if (! $jobData) {
            return [
                'running' => false,
                'output' => 'Job not found or expired',
                'completed' => true,
            ];
        }

        $outputFile = $jobData['output_file'];
        $pidFile = $jobData['pid_file'];
        $output = '';

        if (file_exists($outputFile)) {
            $output = file_get_contents($outputFile);
        }

        // Check if process is still running by checking PID
        $running = false;
        if (file_exists($pidFile)) {
            $pid = trim(file_get_contents($pidFile));
            if (is_numeric($pid)) {
                // Check if process exists
                $running = posix_kill($pid, 0);
            }
        }

        if ($running) {
            return [
                'running' => true,
                'output' => $output,
                'completed' => false,
            ];
        }

        // Process completed - clean up and check result
        \Illuminate\Support\Facades\Cache::forget($cacheKey);

        // Check if check was successful by looking for error indicators
        $success = ! preg_match('/(E:\s|Errno|apt.*failed|dpkg.*error|Errors were encountered)/i', $output);

        $completionMessage = $success
            ? 'Update check completed successfully at '.now()->format('Y-m-d H:i:s')."\n"
            : 'Update check failed at '.now()->format('Y-m-d H:i:s')."\n";

        file_put_contents($outputFile, $completionMessage, FILE_APPEND);

        if ($success) {
            // Update the last update timestamp
            Setting::setValue(self::LAST_UPDATE_KEY, now()->toISOString());

            // Update badge count for updates app
            $status = $this->getUpdateStatus();
            $this->updateBadgeCount('updates', $status['count'] ?? 0);
        }

        // Clean up files
        @unlink($pidFile);

        return [
            'running' => false,
            'output' => file_get_contents($outputFile),
            'completed' => true,
            'success' => $success,
            'error' => $success ? null : 'Update check failed - check output for details',
        ];
    }

    /**
     * Get the timestamp of the last successful apt update.
     *
     * @return string|null ISO 8601 formatted datetime or null if never updated
     */
    public function getLastUpdateTime(): ?string
    {
        return Setting::getValue(self::LAST_UPDATE_KEY);
    }

    /**
     * Check if updates are available by comparing package counts.
     *
     * @return array{available: bool, count?: int, message: string}
     */
    public function getUpdateStatus(): array
    {
        try {
            // Check how many packages can be upgraded
            $process = new Process([
                'sudo', 'apt', 'list', '--upgradable',
            ]);

            $process->run();

            if ($process->isSuccessful()) {
                $output = $process->getOutput();
                $lines = explode("\n", trim($output));

                // Remove header line if present
                if (count($lines) > 0 && str_contains($lines[0], 'Listing...')) {
                    array_shift($lines);
                }

                $upgradableCount = count(array_filter($lines, function ($line) {
                    return ! empty(trim($line));
                }));

                return [
                    'available' => $upgradableCount > 0,
                    'count' => $upgradableCount,
                    'message' => $upgradableCount > 0
                        ? "{$upgradableCount} package(s) can be upgraded"
                        : 'System is up to date',
                ];
            } else {
                return [
                    'available' => false,
                    'message' => 'Unable to check update status',
                ];
            }
        } catch (ProcessFailedException $e) {
            return [
                'available' => false,
                'message' => 'Error checking update status: '.$e->getMessage(),
            ];
        }
    }

    /**
     * Get detailed information about available updates.
     *
     * @return array{packages: array<array{name: string, current_version: string, new_version: string}>, count: int}
     */
    public function getAvailableUpdates(): array
    {
        try {
            $process = new Process([
                'sudo', 'apt', 'list', '--upgradable',
            ]);

            $process->run();

            if ($process->isSuccessful()) {
                $output = $process->getOutput();
                $lines = explode("\n", trim($output));
                $packages = [];

                // Skip the header line
                foreach ($lines as $line) {
                    if (empty(trim($line)) || str_contains($line, 'Listing...')) {
                        continue;
                    }

                    // Parse line format: package/name/version arch [upgradable from: old-version]
                    // Example: packagekit/xenial-updates,xenial-security 1.1.5-2ubuntu1 amd64 [upgradable from: 1.1.5-2ubuntu1]
                    if (preg_match('/^([^\/\s]+)\/[^\s]+\s+([^\s]+)\s+.*\[upgradable from:\s*([^\]]+)\]/', $line, $matches)) {
                        $packages[] = [
                            'name' => $matches[1],
                            'current_version' => $matches[3],
                            'new_version' => $matches[2],
                        ];
                    }
                }

                return [
                    'packages' => $packages,
                    'count' => count($packages),
                ];
            }
        } catch (ProcessFailedException $e) {
            // Return empty array on error
        }

        return [
            'packages' => [],
            'count' => 0,
        ];
    }

    /**
     * Synchronously check for available updates (for cron jobs).
     *
     * @return array{success: bool, message: string, output?: string, error?: string}
     */
    public function cleanCache(): array
    {
        try {
            $process = new Process([
                'sudo', 'apt', 'autoclean',
            ]);

            $process->run();

            if ($process->isSuccessful()) {
                return [
                    'success' => true,
                    'message' => 'Package cache cleaned successfully',
                    'output' => $process->getOutput(),
                ];
            } else {
                return [
                    'success' => false,
                    'message' => 'Failed to clean package cache',
                    'error' => $process->getErrorOutput(),
                ];
            }
        } catch (ProcessFailedException $e) {
            return [
                'success' => false,
                'message' => 'Failed to clean package cache',
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Check if a system reboot is required after updates.
     *
     * @return bool True if reboot is required
     */
    public function isRebootRequired(): bool
    {
        return file_exists('/var/run/reboot-required');
    }

    /**
     * Get reboot required status with additional information.
     *
     * @return array{required: bool, packages?: array<string>}
     */
    public function getRebootStatus(): array
    {
        $required = $this->isRebootRequired();

        if (! $required) {
            return ['required' => false];
        }

        // Try to read the list of packages that require reboot
        $packages = [];
        if (file_exists('/var/run/reboot-required.pkgs')) {
            $content = file_get_contents('/var/run/reboot-required.pkgs');
            if ($content) {
                $packages = array_filter(explode("\n", trim($content)));
            }
        }

        return [
            'required' => true,
            'packages' => $packages,
        ];
    }
}
