<?php

namespace App\Services;

use App\Jobs\SystemUpdateJob;
use App\Models\Setting;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
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
     * Perform a full system upgrade synchronously (for use in queued jobs).
     * Uses non-interactive flags to avoid prompts.
     *
     * @return array{success: bool, message: string, output?: string, error?: string}
     */
    public function performUpgrade(): array
    {
        try {
            $process = new Process([
                'sudo', 'DEBIAN_FRONTEND=noninteractive', 'apt', 'full-upgrade', '--assume-yes',
                '-o', 'Dpkg::Options::="--force-confdef"',
                '-o', 'Dpkg::Options::="--force-confold"',
            ]);

            $process->setTimeout(1800); // 30 minutes timeout
            $process->run();

            if ($process->isSuccessful()) {
                // Update the last update timestamp
                Setting::setValue(self::LAST_UPDATE_KEY, now()->toISOString());

                return [
                    'success' => true,
                    'message' => 'System upgrade completed successfully',
                    'output' => $process->getOutput(),
                ];
            } else {
                return [
                    'success' => false,
                    'message' => 'System upgrade failed',
                    'error' => $process->getErrorOutput(),
                    'output' => $process->getOutput(),
                ];
            }
        } catch (ProcessFailedException $e) {
            return [
                'success' => false,
                'message' => 'System upgrade failed',
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Start a full system upgrade using Laravel jobs and return a job ID for tracking.
     *
     * @return array{success: bool, message: string, job_id?: string, error?: string}
     */
    public function startUpgrade(): array
    {
        $jobId = 'upgrade_'.time().'_'.uniqid();

        try {
            $job = new SystemUpdateJob('upgrade', $jobId);
            Bus::dispatch($job);

            // Store job info in cache for tracking
            Cache::put("upgrade_job_{$jobId}", [
                'job_id' => $jobId,
                'started_at' => now(),
                'operation' => 'upgrade',
            ], 3600); // 1 hour cache

            return [
                'success' => true,
                'message' => 'System upgrade started',
                'job_id' => $jobId,
            ];
        } catch (\Exception $e) {
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
        $jobCacheKey = "upgrade_job_{$jobId}";
        $resultCacheKey = "job_result_{$jobId}";

        $jobData = Cache::get($jobCacheKey);

        if (! $jobData) {
            return [
                'running' => false,
                'output' => 'Job not found or expired',
                'completed' => true,
            ];
        }

        // Check if job result is available
        $result = Cache::get($resultCacheKey);

        if ($result) {
            // Job completed - clean up and return result
            Cache::forget($jobCacheKey);
            Cache::forget($resultCacheKey);

            $output = $result['success']
                ? 'System upgrade completed successfully at '.now()->format('Y-m-d H:i:s')."\n"
                : 'System upgrade failed at '.now()->format('Y-m-d H:i:s')."\n";

            if ($result['output']) {
                $output .= "\n".$result['output'];
            }

            return [
                'running' => false,
                'output' => $output,
                'completed' => true,
                'success' => $result['success'],
                'error' => $result['error'],
            ];
        }

        // Job still running
        return [
            'running' => true,
            'output' => 'System upgrade in progress...',
            'completed' => false,
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
            Cache::put($key, $count, now()->addDays(7)); // 7 days expiry
        } else {
            Cache::forget($key);
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

        return Cache::get($key, 0);
    }

    /**
     * Start checking for updates using Laravel jobs.
     *
     * @return array{success: bool, message: string, job_id?: string, error?: string}
     */
    public function startCheckForUpdates(): array
    {
        $jobId = 'check_'.time().'_'.uniqid();

        try {
            $job = new SystemUpdateJob('check', $jobId);
            Bus::dispatch($job);

            // Store job info in cache for tracking
            Cache::put("check_job_{$jobId}", [
                'job_id' => $jobId,
                'started_at' => now(),
                'operation' => 'check',
            ], 3600); // 1 hour cache

            return [
                'success' => true,
                'message' => 'Update check started',
                'job_id' => $jobId,
            ];
        } catch (\Exception $e) {
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
        $jobCacheKey = "check_job_{$jobId}";
        $resultCacheKey = "job_result_{$jobId}";

        $jobData = Cache::get($jobCacheKey);

        if (! $jobData) {
            return [
                'running' => false,
                'output' => 'Job not found or expired',
                'completed' => true,
            ];
        }

        // Check if job result is available
        $result = Cache::get($resultCacheKey);

        if ($result) {
            // Job completed - clean up and return result
            Cache::forget($jobCacheKey);
            Cache::forget($resultCacheKey);

            $output = $result['success']
                ? 'Update check completed successfully at '.now()->format('Y-m-d H:i:s')."\n"
                : 'Update check failed at '.now()->format('Y-m-d H:i:s')."\n";

            if ($result['output']) {
                $output .= "\n".$result['output'];
            }

            if ($result['success']) {
                // Update the last update timestamp
                Setting::setValue(self::LAST_UPDATE_KEY, now()->toISOString());

                // Update badge count for updates app
                $status = $this->getUpdateStatus();
                $this->updateBadgeCount('updates', $status['count'] ?? 0);
            }

            return [
                'running' => false,
                'output' => $output,
                'completed' => true,
                'success' => $result['success'],
                'error' => $result['error'],
            ];
        }

        // Job still running
        return [
            'running' => true,
            'output' => 'Checking for updates...',
            'completed' => false,
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
                if (str_contains($lines[0], 'Listing...')) {
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
