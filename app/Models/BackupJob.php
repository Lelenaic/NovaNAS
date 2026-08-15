<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * Backup Job Model
 *
 * Stores configuration for a backup job (what to backup, when, retention policy).
 *
 * @property string $id
 * @property string $backup_repository_id
 * @property string $name
 * @property bool $is_enabled
 * @property array<array-key, mixed> $source_paths
 * @property array<array-key, mixed>|null $exclude_patterns
 * @property string|null $cron_expression
 * @property Carbon|null $next_run_at
 * @property array<array-key, mixed> $retention_policy
 * @property array<array-key, mixed>|null $tags
 * @property bool $one_file_system
 * @property string $compression
 * @property string $status
 * @property Carbon|null $last_backup_at
 * @property int|null $last_backup_size
 * @property string|null $last_error
 * @property string $user_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Collection<int, BackupExecution> $executions
 * @property-read int|null $executions_count
 * @property-read BackupExecution|null $latestExecution
 * @property-read BackupRepository $repository
 * @property-read User $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupJob due()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupJob enabled()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupJob newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupJob newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupJob query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupJob whereBackupRepositoryId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupJob whereCompression($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupJob whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupJob whereCronExpression($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupJob whereExcludePatterns($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupJob whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupJob whereIsEnabled($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupJob whereLastBackupAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupJob whereLastBackupSize($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupJob whereLastError($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupJob whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupJob whereNextRunAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupJob whereOneFileSystem($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupJob whereRetentionPolicy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupJob whereSourcePaths($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupJob whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupJob whereTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupJob whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupJob whereUserId($value)
 *
 * @mixin \Eloquent
 */
class BackupJob extends Model
{
    use HasFactory;
    use HasUuids;

    protected $table = 'backup_jobs';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'backup_repository_id',
        'name',
        'is_enabled',
        'source_paths',
        'exclude_patterns',
        'cron_expression',
        'next_run_at',
        'retention_policy',
        'tags',
        'one_file_system',
        'compression',
        'status',
        'last_backup_at',
        'last_backup_size',
        'last_error',
        'user_id',
    ];

    /**
     * The attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
            'source_paths' => 'array',
            'exclude_patterns' => 'array',
            'next_run_at' => 'datetime',
            'retention_policy' => 'array',
            'tags' => 'array',
            'one_file_system' => 'boolean',
            'last_backup_at' => 'datetime',
            'last_backup_size' => 'integer',
        ];
    }

    /**
     * Get the repository for this job.
     */
    public function repository(): BelongsTo
    {
        return $this->belongsTo(BackupRepository::class, 'backup_repository_id');
    }

    /**
     * Get the user who owns this job.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the executions for this job.
     */
    public function executions(): HasMany
    {
        return $this->hasMany(BackupExecution::class);
    }

    /**
     * Get the latest execution for this job.
     */
    public function latestExecution(): HasOne
    {
        return $this->hasOne(BackupExecution::class)->latestOfMany();
    }

    /**
     * Check if the job is currently running or waiting to start.
     */
    public function isRunning(): bool
    {
        return in_array($this->status, ['running', 'waiting']);
    }

    /**
     * Scope to get only enabled jobs.
     */
    public function scopeEnabled($query)
    {
        return $query->where('is_enabled', true);
    }

    /**
     * Scope to get jobs that are due to run.
     */
    public function scopeDue($query)
    {
        return $query->enabled()
            ->where('next_run_at', '<=', now())
            ->whereNotIn('status', ['running', 'waiting']);
    }
}
