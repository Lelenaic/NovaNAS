<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * TrashedFile Model
 *
 * Tracks files and folders that have been moved to trash.
 * The actual file is moved to a trash directory on the filesystem.
 *
 * @property int $id
 * @property string $original_path
 * @property string $trash_path
 * @property string $filename
 * @property int $trashed_by
 * @property \Illuminate\Support\Carbon $trashed_at
 * @property \Illuminate\Support\Carbon $expires_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $user
 * @method static Builder<static>|TrashedFile expired()
 * @method static Builder<static>|TrashedFile forUser(int $userId)
 * @method static Builder<static>|TrashedFile newModelQuery()
 * @method static Builder<static>|TrashedFile newQuery()
 * @method static Builder<static>|TrashedFile query()
 * @method static Builder<static>|TrashedFile whereCreatedAt($value)
 * @method static Builder<static>|TrashedFile whereExpiresAt($value)
 * @method static Builder<static>|TrashedFile whereFilename($value)
 * @method static Builder<static>|TrashedFile whereId($value)
 * @method static Builder<static>|TrashedFile whereOriginalPath($value)
 * @method static Builder<static>|TrashedFile whereTrashPath($value)
 * @method static Builder<static>|TrashedFile whereTrashedAt($value)
 * @method static Builder<static>|TrashedFile whereTrashedBy($value)
 * @method static Builder<static>|TrashedFile whereUpdatedAt($value)
 * @mixin \Eloquent
 */
class TrashedFile extends Model
{
    protected $fillable = [
        'original_path',
        'trash_path',
        'filename',
        'trashed_by',
        'trashed_at',
        'expires_at',
    ];

    protected $casts = [
        'trashed_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    /**
     * Get the user who trashed the file.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'trashed_by');
    }

    /**
     * Scope: files that have expired and should be permanently deleted.
     */
    public function scopeExpired(Builder $query): Builder
    {
        return $query->where('expires_at', '<=', now());
    }

    /**
     * Scope: files trashed by a specific user.
     */
    public function scopeForUser(Builder $query, int $userId): Builder
    {
        return $query->where('trashed_by', $userId);
    }
}
