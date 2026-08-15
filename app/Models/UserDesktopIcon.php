<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * User Desktop Icon Model
 *
 * Represents a user's desktop icon for a specific app with ordering.
 *
 * @property int $id
 * @property int $user_id
 * @property int $desktop_app_id
 * @property int $order
 * @property bool $is_visible
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\DesktopApp $desktopApp
 * @property-read \App\Models\User $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserDesktopIcon newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserDesktopIcon newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserDesktopIcon query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserDesktopIcon whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserDesktopIcon whereDesktopAppId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserDesktopIcon whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserDesktopIcon whereIsVisible($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserDesktopIcon whereOrder($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserDesktopIcon whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserDesktopIcon whereUserId($value)
 * @mixin \Eloquent
 */
class UserDesktopIcon extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'desktop_app_id',
        'order',
        'is_visible',
    ];

    /**
     * The attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_visible' => 'boolean',
            'order' => 'integer',
        ];
    }

    /**
     * Get the user that owns this desktop icon.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the desktop app associated with this icon.
     */
    public function desktopApp(): BelongsTo
    {
        return $this->belongsTo(DesktopApp::class);
    }
}
