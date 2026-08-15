<?php

namespace App\Contracts;

/**
 * Interface for storage backend implementations.
 *
 * This interface defines the contract that storage backends (ZFS, EXT4, etc.)
 * must implement. Each filesystem type has its own implementation class.
 *
 * Note: General storage operations (like listing physical disks) are handled
 * by StorageService directly, not through this interface.
 */
interface StorageInterface
{
    /**
     * Check if the storage backend is available on the system.
     */
    public function isAvailable(): bool;

    /**
     * List all storage pools/volumes managed by this backend.
     *
     * For ZFS, this returns pools.
     * For EXT4, this would return mounted filesystems.
     *
     * @return array<int, array{
     *     name: string,
     *     size: int,
     *     allocated: int,
     *     free: int,
     *     health: string,
     *     mountpoint: string|null,
     *     isSystem: bool|null,
     *     device: string|null
     * }>
     */
    public function listPools(): array;

    /**
     * Get detailed information about a specific pool/volume.
     *
     * @param  string  $pool  The pool/volume name
     */
    public function getPoolInfo(string $pool): ?array;

    /**
     * Get the mountpoint for a storage pool or dataset.
     */
    public function getMountpoint(string $poolOrDataset): ?string;

    /**
     * Get the health status of a pool.
     */
    public function getHealth(string $pool): ?string;

    /**
     * Get properties for a pool or dataset.
     *
     * @return array<string, string>
     */
    public function getProperties(string $poolOrDataset): array;

    /**
     * Create a new storage pool or volume.
     *
     * The configuration array is filesystem-specific but typically contains:
     * - name: string (pool/volume name)
     * - disks: string[] (device paths, e.g. ['/dev/sdb', '/dev/sdc'])
     * - mountpoint: string (where to mount)
     *
     * Additional keys may be present depending on the filesystem type.
     *
     * @param  array<string, mixed>  $config  Pool creation configuration
     * @return array{success: bool, message: string, pool: string}
     *
     * @throws \RuntimeException on failure
     */
    public function createPool(array $config): array;

    /**
     * Unmount a pool or volume and remove its /etc/fstab automount entry.
     *
     * For ZFS, this unmounts the pool/dataset mountpoint.
     * For EXT4, this unmounts the device and removes the fstab line.
     *
     * @param  string  $pool  The pool/volume name
     * @return array{success: bool, message: string}
     *
     * @throws \RuntimeException on failure
     */
    public function unmount(string $pool): array;

    /**
     * Mount a pool or volume at the specified mountpoint.
     *
     * For ZFS, this sets the pool's mountpoint property.
     * For EXT4, this creates the directory and mounts the device, optionally
     * adding an entry to /etc/fstab.
     *
     * @param  string  $pool  The pool/volume name or device path
     * @param  string  $mountpoint  Where to mount
     * @return array{success: bool, message: string}
     *
     * @throws \RuntimeException on failure
     */
    public function mount(string $pool, string $mountpoint): array;

    /**
     * Permanently delete a pool or volume (destroys all data).
     *
     * For ZFS, this runs `zpool destroy`.
     * For EXT4, this unmounts and wipes the filesystem.
     *
     * @param  string  $pool  The pool/volume name
     * @return array{success: bool, message: string}
     *
     * @throws \RuntimeException on failure
     */
    public function deletePool(string $pool): array;
}
