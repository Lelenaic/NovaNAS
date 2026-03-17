<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Temporary storage for the plain password before it's hashed.
     */
    protected ?string $plainPassword = null;

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
        'samba_password',
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
        'plainPassword',
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
     * Set the user's password and generate Samba password hash.
     *
     * @param string $value
     * @return void
     */
    public function setPasswordAttribute(string $value): void
    {
        // Store the plain password before hashing for Samba hash generation
        // Check if the value is already hashed (starts with $2y$ or $2a$)
        if (preg_match('/^\$2[ayb]\$/', $value)) {
            // Password is already hashed, we can't generate Samba hash
            $this->attributes['password'] = $value;
            $this->plainPassword = null;
        } else {
            // Plain password - store it for Samba hash generation
            $this->plainPassword = $value;
            $this->attributes['password'] = $value;
        }
    }

    /**
     * The "booted" method of the model.
     */
    protected static function booted(): void
    {
        static::saved(function (User $user) {
            // Generate Samba password after the model is saved
            // At this point, the password has been hashed and we have the plain password
            if ($user->plainPassword) {
                $user->samba_password = $user->generateSambaPassword($user->plainPassword);
                $user->plainPassword = null;
                $user->saveQuietly();
            }
        });
    }

    /**
     * Generate a Samba NT (MD4) password hash from the user's password.
     *
     * @param string $password
     * @return string
     */
    public function generateSambaPassword(string $password): string
    {
        if (empty($password)) {
            return '';
        }

        // Convert UTF-8 to UTF-16LE
        $unicode = iconv('UTF-8', 'UTF-16LE', $password);

        // Compute MD4 hash, uppercase hex
        return strtoupper(bin2hex(hash('md4', $unicode, true)));
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
