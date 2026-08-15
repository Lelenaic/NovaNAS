<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreBackupJobRequest;
use App\Http\Requests\UpdateBackupJobRequest;
use App\Jobs\BackupJobExecution;
use App\Models\BackupExecution;
use App\Models\BackupJob;
use App\Services\Backup\BackupSchedulerService;
use App\Services\Backup\ResticService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

/**
 * Controller for managing backup jobs.
 */
class BackupJobController extends Controller
{
    public function __construct(
        protected ResticService $resticService,
        protected BackupSchedulerService $schedulerService,
    ) {}

    /**
     * Get all backup jobs.
     */
    public function index(): JsonResponse
    {
        $jobs = BackupJob::with(['repository', 'latestExecution'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'jobs' => $jobs->map(fn ($job) => $this->formatJob($job)),
        ]);
    }

    /**
     * Store a new backup job.
     */
    public function store(StoreBackupJobRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $job = BackupJob::create([
            'backup_repository_id' => $validated['backup_repository_id'],
            'name' => $validated['name'],
            'is_enabled' => $validated['is_enabled'] ?? true,
            'source_paths' => $validated['source_paths'],
            'exclude_patterns' => $validated['exclude_patterns'] ?? null,
            'cron_expression' => $validated['cron_expression'],
            'retention_policy' => $validated['retention_policy'],
            'tags' => $validated['tags'] ?? null,
            'compression' => $validated['compression'] ?? 'auto',
            'user_id' => auth()->id(),
        ]);

        $this->schedulerService->updateNextRunAt($job);

        return response()->json([
            'message' => 'Backup job created successfully.',
            'job' => $this->formatJob($job->fresh()->load('repository')),
        ], 201);
    }

    /**
     * Show a backup job.
     */
    public function show(BackupJob $job): JsonResponse
    {
        return response()->json([
            'job' => $this->formatJob($job->load('repository', 'latestExecution')),
        ]);
    }

    /**
     * Update a backup job.
     */
    public function update(UpdateBackupJobRequest $request, BackupJob $job): JsonResponse
    {
        $validated = $request->validated();

        $job->update($validated);

        if (isset($validated['cron_expression']) || isset($validated['is_enabled'])) {
            $this->schedulerService->updateNextRunAt($job);
        }

        return response()->json([
            'message' => 'Backup job updated successfully.',
            'job' => $this->formatJob($job->fresh()->load('repository')),
        ]);
    }

    /**
     * Delete a backup job.
     */
    public function destroy(BackupJob $job): JsonResponse
    {
        $job->delete();

        return response()->json([
            'message' => 'Backup job deleted successfully.',
        ]);
    }

    /**
     * Run a backup job immediately.
     */
    public function run(BackupJob $job): JsonResponse
    {
        Log::info('BackupJobController::run() called', [
            'job_id' => $job->id,
            'job_name' => $job->name,
            'current_status' => $job->status,
            'is_running' => $job->isRunning(),
            'user_id' => auth()->id(),
        ]);

        if ($job->isRunning()) {
            Log::warning('Backup job is already running, rejecting manual run', [
                'job_id' => $job->id,
                'job_name' => $job->name,
                'current_status' => $job->status,
            ]);

            return response()->json([
                'message' => 'Backup job is already running.',
            ], 409);
        }

        if ($job->status === 'waiting') {
            return response()->json([
                'message' => 'Backup job is already waiting to start.',
            ], 409);
        }

        $execution = BackupExecution::create([
            'backup_job_id' => $job->id,
            'started_at' => now(),
            'status' => 'running',
        ]);

        $job->update(['status' => 'waiting']);

        Log::info('BackupJobController::run() dispatching BackupJobExecution', [
            'job_id' => $job->id,
            'job_name' => $job->name,
            'execution_id' => $execution->id,
        ]);

        // Dispatch to queue for background execution
        dispatch(new BackupJobExecution($job->id, $execution->id));

        return response()->json([
            'message' => 'Backup job started.',
            'execution_id' => $execution->id,
        ]);
    }

    /**
     * Enable a backup job.
     */
    public function enable(BackupJob $job): JsonResponse
    {
        $this->schedulerService->enable($job);

        return response()->json([
            'message' => 'Backup job enabled.',
        ]);
    }

    /**
     * Disable a backup job.
     */
    public function disable(BackupJob $job): JsonResponse
    {
        $this->schedulerService->disable($job);

        return response()->json([
            'message' => 'Backup job disabled.',
        ]);
    }

    /**
     * Get executions for a backup job.
     */
    public function executions(BackupJob $job): JsonResponse
    {
        $executions = $job->executions()
            ->orderByDesc('started_at')
            ->limit(100)
            ->get();

        return response()->json([
            'executions' => $executions->map(fn (BackupExecution $exec) => [
                'id' => $exec->id,
                'started_at' => $exec->started_at->toIso8601String(),
                'finished_at' => $exec->finished_at?->toIso8601String(),
                'status' => $exec->status,
                'error_message' => $exec->error_message,
                'snapshots_created' => $exec->snapshots_created,
                'bytes_processed' => $exec->bytes_processed,
                'files_processed' => $exec->files_processed,
                'duration_seconds' => $exec->duration_seconds,
            ]),
        ]);
    }

    /**
     * Get logs for a specific execution.
     */
    public function logs(BackupJob $job, BackupExecution $execution): JsonResponse
    {
        return response()->json([
            'status' => $execution->status,
            'logs' => $execution->logs ?? '',
            'bytes_processed' => $execution->bytes_processed,
            'files_processed' => $execution->files_processed,
        ]);
    }

    /**
     * Format a job for JSON response.
     *
     * @return array<string, mixed>
     */
    protected function formatJob(BackupJob $job): array
    {
        $schedulerService = app(BackupSchedulerService::class);

        return [
            'id' => $job->id,
            'backup_repository_id' => $job->backup_repository_id,
            'repository_name' => $job->repository->name,
            'name' => $job->name,
            'is_enabled' => $job->is_enabled,
            'source_paths' => $job->source_paths,
            'exclude_patterns' => $job->exclude_patterns,
            'cron_expression' => $job->cron_expression,
            'schedule_description' => $schedulerService->describeSchedule($job->cron_expression),
            'next_run_at' => $job->next_run_at?->toIso8601String(),
            'retention_policy' => $job->retention_policy,
            'tags' => $job->tags,
            'compression' => $job->compression,
            'status' => $job->status,
            'last_backup_at' => $job->last_backup_at?->toIso8601String(),
            'last_backup_size' => $job->last_backup_size,
            'last_error' => $job->last_error,
            'latest_execution' => $job->latestExecution ? [
                'id' => $job->latestExecution->id,
                'started_at' => $job->latestExecution->started_at->toIso8601String(),
                'finished_at' => $job->latestExecution->finished_at?->toIso8601String(),
                'status' => $job->latestExecution->status,
                'snapshots_created' => $job->latestExecution->snapshots_created,
                'duration_seconds' => $job->latestExecution->duration_seconds,
            ] : null,
            'created_at' => $job->created_at->toIso8601String(),
            'updated_at' => $job->updated_at->toIso8601String(),
        ];
    }
}
