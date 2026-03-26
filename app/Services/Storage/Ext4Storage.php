<?php

namespace App\Services\Storage;

use App\Contracts\StorageInterface;
use Illuminate\Support\Facades\Process;

/**
 * EXT4 storage backend implementation.
 *
 * This class handles EXT4 filesystem operations including listing
 * mounted EXT4 volumes and querying disk usage.
 */
class Ext4Storage implements StorageInterface
{
    /**
     * Check if EXT4 support is available on the system.
     */
    public function isAvailable(): bool
    {
        $result = Process::run('which df');

        return $result->successful();
    }

    /**
     * List all mounted EXT4 filesystems (volumes).
     *
     * @return array<int, array{
     *     name: string,
     *     size: int,
     *     allocated: int,
     *     free: int,
     *     health: string,
     *     mountpoint: string|null
     * }>
     */
    public function listPools(): array
    {
        if (! $this->isAvailable()) {
            return [];
        }

        $result = Process::run('df -B1 -t ext4 --output=source,size,used,avail,target');

        if ($result->failed()) {
            return [];
        }

        $volumes = [];
        $lines = explode("\n", trim($result->output()));

        // Skip header line
        array_shift($lines);

        foreach ($lines as $line) {
            if (empty(trim($line))) {
                continue;
            }

            $parts = preg_split('/\s+/', trim($line));

            if (count($parts) < 5) {
                continue;
            }

            $device = $parts[0];

            // Skip non-block devices (tmpfs, etc.)
            if (! str_starts_with($device, '/dev/')) {
                continue;
            }

            $mountpoint = $parts[4];

            // Skip pseudo mountpoints
            if ($mountpoint === '/boot/efi' || $mountpoint === '/boot') {
                continue;
            }

            $name = basename($mountpoint);
            if ($name === '/' || $name === '') {
                $name = $device;
            }

            $volumes[] = [
                'name' => $name,
                'device' => $device,
                'size' => (int) $parts[1],
                'allocated' => (int) $parts[2],
                'free' => (int) $parts[3],
                'health' => 'ONLINE',
                'mountpoint' => $mountpoint,
                'isSystem' => $mountpoint === '/',
            ];
        }

        return $volumes;
    }

    /**
     * Get detailed information about a specific EXT4 volume.
     *
     * @param  string  $pool  The device path or mountpoint name
     */
    public function getPoolInfo(string $pool): ?array
    {
        $pools = $this->listPools();

        foreach ($pools as $p) {
            if ($p['name'] === $pool || $p['device'] === $pool || $p['mountpoint'] === $pool) {
                return $p;
            }
        }

        return null;
    }

    /**
     * Get the mountpoint for a device or volume name.
     */
    public function getMountpoint(string $poolOrDataset): ?string
    {
        $result = Process::run("findmnt -n -o TARGET {$poolOrDataset}");

        if ($result->failed()) {
            return null;
        }

        return trim($result->output()) ?: null;
    }

    /**
     * Get the health status of a volume.
     */
    public function getHealth(string $pool): ?string
    {
        return 'ONLINE';
    }

    /**
     * Get filesystem properties.
     *
     * @return array<string, string>
     */
    public function getProperties(string $poolOrDataset): array
    {
        return [];
    }
}
