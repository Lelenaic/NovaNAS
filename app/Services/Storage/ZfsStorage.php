<?php

namespace App\Services\Storage;

use App\Contracts\StorageInterface;
use Illuminate\Support\Facades\Process;

/**
 * ZFS storage backend implementation.
 *
 * This class handles all ZFS-specific storage operations including
 * pool management, filesystem operations, and property queries.
 */
class ZfsStorage implements StorageInterface
{
    /**
     * Check if ZFS is available on the system.
     */
    public function isAvailable(): bool
    {
        $result = Process::run('which zfs');

        return $result->successful();
    }

    /**
     * List all ZFS pools.
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
    public function listPools(): array
    {
        if (! $this->isAvailable()) {
            return [];
        }

        $result = Process::run('zpool list -Hp -o name,size,allocated,free,health');

        if ($result->failed()) {
            return [];
        }

        $pools = [];
        $lines = explode("\n", trim($result->output()));

        foreach ($lines as $line) {
            if (empty(trim($line))) {
                continue;
            }

            $parts = preg_split('/\s+/', $line);

            if (count($parts) >= 5) {
                $poolName = $parts[0];
                $mountpoint = $this->getMountpoint($poolName);

                $pools[] = [
                    'name' => $poolName,
                    'size' => (int) $parts[1],
                    'allocated' => (int) $parts[2],
                    'free' => (int) $parts[3],
                    'health' => $parts[4],
                    'mountpoint' => $mountpoint,
                    'isSystem' => false,
                    'device' => null,
                ];
            }
        }

        return $pools;
    }

    /**
     * Get the mountpoint for a ZFS pool or dataset.
     */
    public function getMountpoint(string $poolOrDataset): ?string
    {
        $result = Process::run('zfs get -Hp -o value mountpoint '.escapeshellarg($poolOrDataset));

        if ($result->failed()) {
            return null;
        }

        $mountpoint = trim($result->output());

        // 'none' means the pool is not mounted
        if ($mountpoint === 'none' || empty($mountpoint)) {
            return null;
        }

        return $mountpoint;
    }

    /**
     * Get detailed information about a specific ZFS pool.
     *
     * @param  string  $pool  The pool name
     */
    public function getPoolInfo(string $pool): ?array
    {
        $result = Process::run('zpool list -Hp -o name,size,allocated,free,health,cap,altroot '.escapeshellarg($pool));

        if ($result->failed()) {
            return null;
        }

        $lines = explode("\n", trim($result->output()));

        if (empty($lines[0])) {
            return null;
        }

        $parts = preg_split('/\s+/', $lines[0]);

        if (count($parts) < 5) {
            return null;
        }

        $mountpoint = $this->getMountpoint($pool);

        return [
            'name' => $parts[0],
            'size' => (int) $parts[1],
            'allocated' => (int) $parts[2],
            'free' => (int) $parts[3],
            'health' => $parts[4],
            'capacity' => isset($parts[5]) ? (int) $parts[5] : 0,
            'altroot' => isset($parts[6]) && $parts[6] !== '-' ? $parts[6] : null,
            'mountpoint' => $mountpoint,
        ];
    }

    /**
     * Get all ZFS datasets within a pool.
     *
     * @return array<int, array{
     *     name: string,
     *     used: int,
     *     available: int,
     *     refer: int,
     *     mountpoint: string|null,
     *     compression: string,
     *     checksum: string
     * }>
     */
    public function listDatasets(string $pool): array
    {
        $result = Process::run('zfs list -Hp -r -o name,used,available,refer,mountpoint,compression,checksum '.escapeshellarg($pool));

        if ($result->failed()) {
            return [];
        }

        $datasets = [];
        $lines = explode("\n", trim($result->output()));

        foreach ($lines as $line) {
            if (empty(trim($line))) {
                continue;
            }

            $parts = preg_split('/\s+/', $line);

            // Skip the pool itself (datasets are children)
            if (count($parts) >= 5 && $parts[0] !== $pool) {
                $datasets[] = [
                    'name' => $parts[0],
                    'used' => (int) $parts[1],
                    'available' => (int) $parts[2],
                    'refer' => (int) $parts[3],
                    'mountpoint' => $parts[4] !== '-' ? $parts[4] : null,
                    'compression' => $parts[5] ?? 'off',
                    'checksum' => $parts[6] ?? 'fletcher4',
                ];
            }
        }

        return $datasets;
    }

