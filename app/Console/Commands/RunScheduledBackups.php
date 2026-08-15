<?php

namespace App\Console\Commands;

use App\Models\BackupExecution;
use App\Models\BackupJob;
use App\Services\Backup\BackupSchedulerService;
use Illuminate\Console\Command;

/**
 * Command to run scheduled backup jobs.
 *
 * This command is called every minute by the scheduler to check for due jobs
 * and launch them in tmux sessions for non-blocking concurrent execution.
 */
class RunScheduledBackups extends Command
{
    protected $signature = 'backup:run-scheduled';

    protected $description = 'Check for and run scheduled backup jobs';

    public function handle(BackupSchedulerService $schedulerService): int
    {
        $dueJobs = $schedulerService->getDueJobs();

        if ($dueJobs->isEmpty()) {
            return self::SUCCESS;
        }

        $this->info("Found {$dueJobs->count()} due backup job(s).");

        foreach ($dueJobs as $job) {
            $this->runJob($job);
        }

        return self::SUCCESS;
    }

    /**
     * Launch a backup job in a tmux session.
     */
    protected function runJob(BackupJob $job): void
    {
        // Check if job is already running
        if ($job->isRunning()) {
            $this->warn("Job '{$job->name}' is already running, skipping.");

            return;
        }

        // Check flock to prevent duplicate runs
        $lockPath = "/var/lock/novanas-backup-{$job->id}";

        $lock = @fopen($lockPath, 'c');

        if (! $lock || ! flock($lock, LOCK_EX | LOCK_NB)) {
            $this->warn("Job '{$job->name}' is locked, skipping.");

            return;
        }

        // Create execution record
        $execution = BackupExecution::create([
            'backup_job_id' => $job->id,
            'started_at' => now(),
            'status' => 'running',
        ]);

        $job->update(['status' => 'waiting']);

        // Launch in tmux
        $command = sprintf(
            'sudo tmux new-session -d -s backup-%s "php artisan backup:run %s %s 2>&1 | tee storage/logs/backup-%s.log"',
            escapeshellarg($job->id),
            escapeshellarg($job->id),
            escapeshellarg($execution->id),
            escapeshellarg($job->id)
        );

        exec($command, $output, $returnCode);

        if ($returnCode !== 0) {
            $this->error("Failed to start tmux session for job '{$job->name}'.");

            $execution->markFailed('Failed to start tmux session');
            $job->update(['status' => 'failed']);

            flock($lock, LOCK_UN);
            fclose($lock);

            return;
        }

        $this->info("Started backup job '{$job->name}' in tmux session.");

        // Update next run time
        $schedulerService = app(BackupSchedulerService::class);
        $schedulerService->updateNextRunAt($job);

        // Release lock (tmux session holds its own process)
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}
