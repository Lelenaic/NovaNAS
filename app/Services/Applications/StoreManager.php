<?php

namespace App\Services\Applications;

use App\Contracts\StoreProviderInterface;
use App\Services\Applications\Providers\CasaOSStoreProvider;
use Illuminate\Support\Manager;

/**
 * Application Store Manager
 *
 * Manages multiple app store providers using the Laravel Manager pattern.
 * Each store provider (CasaOS, TrueNAS, etc.) is registered as a driver.
 */
class StoreManager extends Manager
{
    /**
     * Get the default store provider name.
     */
    public function getDefaultDriver(): string
    {
        return config('applications.default_store', 'casaos');
    }

    /**
     * Create a CasaOS store provider instance.
     */
    public function createCasaosDriver(): StoreProviderInterface
    {
        $baseUrl = config('applications.stores.casaos.base_url', '');

        return new CasaOSStoreProvider($baseUrl);
    }

    /**
     * Register a custom store provider.
     */
    public function registerProvider(string $name, callable $driver): void
    {
        $this->drivers[$name] = $driver;
    }

    /**
     * Get all configured store providers.
     *
     * @return array<string, StoreProviderInterface>
     */
    public function getAllProviders(): array
    {
        $providers = [];
        $stores = config('applications.stores', []);

        foreach ($stores as $name => $config) {
            if (is_array($config) && ($config['enabled'] ?? true)) {
                $providers[$name] = $this->driver($name);
            }
        }

        return $providers;
    }

    /**
     * Get the config file name for the manager.
     */
    protected function getConfigManagerName(): string
    {
        return 'applications';
    }
}
