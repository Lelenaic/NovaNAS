<?php

namespace App\Services\GPU;

use App\Contracts\GPUInterface;
use App\Services\GPU\Providers\NvidiaGPU;
use Illuminate\Support\Manager;

/**
 * Manager for GPU providers.
 *
 * This class handles provider registration and resolution.
 * It follows the Laravel Manager pattern similar to DynDNSProviderManager.
 */
class GPUManager extends Manager
{
    /**
     * Get the default driver name.
     */
    public function getDefaultDriver(): string
    {
        return 'nvidia';
    }

    /**
     * Create the NVIDIA driver.
     */
    protected function createNvidiaDriver(): GPUInterface
    {
        return new NvidiaGPU();
    }

    /**
     * Register a custom GPU provider.
     */
    public function registerProvider(string $name, callable $driver): void
    {
        $this->drivers[$name] = $driver;
    }

    /**
     * Get a GPU provider by name.
     */
    public function getProvider(string $name): GPUInterface
    {
        return $this->driver($name);
    }

    /**
     * Get all available GPU provider names.
     *
     * @return array<string, string>
     */
    public function getAvailableProviders(): array
    {
        return [
            'nvidia' => 'NVIDIA',
        ];
    }

    /**
     * Check if any GPU is available on the system.
     */
    public function hasGpuAvailable(): bool
    {
        // Try to detect available GPU providers
        foreach ($this->getAvailableProviders() as $name => $displayName) {
            $provider = $this->driver($name);
            if ($provider->isDriverInstalled() && count($provider->listGpus()) > 0) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get all GPUs from all available providers.
     *
     * @return array<string, array<int, array>>
     */
    public function getAllGpus(): array
    {
        $results = [];

        foreach ($this->getAvailableProviders() as $name => $displayName) {
            $provider = $this->driver($name);
            if ($provider->isDriverInstalled()) {
                $gpus = $provider->listGpus();
                if (count($gpus) > 0) {
                    $results[$name] = [
                        'display_name' => $displayName,
                        'gpus' => $gpus,
                    ];
                }
            }
        }

        return $results;
    }

    /**
     * Get driver status for all providers.
     *
     * @return array<string, array{name: string, installed: bool, driver_version: ?string, gpu_count: int}>
     */
    public function getDriverStatus(): array
    {
        $status = [];

        foreach ($this->getAvailableProviders() as $name => $displayName) {
            $provider = $this->driver($name);
            $installed = $provider->isDriverInstalled();
            $gpus = $installed ? $provider->listGpus() : [];

            $status[$name] = [
                'name' => $displayName,
                'installed' => $installed,
                'driver_version' => $installed ? $provider->getDriverVersion() : null,
                'gpu_count' => count($gpus),
            ];
        }

        return $status;
    }
}
