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
     * List all EXT4 filesystems, both mounted and unmounted.
     *
     * Mounted volumes are discovered via `df`, unmounted ext4 block devices
     * are discovered via `lsblk` + `blkid`.
     *
     * @return array<int, array{
     *     name: string,
     *     device: string,
     *     size: int,
     *     allocated: int,
     *     free: int,
     *     health: string,
     *     mountpoint: string|null,
     *     isSystem: bool
     * }>
     */
    public function listPools(): array
    {
        if (! $this->isAvailable()) {
            return [];
        }

        $volumes = [];

        // 1) Mounted ext4 volumes via df
        $result = Process::run('df -B1 -t ext4 --output=source,size,used,avail,target');
        if ($result->successful()) {
            $lines = explode("\n", trim($result->output()));
            array_shift($lines); // skip header

            foreach ($lines as $line) {
                if (empty(trim($line))) {
                    continue;
                }

                $parts = preg_split('/\s+/', trim($line));
                if (count($parts) < 5) {
                    continue;
                }

                $device = $parts[0];
                if (! str_starts_with($device, '/dev/')) {
                    continue;
                }

                $mountpoint = $parts[4];
                if ($mountpoint === '/boot/efi' || $mountpoint === '/boot') {
                    continue;
                }

                $name = basename($mountpoint);
                if ($name === '/' || $name === '') {
                    $name = $device;
                }

                $volumes[$device] = [
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
        }

        // 2) Unmounted ext4 block devices via lsblk + blkid
        $blkResult = Process::run('lsblk -b -o NAME,FSTYPE,SIZE,MOUNTPOINT --json');
        if ($blkResult->successful()) {
            $data = json_decode($blkResult->output(), true);
            if ($data && isset($data['blockdevices'])) {
                foreach ($this->flattenLsblkDevices($data['blockdevices']) as $dev) {
                    $device = '/dev/'.$dev['name'];

                    // Skip if already listed as mounted
                    if (isset($volumes[$device])) {
                        continue;
                    }

                    // Only ext4, unmounted, not system partitions
                    if (($dev['fstype'] ?? '') !== 'ext4') {
                        continue;
                    }
                    if (! empty($dev['mountpoint'])) {
                        continue;
                    }

                    $volumes[$device] = [
                        'name' => $device,
                        'device' => $device,
                        'size' => (int) ($dev['size'] ?? 0),
                        'allocated' => 0,
                        'free' => (int) ($dev['size'] ?? 0),
                        'health' => 'UNMOUNTED',
                        'mountpoint' => null,
                        'isSystem' => false,
                    ];
                }
            }
        }

        return array_values($volumes);
    }

    /**
     * Flatten lsblk tree of block devices into a flat list including children.
     *
     * @return array<int, array{name: string, fstype: string|null, size: int, mountpoint: string|null}>
     */
    protected function flattenLsblkDevices(array $devices): array
    {
        $result = [];

        foreach ($devices as $device) {
            $result[] = [
                'name' => $device['name'],
                'fstype' => $device['fstype'] ?? null,
                'size' => (int) ($device['size'] ?? 0),
                'mountpoint' => $device['mountpoint'] ?? null,
            ];

            if (isset($device['children'])) {
                foreach ($device['children'] as $child) {
                    $result[] = [
                        'name' => $child['name'],
                        'fstype' => $child['fstype'] ?? null,
                        'size' => (int) ($child['size'] ?? 0),
                        'mountpoint' => $child['mountpoint'] ?? null,
                    ];
                }
            }
        }

        return $result;
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
        $result = Process::run("sudo findmnt -n -o TARGET {$poolOrDataset}");

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
        $result = Process::run('sudo mkdir -p '.escapeshellarg($mountpoint));
        if ($result->failed()) {
            throw new \RuntimeException('Failed to create mount directory: '.$result->errorOutput());
        }

        // Format the device with ext4
        $result = Process::run('sudo mkfs.ext4 -F '.escapeshellarg($device).' 2>&1');
        if ($result->failed()) {
            throw new \RuntimeException('Failed to format device: '.$result->output());
        }

        // Mount the device
        $result = Process::run('sudo mount '.escapeshellarg($device).' '.escapeshellarg($mountpoint));
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
            Process::run("sudo sh -c \"echo {$escapedEntry} >> /etc/fstab\"");
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
        $result = Process::run('sudo blkid -s UUID -o value '.escapeshellarg($device));

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

    /**
     * Unmount an EXT4 volume and remove its /etc/fstab entry.
     *
     * @param  string  $pool  The device path or mountpoint name
     * @return array{success: bool, message: string}
     *
     * @throws \RuntimeException on failure
     */
    public function unmount(string $pool): array
    {
        $info = $this->getPoolInfo($pool);
        if ($info === null) {
            throw new \RuntimeException("EXT4 volume '{$pool}' not found.");
        }

        $mountpoint = $info['mountpoint'];
        $device = $info['device'];

        // Unmount the filesystem
        $result = Process::run('sudo umount '.escapeshellarg($mountpoint));
        if ($result->failed()) {
            throw new \RuntimeException('Failed to unmount EXT4 volume: '.$result->errorOutput());
        }

        // Remove the fstab entry (match by UUID or device)
        $uuid = $this->getDeviceUuid($device);
        $this->removeFstabEntry($device, $uuid, $mountpoint);

        // Remove the mount directory
        Process::run('sudo rmdir '.escapeshellarg($mountpoint));

        return [
            'success' => true,
            'message' => "EXT4 volume '{$device}' has been unmounted from '{$mountpoint}' and its fstab entry removed.",
        ];
    }

    /**
     * Mount an EXT4 volume at the given mountpoint.
     *
     * @param  string  $pool  The device path or mountpoint name
     * @param  string  $mountpoint  Where to mount
     * @return array{success: bool, message: string}
     *
     * @throws \RuntimeException on failure
     */
    public function mount(string $pool, string $mountpoint): array
    {
        // Resolve device — pool may be a device path or a name from listPools
        $device = $pool;
        if (! str_starts_with($device, '/dev/')) {
            $device = '/dev/'.$device;
        }

        // Verify the device exists and is ext4
        $fsType = null;
        $blkResult = Process::run('sudo blkid -s TYPE -o value '.escapeshellarg($device));
        if ($blkResult->successful()) {
            $fsType = trim($blkResult->output());
        }
        if ($fsType !== 'ext4') {
            throw new \RuntimeException("Device '{$device}' is not an ext4 filesystem (found: {$fsType}).");
        }

        // Create mount directory
        $result = Process::run('sudo mkdir -p '.escapeshellarg($mountpoint));
        if ($result->failed()) {
            throw new \RuntimeException('Failed to create mount directory: '.$result->errorOutput());
        }

        // Mount
        $result = Process::run('sudo mount '.escapeshellarg($device).' '.escapeshellarg($mountpoint));
        if ($result->failed()) {
            throw new \RuntimeException('Failed to mount device: '.$result->errorOutput());
        }

        // Add fstab entry for automount on boot
        $uuid = $this->getDeviceUuid($device);
        $entry = $uuid
            ? "UUID={$uuid} {$mountpoint} ext4 defaults 0 2"
            : "{$device} {$mountpoint} ext4 defaults 0 2";

        $escapedEntry = escapeshellarg($entry);
        Process::run("sudo sh -c \"echo {$escapedEntry} >> /etc/fstab\"");

        return [
            'success' => true,
            'message' => "EXT4 volume on '{$device}' has been mounted at '{$mountpoint}' and added to /etc/fstab.",
        ];
    }

    /**
     * Permanently delete an EXT4 volume (unmount + wipe).
     *
     * @param  string  $pool  The device path or mountpoint name
     * @return array{success: bool, message: string}
     *
     * @throws \RuntimeException on failure
     */
    public function deletePool(string $pool): array
    {
        $info = $this->getPoolInfo($pool);
        if ($info === null) {
            throw new \RuntimeException("EXT4 volume '{$pool}' not found.");
        }

        $mountpoint = $info['mountpoint'];
        $device = $info['device'];

        // Unmount if mounted
        $result = Process::run('sudo umount '.escapeshellarg($mountpoint).' 2>/dev/null');
        // Continue even if unmount fails (already unmounted)

        // Remove fstab entry
        $uuid = $this->getDeviceUuid($device);
        $this->removeFstabEntry($device, $uuid, $mountpoint);

        // Remove the mount directory
        Process::run('sudo rmdir '.escapeshellarg($mountpoint));

        // Wipe the filesystem signature
        $result = Process::run('sudo wipefs -a '.escapeshellarg($device).' 2>&1');
        if ($result->failed()) {
            throw new \RuntimeException('Failed to wipe EXT4 filesystem: '.$result->output());
        }

        return [
            'success' => true,
            'message' => "EXT4 volume on '{$device}' has been permanently deleted and wiped.",
        ];
    }

    /**
     * Remove a device's /etc/fstab entry by UUID or device path.
     */
    protected function removeFstabEntry(string $device, ?string $uuid, string $mountpoint): void
    {
        if ($uuid) {
            Process::run('sudo sed -i \'/UUID='.escapeshellcmd($uuid).'/d\' /etc/fstab');
        }
        // Also remove by device path in case UUID line wasn't found
        $escapedDevice = str_replace('/', '\\/', $device);
        Process::run("sudo sed -i '/{$escapedDevice}/d' /etc/fstab");
        // Also remove by mountpoint
        $escapedMount = str_replace('/', '\\/', $mountpoint);
        Process::run("sudo sed -i '/{$escapedMount}/d' /etc/fstab");
    }
}
