<?php

namespace App\Services;

use App\Models\Setting;
use App\Services\Storage\StorageService;

/**
 * Settings Service
 *
 * Manages key-value settings stored in the database and provides
 * utility methods for directory listing in storage pools.
 */
class SettingsService
{
    /**
     * Get a setting value by key.
     */
    public function get(string $key): ?string
    {
        return Setting::getValue($key);
    }

    /**
     * Set a setting value by key.
     */
    public function set(string $key, ?string $value = null): Setting
    {
        return Setting::setValue($key, $value);
    }

    /**
     * Get multiple settings by keys.
     *
     * @param  array<string>  $keys
     * @return array<string, string|null>
     */
    public function getMultiple(array $keys): array
    {
        return Setting::getMultiple($keys);
    }

    /**
     * List directories in a storage pool's mountpoint.
     *
     * @return array<int, array{
     *     name: string,
     *     path: string,
     *     isDirectory: bool
     * }>
     */
    public function listDirectoriesInPool(string $poolName, string $username): array
    {
        $storageService = new StorageService;
        $pools = $storageService->listPools();

        $pool = collect($pools)->firstWhere('name', $poolName);

        if (! $pool || ! $pool['mountpoint']) {
            return [];
        }

        return $this->listDirectories($pool['mountpoint'], $username);
    }

    /**
     * List directories in a given path.
     *
     * @return array<int, array{
     *     name: string,
     *     path: string,
     *     isDirectory: bool
     * }>
     */
    public function listDirectories(string $path, string $username): array
    {
        $fileService = new FileService;

        return $fileService->listDirectory($path, $username);
    }

    /**
     * Check if a path is within a storage pool.
     */
    public function isPathInPool(string $path, string $poolName): bool
    {
        $storageService = new StorageService;
        $pools = $storageService->listPools();
        $pool = collect($pools)->firstWhere('name', $poolName);

        if (! $pool || ! $pool['mountpoint']) {
            return false;
        }

        return str_starts_with($path, $pool['mountpoint']);
    }
}
