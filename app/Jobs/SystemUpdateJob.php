<?php

namespace App\Jobs;

use App\Services\UpdateService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

/**
 * Job to perform system updates in the background.
 */
class SystemUpdateJob implements ShouldQueue
{
    use Queueable;

    /**
     * The type of update operation to perform.
     */
    protected string $operation;

    /**
     * The custom job ID for tracking.
     */
    protected string $customJobId;

    /**
     * Create a new job instance.
     *
     * @param  string  $operation  The operation to perform ('check' or 'upgrade')
     * @param  string  $customJobId  Custom job ID for tracking
     */
    public function __construct(string $operation, string $customJobId)
    {
        $this->operation = $operation;
        $this->customJobId = $customJobId;
        $this->onQueue('updates');
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $updateService = app(UpdateService::class);
        $jobId = $this->customJobId;

        Log::info("SystemUpdateJob: Starting {$this->operation} operation (Job ID: {$jobId})");

        try {
            if ($this->operation === 'check') {
                $result = $updateService->checkForUpdates();
            } elseif ($this->operation === 'upgrade') {
                $result = $updateService->performUpgrade();
            } else {
                Log::error("SystemUpdateJob: Unknown operation '{$this->operation}'");
                $this->storeResult($jobId, false, 'Unknown operation', 'Unknown operation type');

                return;
            }

            // Store the result in cache for status checking
            $this->storeResult($jobId, $result['success'], $result['message'], $result['error'] ?? null, $result['output'] ?? null);

            if ($result['success']) {
                Log::info("SystemUpdateJob: {$this->operation} completed successfully");
            } else {
                Log::error("SystemUpdateJob: {$this->operation} failed: {$result['message']}");
            }
        } catch (\Exception $e) {
            Log::error("SystemUpdateJob: Exception during {$this->operation}: ".$e->getMessage());
            $this->storeResult($jobId, false, 'Job failed with exception', $e->getMessage());
        }
    }

    /**
     * Store job result in cache.
     */
    protected function storeResult(string $jobId, bool $success, string $message, ?string $error = null, ?string $output = null): void
    {
        $cacheKey = "job_result_{$jobId}";
        \Illuminate\Support\Facades\Cache::put($cacheKey, [
            'success' => $success,
            'message' => $message,
            'error' => $error,
            'output' => $output,
            'completed_at' => now(),
        ], 3600); // 1 hour cache
    }
}
