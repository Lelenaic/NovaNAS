<?php

namespace App\Models;

use App\Contracts\DynDNSProviderInterface;
use App\Services\DynDNS\DynDNSProviderManager;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * DynDNS Configuration Model
 *
 * @property int $id
 * @property string $provider
 * @property string $name
 * @property string $subdomain
 * @property string $token
 * @property int $interval_minutes
 * @property bool $is_enabled
 * @property \Illuminate\Support\Carbon|null $last_updated_at
 * @property string|null $last_ip
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read string $full_domain
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DynDnsConfig enabled()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DynDnsConfig forProvider(string $provider)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DynDnsConfig newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DynDnsConfig newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DynDnsConfig query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DynDnsConfig whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DynDnsConfig whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DynDnsConfig whereIntervalMinutes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DynDnsConfig whereIsEnabled($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DynDnsConfig whereLastIp($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DynDnsConfig whereLastUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DynDnsConfig whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DynDnsConfig whereProvider($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DynDnsConfig whereSubdomain($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DynDnsConfig whereToken($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DynDnsConfig whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
class DynDnsConfig extends Model
{
    use HasFactory;

    protected $table = 'dyndns_configs';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'provider',
        'name',
        'subdomain',
        'token',
        'interval_minutes',
        'is_enabled',
        'last_updated_at',
        'last_ip',
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
            'interval_minutes' => 'integer',
            'last_updated_at' => 'datetime',
        ];
    }

    /**
     * The attributes that should be encrypted.
     */
    protected function token(): Attribute
    {
        return Attribute::make(
            get: fn (string $value) => decrypt($value),
            set: fn (string $value) => encrypt($value),
        );
    }

    /**
     * Get the base domain for NovaNAS provider.
     */
    protected function getNovaBaseDomain(): string
    {
        return config('services.novanas.base_domain');
    }

    /**
     * Get the full domain (subdomain.provider TLD).
     */
    public function getFullDomainAttribute(): string
    {
        return match ($this->provider) {
            'novanas' => $this->subdomain.'.'.$this->getNovaBaseDomain(),
            'duckdns' => $this->subdomain.'.duckdns.org',
            default => $this->subdomain,
        };
    }

    /**
     * Get the provider instance.
     */
    public function getProviderInstance(): DynDNSProviderInterface
    {
        $manager = app(DynDNSProviderManager::class);

        return $manager->getProvider($this->provider);
    }

    /**
     * Register a new DNS record with the provider (for NovaNAS).
     *
     * @return array{success: bool, token?: string, message: string}
     */
    public function registerDns(): array
    {
        $provider = $this->getProviderInstance();

        $result = $provider->register([
            'subdomain' => $this->subdomain,
        ]);

        if ($result['success'] && isset($result['token'])) {
            // Store the token returned from the API
            $this->token = $result['token'];
            $this->save();
        }

        return $result;
    }

    /**
     * Perform the DNS update.
     *
     * @return array{success: bool, message: string}
     */
    public function updateDns(): array
    {
        $provider = $this->getProviderInstance();

        $result = $provider->update([
            'subdomain' => $this->subdomain,
            'token' => $this->token,
        ]);

        if ($result['success']) {
            $this->last_updated_at = now();

            if (isset($result['ip'])) {
                $this->last_ip = $result['ip'];
            }

            $this->save();
        }

        return $result;
    }

    /**
     * Sync configuration changes to the remote provider.
     *
     * @param  string  $oldSubdomain  The original subdomain before the change
     * @param  array{subdomain?: string, token?: string}  $changes  The changes to sync
     * @return array{success: bool, message: string}
     */
    public function syncConfig(string $oldSubdomain, array $changes): array
    {
        $provider = $this->getProviderInstance();

        $updateData = [
            'subdomain' => $oldSubdomain,
            'token' => $this->token,
        ];

        // If subdomain is being changed, pass it as new_subdomain
        if (! empty($changes['subdomain'])) {
            $updateData['new_subdomain'] = $changes['subdomain'];
        }

        $result = $provider->update($updateData);

        return $result;
    }

    /**
     * Delete the DNS record from the remote provider.
     *
     * @return array{success: bool, message: string}
     */
    public function deleteDns(): array
    {
        $provider = $this->getProviderInstance();

        $result = $provider->delete([
            'subdomain' => $this->subdomain,
            'token' => $this->token,
        ]);

        return $result;
    }

    /**
     * Scope to get only enabled configs.
     */
    public function scopeEnabled($query)
    {
        return $query->where('is_enabled', true);
    }

    /**
     * Scope to get configs by provider.
     */
    public function scopeForProvider($query, string $provider)
    {
        return $query->where('provider', $provider);
    }
}
