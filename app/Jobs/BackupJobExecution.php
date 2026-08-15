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

        Log::info('BackupJobExecution: starting', [
            'job_id' => $this->jobId,
            'job_name' => $job->name,
            'execution_id' => $this->executionId,
            'queue' => $this->queue,
            'job_status' => $job->status,
            'source_paths' => $job->source_paths,
        ]);

        $job->update(['status' => 'running']);

        try {
            Log::info("Starting backup for job '{$job->name}'...", [
                'job_id' => $this->jobId,
                'execution_id' => $this->executionId,
            ]);

            // Run the backup
            Log::info('BackupJobExecution: calling ResticService::backup()', [
                'job_id' => $this->jobId,
                'execution_id' => $this->executionId,
            ]);

            $result = $resticService->backup($job, $execution);

            Log::info('BackupJobExecution: ResticService::backup() returned', [
                'job_id' => $this->jobId,
                'execution_id' => $this->executionId,
                'success' => $result['success'],
                'message' => $result['message'],
                'snapshot_id' => $result['snapshot_id'] ?? null,
            ]);

            if ($result['success']) {
                // Apply retention policy
                $forgetResult = $resticService->forget(
                    $job->repository,
                    $job->retention_policy ?? []
                );

                Log::info('BackupJobExecution: retention policy result', [
                    'job_id' => $this->jobId,
                    'execution_id' => $this->executionId,
                    'success' => $forgetResult['success'],
                    'message' => $forgetResult['message'],
                ]);

                if (! $forgetResult['success']) {
                    Log::warning('BackupJobExecution: retention policy failed', [
                        'job_id' => $this->jobId,
                        'execution_id' => $this->executionId,
                        'message' => $forgetResult['message'],
                    ]);
                }

                $execution->markSuccess([
                    'snapshots_created' => isset($result['snapshot_id']) ? 1 : 0,
                ]);

                $job->update([
                    'status' => 'success',
                    'last_backup_at' => now(),
                    'last_error' => null,
                ]);

                Log::info('BackupJobExecution: backup completed successfully', [
                    'job_id' => $this->jobId,
                    'execution_id' => $this->executionId,
                ]);
            } else {
                $execution->markFailed($result['message']);

                $job->update([
                    'status' => 'failed',
                    'last_error' => $result['message'],
                ]);

                Log::error('BackupJobExecution: backup failed', [
                    'job_id' => $this->jobId,
                    'execution_id' => $this->executionId,
                    'message' => $result['message'],
                ]);
            }

            // Update next run time
            $schedulerService->updateNextRunAt($job);

            // Prune old executions
            BackupExecution::pruneForJob($this->jobId, keep: 100);

            Log::info('BackupJobExecution: completed', [
                'job_id' => $this->jobId,
                'job_name' => $job->name,
                'execution_id' => $execution->id,
                'status' => $execution->status,
                'duration_seconds' => $execution->duration_seconds,
            ]);
        } catch (\Exception $e) {
            Log::error('BackupJobExecution: exception caught', [
                'job_id' => $this->jobId,
                'job_name' => $job->name,
                'execution_id' => $this->executionId,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
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

        $execution = BackupExecution::find($this->executionId);
        if ($execution && $execution->status === 'running') {
            $execution->markFailed($exception->getMessage());
        }

        $job = BackupJob::find($this->jobId);
        if ($job && in_array($job->status, ['running', 'waiting'])) {
            $job->update([
                'status' => 'failed',
                'last_error' => $exception->getMessage(),
            ]);
        }
    }
}
