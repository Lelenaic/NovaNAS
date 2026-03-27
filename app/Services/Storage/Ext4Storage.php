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
     * Create a new EXT4 volume (format + mount).
     *
     * @param  array{
     *     device: string,
     *     mountpoint: string,
     *     persist_fstab?: bool
     * }  $config
     * @return array{success: bool, message: string, pool: string}
     *
     * @throws \RuntimeException on failure
     */
    public function createPool(array $config): array
    {
        $device = $config['device'] ?? '';
        $mountpoint = $config['mountpoint'] ?? '';
        $persistFstab = (bool) ($config['persist_fstab'] ?? true);

        if (empty($device)) {
            throw new \RuntimeException('Device is required.');
        }

        if (empty($mountpoint)) {
            throw new \RuntimeException('Mount point is required.');
        }

        if (! str_starts_with($device, '/dev/')) {
            $device = '/dev/'.$device;
        }

        // Create mountpoint directory
        $result = Process::run('mkdir -p '.escapeshellarg($mountpoint));
        if ($result->failed()) {
            throw new \RuntimeException('Failed to create mount directory: '.$result->errorOutput());
        }

        // Format the device with ext4
        $result = Process::run('mkfs.ext4 -F '.escapeshellarg($device).' 2>&1');
        if ($result->failed()) {
            throw new \RuntimeException('Failed to format device: '.$result->output());
        }

        // Mount the device
        $result = Process::run('mount '.escapeshellarg($device).' '.escapeshellarg($mountpoint));
        if ($result->failed()) {
            throw new \RuntimeException('Failed to mount device: '.$result->errorOutput());
        }

        // Persist to /etc/fstab
        if ($persistFstab) {
            $uuid = $this->getDeviceUuid($device);
            $entry = $uuid
                ? "UUID={$uuid} {$mountpoint} ext4 defaults 0 2"
                : "{$device} {$mountpoint} ext4 defaults 0 2";

            $escapedEntry = escapeshellarg($entry);
            Process::run("echo {$escapedEntry} >> /etc/fstab");
        }

        return [
            'success' => true,
            'message' => "EXT4 volume on '{$device}' created and mounted at '{$mountpoint}'.",
            'pool' => basename($mountpoint),
        ];
    }

    /**
     * Get the UUID of a block device.
     */
    protected function getDeviceUuid(string $device): ?string
    {
        $result = Process::run('blkid -s UUID -o value '.escapeshellarg($device));

        if ($result->successful()) {
            $uuid = trim($result->output());

            return $uuid !== '' ? $uuid : null;
        }

        return null;
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
