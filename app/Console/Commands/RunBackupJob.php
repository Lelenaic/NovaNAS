<?php

namespace App\Console\Commands;

use App\Models\BackupExecution;
use App\Models\BackupJob;
use App\Services\Backup\BackupSchedulerService;
use App\Services\Backup\ResticService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Command to run a single backup job.
 *
 * This command is executed inside a tmux session by RunScheduledBackups.
 * It uses flock to prevent duplicate runs of the same job.
 */
class RunBackupJob extends Command
{
    protected $signature = 'backup:run {jobId} {executionId?}';

    protected $description = 'Run a specific backup job';

    public function handle(ResticService $resticService, BackupSchedulerService $schedulerService): int
    {
        $jobId = $this->argument('jobId');
        $executionId = $this->argument('executionId');

        $job = BackupJob::with('repository')->find($jobId);

        if (! $job) {
            $this->error("Backup job {$jobId} not found.");

            return self::FAILURE;
        }

        // Acquire flock to prevent duplicate runs
        $lockPath = "/var/lock/novanas-backup-{$jobId}";
        $lock = @fopen($lockPath, 'c');

        if (! $lock || ! flock($lock, LOCK_EX | LOCK_NB)) {
            $this->warn("Backup job {$jobId} is already running, skipping.");

            return self::SUCCESS;
        }

        try {
            // Get or create execution record
            $execution = $executionId
                ? BackupExecution::find($executionId)
                : BackupExecution::create([
                    'backup_job_id' => $jobId,
                    'started_at' => now(),
                    'status' => 'running',
                ]);

            if (! $execution) {
                $this->error("Execution {$executionId} not found.");

                return self::FAILURE;
            }

            $this->info("Starting backup for job '{$job->name}'...");

            // Run the backup
            $result = $resticService->backup($job, $execution);

            if ($result['success']) {
                // Apply retention policy
                $forgetResult = $resticService->forget(
                    $job->repository,
                    $job->retention_policy ?? []
                );

                if (! $forgetResult['success']) {
                    $this->warn("Retention policy failed: {$forgetResult['message']}");
                }

                $execution->markSuccess([
                    'snapshots_created' => isset($result['snapshot_id']) ? 1 : 0,
                ]);

                $job->update([
                    'status' => 'success',
                    'last_backup_at' => now(),
                    'last_error' => null,
                ]);

                $this->info('Backup completed successfully.');
            } else {
                $execution->markFailed($result['message']);

                $job->update([
                    'status' => 'failed',
                    'last_error' => $result['message'],
                ]);

                $this->error("Backup failed: {$result['message']}");
            }

            // Update next run time
            $schedulerService->updateNextRunAt($job);

            // Prune old executions
            BackupExecution::pruneForJob($jobId, keep: 100);

            Log::info("Backup job '{$job->name}' completed.", [
                'job_id' => $jobId,
                'execution_id' => $execution->id,
                'status' => $execution->status,
            ]);

            return $result['success'] ? self::SUCCESS : self::FAILURE;
        } catch (\Exception $e) {
            Log::error("Backup job '{$job->name}' failed with exception.", [
                'job_id' => $jobId,
                'error' => $e->getMessage(),
            ]);

            $this->error('Backup failed: '.$e->getMessage());

            return self::FAILURE;
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }
}
