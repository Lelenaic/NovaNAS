<?php

namespace App\Jobs;

use App\Models\BackupExecution;
use App\Models\BackupJob;
use App\Services\Backup\BackupSchedulerService;
use App\Services\Backup\ResticService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

/**
 * Job to execute a backup in the background.
 */
class BackupJobExecution implements ShouldQueue
{
    use Queueable;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 1;

    /**
     * The number of seconds to wait before retrying the job.
     */
    public int $backoff = 0;

    /**
     * Create a new job instance.
     */
    public function __construct(
        protected string $jobId,
        protected string $executionId,
    ) {
        $this->onQueue('backups');
    }

    /**
     * Execute the job.
     */
    public function handle(ResticService $resticService, BackupSchedulerService $schedulerService): void
    {
        $job = BackupJob::with('repository')->find($this->jobId);
        $execution = BackupExecution::find($this->executionId);

        if (! $job || ! $execution) {
            Log::error('BackupJobExecution: Job or execution not found', [
                'job_id' => $this->jobId,
                'execution_id' => $this->executionId,
            ]);

            return;
        }

        try {
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
            BackupExecution::pruneForJob($this->jobId, keep: 100);

            Log::info("Backup job '{$job->name}' completed.", [
                'job_id' => $this->jobId,
                'execution_id' => $execution->id,
                'status' => $execution->status,
            ]);
        } catch (\Exception $e) {
            Log::error("Backup job '{$job->name}' failed with exception.", [
                'job_id' => $this->jobId,
                'error' => $e->getMessage(),
            ]);

            $execution->markFailed($e->getMessage());

            $job->update([
                'status' => 'failed',
                'last_error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('BackupJobExecution: Job failed permanently', [
            'job_id' => $this->jobId,
            'execution_id' => $this->executionId,
            'error' => $exception->getMessage(),
        ]);
    }
}
