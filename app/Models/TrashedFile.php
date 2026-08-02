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
 * @property \Carbon\Carbon $trashed_at
 * @property \Carbon\Carbon $expires_at
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 * @property-read \App\Models\User $user
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
