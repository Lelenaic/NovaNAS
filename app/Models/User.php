<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use App\Services\SambaService;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
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
            'password' => 'hashed',
            'invitation_expires_at' => 'datetime',
            'password_set_at' => 'datetime',
            'is_admin' => 'boolean',
        ];
    }

    /**
     * The "booted" method of the model.
     * Syncs password to Samba when password is changed.
     */
    protected static function booted(): void
    {
        // Capture password before it's set on the model during creation
        static::creating(function (User $user) {
            if (isset($user->attributes['password']) && $user->username) {
                // Store plain password temporarily for sync after creation
                $user->setRelation('plainPassword', $user->attributes['password']);
            }
        });

        // Capture password before it's set on the model during update
        static::updating(function (User $user) {
            if (isset($user->attributes['password']) && $user->isDirty('password') && $user->username) {
                // Get the original password from the dirty array
                $plainPassword = $user->attributes['password'];
                // Store plain password temporarily for sync after update
                $user->setRelation('plainPassword', $plainPassword);
            }
        });

        // After creation, sync to Samba
        static::created(function (User $user) {
            $plainPassword = $user->getRelation('plainPassword');
            if ($plainPassword && $user->username) {
                try {
                    $samba = app(SambaService::class);
                    $samba->updatePassword($user->username, $plainPassword);
                } catch (\RuntimeException $e) {
                    \Log::warning("Failed to sync password to Samba: {$e->getMessage()}");
                }
            }
        });

        // After update, sync to Samba
        static::updated(function (User $user) {
            $plainPassword = $user->getRelation('plainPassword');
            if ($plainPassword && $user->username && $user->wasChanged('password')) {
                try {
                    $samba = app(SambaService::class);
                    $samba->updatePassword($user->username, $plainPassword);
                } catch (\RuntimeException $e) {
                    \Log::warning("Failed to sync password to Samba: {$e->getMessage()}");
                }
            }
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
        if (!$this->invitation_expires_at) {
            return false;
        }

        return $this->invitation_expires_at->isPast();
    }

    /**
     * Check if the user can set their password (valid invitation).
     */
    public function canSetPassword(): bool
    {
        return $this->isPending() && !$this->isInvitationExpired();
    }
}