    /**
     * Get the health status of a pool.
     */
    public function getHealth(string $pool): ?string
    {
        $result = Process::run('zpool list -Hp -o health '.escapeshellarg($pool));

        if ($result->failed()) {
            return null;
        }

        return trim($result->output()) ?: null;
    }

    /**
     * Get ZFS properties for a pool or dataset.
     *
     * @return array<string, string>
     */
    public function getProperties(string $poolOrDataset): array
    {
        $result = Process::run('zfs get all -Hp '.escapeshellarg($poolOrDataset));

        if ($result->failed()) {
            return [];
        }

        $properties = [];
        $lines = explode("\n", trim($result->output()));

        foreach ($lines as $line) {
            $parts = preg_split('/\s+/', $line, 3);

            if (count($parts) >= 3) {
                $properties[$parts[1]] = $parts[2];
            }
        }

        return $properties;
    }

    /**
     * Get the list of physical disk names used by a ZFS pool.
     *
     * Uses the pool GUID from `zpool list` and cross-references with partition
     * UUIDs from lsblk to identify which physical disks belong to the pool.
     *
     * @return array<int, string>
     */
    public function getPoolDisks(string $pool): array
    {
        // Get pool GUID
        $result = Process::run('zpool list -Hp -o guid '.escapeshellarg($pool));
        if ($result->failed()) {
            return [];
        }
        $poolGuid = trim($result->output());
        if (empty($poolGuid)) {
            return [];
        }

        // Get all block devices with their fstype and UUID
        $result = Process::run('lsblk -o NAME,FSTYPE,UUID --json');
        if ($result->failed()) {
            return [];
        }

        $data = json_decode($result->output(), true);
        if (! $data || ! isset($data['blockdevices'])) {
            return [];
        }

        $disks = [];

        foreach ($data['blockdevices'] as $device) {
            $diskName = $device['name'];

            // Check if the disk itself is a zfs_member with matching UUID
            if (($device['fstype'] ?? '') === 'zfs_member' && ($device['uuid'] ?? '') === $poolGuid) {
                $disks[] = $diskName;

                continue;
            }

            // Check partitions (children) for zfs_member with matching UUID
            if (isset($device['children'])) {
                foreach ($device['children'] as $part) {
                    if (($part['fstype'] ?? '') === 'zfs_member' && ($part['uuid'] ?? '') === $poolGuid) {
                        $disks[] = $diskName;
                        break;
                    }
                }
            }
        }

        return array_unique($disks);
    }

    /**
     * Create a new ZFS pool.
     *
     * Supported vdev types: stripe, mirror, raidz, raidz2.
     *
     * @param  array{
     *     name: string,
     *     disks: string[],
     *     vdev_type: string,
     *     mountpoint?: string
     * }  $config
     * @return array{success: bool, message: string, pool: string}
     *
     * @throws \RuntimeException on failure
     */
    public function createPool(array $config): array
    {
        $name = $config['name'];
        $disks = $config['disks'];
        $vdevType = $config['vdev_type'];
        $mountpoint = $config['mountpoint'] ?? null;

        if (empty($name)) {
            throw new \RuntimeException('Pool name is required.');
        }

        if (empty($disks)) {
            throw new \RuntimeException('At least one disk is required.');
        }

        $minDisks = match ($vdevType) {
            'stripe' => 1,
            'mirror' => 2,
            'raidz' => 3,
            'raidz2' => 4,
            default => throw new \RuntimeException("Unknown vdev type: {$vdevType}"),
        };

        if (count($disks) < $minDisks) {
            throw new \RuntimeException(
                "{$vdevType} requires at least {$minDisks} disk(s), but only ".count($disks).' provided.'
            );
        }

        $diskPaths = array_map(fn ($d) => '/dev/'.$d, $disks);

        $parts = ['sudo', 'zpool', 'create'];

        if ($mountpoint) {
            $parts[] = '-m';
            $parts[] = escapeshellarg($mountpoint);
        }

        $parts[] = escapeshellarg($name);

        if ($vdevType !== 'stripe') {
            $parts[] = $vdevType;
        }

        foreach ($diskPaths as $disk) {
            $parts[] = escapeshellarg($disk);
        }

        $cmd = implode(' ', $parts);
        $result = Process::run($cmd);

        if ($result->failed()) {
            throw new \RuntimeException('Failed to create ZFS pool: '.$result->errorOutput());
        }

        return [
            'success' => true,
            'message' => "ZFS pool '{$name}' created successfully.",
            'pool' => $name,
        ];
    }

