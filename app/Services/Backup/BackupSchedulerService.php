<?php

namespace App\Services\Backup;

use App\Models\BackupJob;
use Carbon\Carbon;
use Cron\CronExpression;
use Illuminate\Database\Eloquent\Collection;

/**
 * Service for managing backup job scheduling.
 */
class BackupSchedulerService
{
    /**
     * Calculate the next run time for a job based on its cron expression.
     */
    public function calculateNextRunAt(BackupJob $job): ?Carbon
    {
        if (! $job->is_enabled) {
            return null;
        }

        try {
            $cron = CronExpression::factory($job->cron_expression);
            $nextRun = $cron->getNextRunDate();

            return Carbon::instance($nextRun);
        } catch (\Exception) {
            return null;
        }
    }

    /**
     * Update the next_run_at for a job.
     */
    public function updateNextRunAt(BackupJob $job): void
    {
        $nextRunAt = $this->calculateNextRunAt($job);

        $job->update(['next_run_at' => $nextRunAt]);
    }

    /**
     * Enable a job and set its next run time.
     */
    public function enable(BackupJob $job): void
    {
        $job->update(['is_enabled' => true]);
        $this->updateNextRunAt($job);
    }

    /**
     * Disable a job and clear its next run time.
     */
    public function disable(BackupJob $job): void
    {
        $job->update([
            'is_enabled' => false,
            'next_run_at' => null,
        ]);
    }

    /**
     * Get all jobs that are due to run.
     *
     * @return Collection<int, BackupJob>
     */
    public function getDueJobs()
    {
        return BackupJob::due()->get();
    }

    /**
     * Get human-readable schedule description from cron expression.
     */
    public function describeSchedule(string $cronExpression): string
    {
        try {
            $cron = CronExpression::factory($cronExpression);

            if ($cron->isDue()) {
                return 'Every minute';
            }

            $parts = explode(' ', $cronExpression);
            $minutes = $parts[0];
            $hours = $parts[1];

            if ($minutes === '*' && $hours === '*') {
                return 'Every minute';
            }

            if (str_contains($minutes, '*/')) {
                $interval = (int) str_replace('*/', '', $minutes);

                return "Every {$interval} minutes";
            }

            if (str_contains($hours, '*/')) {
                $interval = (int) str_replace('*/', '', $hours);

                return "Every {$interval} hours";
            }

            if ($hours !== '*' && $minutes !== '*') {
                return "At {$hours}:{$minutes} daily";
            }

            if ($hours !== '*') {
                return "Every hour at minute {$minutes}";
            }

            return $cronExpression;
        } catch (\Exception) {
            return $cronExpression;
        }
    }
}
