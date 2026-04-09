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
     * Create a new job instance.
     *
     * @param  string  $operation  The operation to perform ('check' or 'upgrade')
     */
    public function __construct(string $operation)
    {
        $this->operation = $operation;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $updateService = new UpdateService;

        Log::info("SystemUpdateJob: Starting {$this->operation} operation");

        try {
            if ($this->operation === 'check') {
                $result = $updateService->checkForUpdates();
            } elseif ($this->operation === 'upgrade') {
                $result = $updateService->performUpgrade();
            } else {
                Log::error("SystemUpdateJob: Unknown operation '{$this->operation}'");

                return;
            }

            if ($result['success']) {
                Log::info("SystemUpdateJob: {$this->operation} completed successfully");
            } else {
                Log::error("SystemUpdateJob: {$this->operation} failed: {$result['message']}");
            }
        } catch (\Exception $e) {
            Log::error("SystemUpdateJob: Exception during {$this->operation}: ".$e->getMessage());
        }
    }
}