    /**
     * Get I/O statistics for a pool.
     *
     * @return array{
     *     readOps: int,
     *     writeOps: int,
     *     readBytes: int,
     *     writeBytes: int
     * }|null
     */
    public function getIoStats(string $pool): ?array
    {
        $result = Process::run('zpool iostat -Hp '.escapeshellarg($pool).' 1');

        if ($result->failed()) {
            return null;
        }

        $lines = explode("\n", trim($result->output()));

        // Skip header line, get data line
        if (count($lines) < 2) {
            return null;
        }

        $parts = preg_split('/\s+/', $lines[1]);

        if (count($parts) < 5) {
            return null;
        }

        return [
            'readOps' => (int) $parts[1],
            'writeOps' => (int) $parts[2],
            'readBytes' => (int) $parts[3],
            'writeBytes' => (int) $parts[4],
        ];
    }

    /**
     * Unmount a ZFS pool and disable its mountpoint.
     *
     * @param  string  $pool  The pool name
     * @return array{success: bool, message: string}
     *
     * @throws \RuntimeException on failure
     */
    public function unmount(string $pool): array
    {
        if (! $this->isAvailable()) {
            throw new \RuntimeException('ZFS is not available on this system.');
        }

        $info = $this->getPoolInfo($pool);
        if ($info === null) {
            throw new \RuntimeException("ZFS pool '{$pool}' not found.");
        }

        // Set mountpoint to 'none' which effectively unmounts the pool
        $result = Process::run('sudo zfs set mountpoint=none '.escapeshellarg($pool));
        if ($result->failed()) {
            throw new \RuntimeException('Failed to unmount ZFS pool: '.$result->errorOutput());
        }

        return [
            'success' => true,
            'message' => "ZFS pool '{$pool}' has been unmounted.",
        ];
    }

    /**
     * Mount a ZFS pool at the specified path.
     *
     * @param  string  $pool  The pool name
     * @param  string  $mountpoint  Where to mount
     * @return array{success: bool, message: string}
     *
     * @throws \RuntimeException on failure
     */
    public function mount(string $pool, string $mountpoint): array
    {
        if (! $this->isAvailable()) {
            throw new \RuntimeException('ZFS is not available on this system.');
        }

        $info = $this->getPoolInfo($pool);
        if ($info === null) {
            throw new \RuntimeException("ZFS pool '{$pool}' not found.");
        }

        $result = Process::run('sudo zfs set mountpoint='.escapeshellarg($mountpoint).' '.escapeshellarg($pool));
        if ($result->failed()) {
            throw new \RuntimeException('Failed to mount ZFS pool: '.$result->errorOutput());
        }

        return [
            'success' => true,
            'message' => "ZFS pool '{$pool}' has been mounted at '{$mountpoint}'.",
        ];
    }

    /**
     * Permanently destroy a ZFS pool and all its data.
     *
     * @param  string  $pool  The pool name
     * @return array{success: bool, message: string}
     *
     * @throws \RuntimeException on failure
     */
    public function deletePool(string $pool): array
    {
        if (! $this->isAvailable()) {
            throw new \RuntimeException('ZFS is not available on this system.');
        }

        $info = $this->getPoolInfo($pool);
        if ($info === null) {
            throw new \RuntimeException("ZFS pool '{$pool}' not found.");
        }

        $result = Process::run('sudo zpool destroy '.escapeshellarg($pool));
        if ($result->failed()) {
            throw new \RuntimeException('Failed to destroy ZFS pool: '.$result->errorOutput());
        }

        return [
            'success' => true,
            'message' => "ZFS pool '{$pool}' has been permanently destroyed.",
        ];
    }
}
