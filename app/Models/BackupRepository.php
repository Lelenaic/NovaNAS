<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Support\Carbon;

/**
 * Backup Repository Model
 *
 * Stores connection information for restic backup repositories.
 *
 * @property string $id
 * @property string $name
 * @property string $storage_type
 * @property string $repo_path
 * @property array<array-key, mixed>|null $credentials
 * @property bool $is_initialized
 * @property Carbon|null $last_check_at
 * @property string $user_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Collection<int, \App\Models\BackupExecution> $executions
 * @property-read int|null $executions_count
 * @property-read Collection<int, \App\Models\BackupJob> $jobs
 * @property-read int|null $jobs_count
 * @property-read \App\Models\User $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupRepository initialized()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupRepository newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupRepository newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupRepository query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupRepository whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupRepository whereCredentials($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupRepository whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupRepository whereIsInitialized($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupRepository whereLastCheckAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupRepository whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupRepository whereRepoPath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupRepository whereStorageType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupRepository whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BackupRepository whereUserId($value)
 * @mixin \Eloquent
 */
class BackupRepository extends Model
{
    use HasFactory;
    use HasUuids;

    protected $table = 'backup_repositories';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'storage_type',
        'repo_path',
        'credentials',
        'is_initialized',
        'last_check_at',
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
            'credentials' => 'encrypted:array',
            'is_initialized' => 'boolean',
            'last_check_at' => 'datetime',
        ];
    }

    /**
     * Get the user who owns this repository.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the backup jobs for this repository.
     */
    public function jobs(): HasMany
    {
        return $this->hasMany(BackupJob::class);
    }

    /**
     * Get the executions across all jobs for this repository.
     */
    public function executions(): HasManyThrough
    {
        return $this->hasManyThrough(BackupExecution::class, BackupJob::class);
    }

    /**
     * Scope to get only initialized repositories.
     */
    public function scopeInitialized($query)
    {
        return $query->where('is_initialized', true);
    }
}
