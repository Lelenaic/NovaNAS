<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Installed Application Model
 *
 * Tracks applications that have been installed from app stores.
 *
 * @property int $id
 * @property string $app_id
 * @property string $store_provider
 * @property string $title
 * @property string|null $tagline
 * @property string|null $description
 * @property string $category
 * @property string $installed_version
 * @property string|null $available_version
 * @property string|null $author
 * @property string|null $developer
 * @property string|null $icon
 * @property string $compose_path
 * @property string $status
 * @property int|null $installed_by
 * @property \Illuminate\Support\Carbon $installed_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property string|null $port_map
 * @property string|null $app_index
 * @property-read \App\Models\User|null $installer
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InstalledApplication newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InstalledApplication newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InstalledApplication query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InstalledApplication running()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InstalledApplication stopped()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InstalledApplication whereAppId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InstalledApplication whereAppIndex($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InstalledApplication whereAuthor($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InstalledApplication whereAvailableVersion($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InstalledApplication whereCategory($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InstalledApplication whereComposePath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InstalledApplication whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InstalledApplication whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InstalledApplication whereDeveloper($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InstalledApplication whereIcon($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InstalledApplication whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InstalledApplication whereInstalledAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InstalledApplication whereInstalledBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InstalledApplication whereInstalledVersion($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InstalledApplication wherePortMap($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InstalledApplication whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InstalledApplication whereStoreProvider($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InstalledApplication whereTagline($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InstalledApplication whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InstalledApplication whereUpdatedAt($value)
 * @mixin \Eloquent
 */
class InstalledApplication extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'app_id',
        'store_provider',
        'title',
        'tagline',
        'description',
        'category',
        'installed_version',
        'available_version',
        'author',
        'developer',
        'icon',
        'port_map',
        'app_index',
        'compose_path',
        'status',
        'installed_by',
        'installed_at',
    ];

    /**
     * The attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'installed_at' => 'datetime',
        ];
    }

    /**
     * Get the user who installed this application.
     */
    public function installer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'installed_by');
    }

    /**
     * Check if this application is running.
     */
    public function isRunning(): bool
    {
        return $this->status === 'running';
    }

    /**
     * Check if this application has an update available.
     */
    public function hasUpdate(): bool
    {
        return $this->available_version !== null
            && $this->available_version !== $this->installed_version;
    }

    /**
     * Scope to only running applications.
     */
    public function scopeRunning($query)
    {
        return $query->where('status', 'running');
    }

    /**
     * Scope to only stopped applications.
     */
    public function scopeStopped($query)
    {
        return $query->where('status', 'stopped');
    }
}
