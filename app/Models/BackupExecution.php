<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Backup Execution Model
 *
 * Tracks backup job execution history with logs and metrics.
 * Only the last 100 executions per job are retained.
 *
 * @property string $id
 * @property string $backup_job_id
 * @property Carbon $started_at
 * @property Carbon|null $finished_at
 * @property string $status
 * @property string|null $error_message
 * @property int $snapshots_created
 * @property int|null $bytes_processed
 * @property int|null $files_processed
 * @property float|null $duration_seconds
 * @property string|null $logs
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read \App\Models\BackupJob|null $job
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupExecution newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupExecution newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupExecution query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupExecution whereBackupJobId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupExecution whereBytesProcessed($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupExecution whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupExecution whereDurationSeconds($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupExecution whereErrorMessage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupExecution whereFilesProcessed($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupExecution whereFinishedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupExecution whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupExecution whereLogs($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupExecution whereSnapshotsCreated($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupExecution whereStartedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupExecution whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupExecution whereUpdatedAt($value)
 * @mixin \Eloquent
 */
class BackupExecution extends Model
{
    use HasFactory;
    use HasUuids;

    protected $table = 'backup_executions';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'backup_job_id',
        'started_at',
        'finished_at',
        'status',
        'error_message',
        'snapshots_created',
        'bytes_processed',
        'files_processed',
        'duration_seconds',
        'logs',
    ];

    /**
     * The attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
            'snapshots_created' => 'integer',
            'bytes_processed' => 'integer',
            'files_processed' => 'integer',
            'duration_seconds' => 'float',
        ];
    }

    /**
     * Get the backup job for this execution.
     */
    public function job(): BelongsTo
    {
        return $this->belongsTo(BackupJob::class);
    }

    /**
     * Append log output to this execution.
     *
     * Truncates to keep only the last ~50KB of logs.
     */
    public function appendLogs(string $output): void
    {
        $maxLogSize = 50 * 1024; // 50KB

        $newLogs = ($this->logs ?? '').$output;

        if (strlen($newLogs) > $maxLogSize) {
            $newLogs = '...'.substr($newLogs, -$maxLogSize);
        }

        $this->update(['logs' => $newLogs]);
    }

    /**
     * Mark the execution as completed successfully.
     */
    public function markSuccess(array $stats = []): void
    {
        $this->update([
            'status' => 'success',
            'finished_at' => now(),
            'duration_seconds' => $this->started_at->diffInSeconds(now()),
            'snapshots_created' => $stats['snapshots_created'] ?? 0,
            'bytes_processed' => $stats['bytes_processed'] ?? null,
            'files_processed' => $stats['files_processed'] ?? null,
        ]);
    }

    /**
     * Mark the execution as failed.
     */
    public function markFailed(string $error): void
    {
        $this->update([
            'status' => 'failed',
            'finished_at' => now(),
            'duration_seconds' => $this->started_at->diffInSeconds(now()),
            'error_message' => $error,
        ]);
    }

    /**
     * Prune old executions for a job, keeping only the last N.
     */
    public static function pruneForJob(string $jobId, int $keep = 100): void
    {
        $keepIds = self::where('backup_job_id', $jobId)
            ->orderByDesc('started_at')
            ->limit($keep)
            ->pluck('id');

        if ($keepIds->isNotEmpty()) {
            self::where('backup_job_id', $jobId)
                ->whereNotIn('id', $keepIds)
                ->delete();
        }
    }
}
