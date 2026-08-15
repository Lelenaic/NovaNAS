<?php

namespace App\Models;

use App\Services\SambaService;
use Carbon\Carbon;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Hash;

/**
 * @property Carbon|null $invitation_expires_at
 */
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'username',
        'email',
        'password',
        'invitation_token',
        'invitation_expires_at',
        'status',
        'password_set_at',
        'is_admin',
        'file_manager_layout',
        'show_hidden_files',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'invitation_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'invitation_expires_at' => 'datetime',
            'password_set_at' => 'datetime',
            'is_admin' => 'boolean',
            'show_hidden_files' => 'boolean',
        ];
    }

    /**
     * Store the plain password before hashing for Samba sync.
     * This attribute is not persisted to database.
     */
    protected ?string $plainPasswordForSamba = null;

    /**
     * Set the user's password attribute.
     *
     * This mutator captures and hashes the plain password, storing it in a
     * temporary attribute for Samba sync before the hashed version is saved.
     */
    public function setPasswordAttribute(mixed $value): void
    {
        // Store the plain password before hashing for Samba sync
        if ($value !== null) {
            $this->plainPasswordForSamba = $value;
            // Hash the password ourselves instead of relying on the 'hashed' cast
            // This ensures it works correctly with update() method
            $this->attributes['password'] = Hash::make($value);
        } else {
            $this->attributes['password'] = null;
        }
    }

    /**
     * Get the plain password stored for Samba sync.
     */
    public function getPlainPasswordForSamba(): ?string
    {
        return $this->plainPasswordForSamba;
    }

    /**
     * The "booted" method of the model.
     * Syncs password to Samba when password is changed.
     */
    protected static function booted(): void
    {
        // After creation, sync to Samba
        static::created(function (User $user) {
            // Use the plain password captured by the setter
            $plainPassword = $user->getPlainPasswordForSamba();
            if ($plainPassword && $user->username) {
                try {
                    $samba = app(SambaService::class);
                    $samba->updatePassword($user->username, $plainPassword);
                    \Log::info("Samba password synced successfully for user: {$user->username}");
                } catch (\RuntimeException $e) {
                    \Log::warning("Failed to sync password to Samba: {$e->getMessage()}");
                }
            }
            // Clear the plain password after sync
            $user->plainPasswordForSamba = null;
        });

        // After update, sync to Samba
        static::updated(function (User $user) {
            // Use the plain password captured by the setter
            $plainPassword = $user->getPlainPasswordForSamba();
            if ($plainPassword && $user->username && $user->wasChanged('password')) {
                try {
                    $samba = app(SambaService::class);
                    $samba->updatePassword($user->username, $plainPassword);
                    \Log::info("Samba password synced successfully for user: {$user->username}");
                } catch (\RuntimeException $e) {
                    \Log::warning("Failed to sync password to Samba: {$e->getMessage()}");
                }
            }
            // Clear the plain password after sync
            $user->plainPasswordForSamba = null;
        });
    }

    /**
     * Scope a query to only include pending (invited) users.
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    /**
     * Scope a query to only include active users.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Check if the user is pending (invited but hasn't set password).
     */
    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    /**
     * Check if the user is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /**
     * Check if the invitation has expired.
     */
    public function isInvitationExpired(): bool
    {
        if (! $this->invitation_expires_at) {
            return false;
        }

        return $this->invitation_expires_at->isPast();
    }

    /**
     * Check if the user can set their password (valid invitation).
     */
    public function canSetPassword(): bool
    {
        return $this->isPending() && ! $this->isInvitationExpired();
    }
}
