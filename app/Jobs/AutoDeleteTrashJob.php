<?php

namespace App\Jobs;

use App\Services\TrashManager;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

/**
 * Job to auto-delete expired trashed files.
 *
 * Runs on the default queue. Scheduled daily by the application scheduler.
 */
class AutoDeleteTrashJob implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new job instance.
     */
    public function __construct()
    {
        $this->onQueue('default');
    }

    /**
     * Execute the job.
     */
    public function handle(TrashManager $trashManager): void
    {
        Log::info('AutoDeleteTrashJob: Starting auto-deletion of expired trash');

        $deleted = $trashManager->deleteExpired();

        Log::info("AutoDeleteTrashJob: Completed, deleted {$deleted} expired files");
    }
}
