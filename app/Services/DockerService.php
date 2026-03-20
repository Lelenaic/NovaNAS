<?php

namespace App\Services;

use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\File;

/**
 * Docker Service
 *
 * Manages Docker configuration including data directory settings.
 */
class DockerService
{
    private const DEFAULT_DOCKER_DATA_DIR = '/var/lib/docker';
    private const DAEMON_JSON_PATH = '/etc/docker/daemon.json';

    /**
     * Check if Docker is installed.
     */
    public function isInstalled(): bool
    {
        $result = Process::run('which docker');

        return $result->successful();
    }

    /**
     * Check if Docker daemon is running.
     */
    public function isRunning(): bool
    {
        $result = Process::run('systemctl is-active docker');

        return $result->successful() && trim($result->output()) === 'active';
    }

    /**
     * Get the current Docker data directory.
     */
    public function getDataDirectory(): string
    {
        // First check daemon.json for data-root configuration
        $daemonConfig = $this->getDaemonConfig();

        if (isset($daemonConfig['data-root']) && !empty($daemonConfig['data-root'])) {
            return $daemonConfig['data-root'];
        }

        // Default Docker data directory
        return self::DEFAULT_DOCKER_DATA_DIR;
    }

    /**
     * Get the Docker daemon.json configuration.
     *
     * @return array<string, mixed>
     */
    public function getDaemonConfig(): array
    {
        // Check if file exists using sudo (webserver user may not have access to /etc/docker)
        $checkResult = Process::run('sudo test -f ' . self::DAEMON_JSON_PATH);
        if (!$checkResult->successful()) {
            return [];
        }

        // Read file using sudo
        $result = Process::run('sudo cat ' . self::DAEMON_JSON_PATH);
        if (!$result->successful()) {
            return [];
        }

        $content = $result->output();
        $config = json_decode($content, true);

        return is_array($config) ? $config : [];
    }

    /**
     * Update the Docker daemon.json configuration.
     *
     * @param array<string, mixed> $config
     */
    public function updateDaemonConfig(array $config): void
    {
        $directory = dirname(self::DAEMON_JSON_PATH);

        // Create directory if it doesn't exist (using sudo since /etc/docker may need root)
        $checkDirResult = Process::run('sudo test -d ' . $directory);
        if (!$checkDirResult->successful()) {
            Process::run('sudo mkdir -p ' . $directory);
        }

        // Get current config using sudo (reading system file)
        $currentConfig = $this->getDaemonConfig();
        $mergedConfig = array_merge($currentConfig, $config);
        $jsonContent = json_encode($mergedConfig, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

        // Write to temp file first, then move with sudo
        $tempFile = storage_path('app/daemon.json.tmp');
        file_put_contents($tempFile, $jsonContent . "\n");
        Process::run('sudo mv ' . $tempFile . ' ' . self::DAEMON_JSON_PATH);
    }

    /**
     * Stop the Docker service.
     */
    public function stopService(): bool
    {
        $result = Process::run('systemctl stop docker');

        return $result->successful();
    }

    /**
     * Start the Docker service.
     */
    public function startService(): bool
    {
        $result = Process::run('systemctl start docker');

        return $result->successful();
    }

    /**
     * Restart the Docker service.
     */
    public function restartService(): bool
    {
        $result = Process::run('systemctl restart docker');

        return $result->successful();
    }

    /**
     * Check if the data directory exists.
     */
    public function dataDirectoryExists(string $path): bool
    {
        return File::exists($path) && is_dir($path);
    }

    /**
     * Check if we can write to the target directory.
     */
    public function canWriteToDirectory(string $path): bool
    {
        if (!File::exists($path)) {
            $parentDir = dirname($path);

            return File::isWritable($parentDir);
        }

        return File::isWritable($path);
    }

    /**
     * Get directory size in bytes.
     */
    public function getDirectorySize(string $path): int
    {
        if (!File::exists($path)) {
            return 0;
        }

        $result = Process::run("du -sb $path 2>/dev/null | cut -f1");

        if ($result->successful()) {
            return (int) trim($result->output());
        }

        return 0;
    }

    /**
     * Move Docker data directory to a new location.
     *
     * This will:
     * 1. Stop the Docker service
     * 2. Update daemon.json with the new data-root
     * 3. Move the data directory
     * 4. Start the Docker service
     */
    public function moveDataDirectory(string $newDataDir): array
    {
        $currentDataDir = $this->getDataDirectory();

        // Validate new directory exists (check using sudo since webserver user may not have access)
        $checkParentResult = Process::run('sudo test -d ' . dirname($newDataDir));
        if (!$checkParentResult->successful()) {
            return [
                'success' => false,
                'message' => 'Parent directory does not exist: ' . dirname($newDataDir),
            ];
        }

        // Check if Docker directory has content
        $checkContentResult = Process::run('sudo test -d ' . $currentDataDir . ' && sudo ls -A ' . $currentDataDir);
        if ($checkContentResult->successful() && !empty(trim($checkContentResult->output()))) {
            // Docker directory is not empty, check if we can write to target
            $checkWriteResult = Process::run('sudo test -w ' . dirname($newDataDir));
            if (!$checkWriteResult->successful()) {
                return [
                    'success' => false,
                    'message' => 'Cannot write to target directory: ' . dirname($newDataDir),
                ];
            }
        }

        // Step 1: Stop Docker service (using sudo since webserver user can't manage services)
        if ($this->isRunning()) {
            $stopResult = Process::run('sudo systemctl stop docker');
            if (!$stopResult->successful()) {
                return [
                    'success' => false,
                    'message' => 'Failed to stop Docker service: ' . $stopResult->errorOutput(),
                ];
            }
        }

        try {
            // Step 2: Update daemon.json using sudo
            $this->updateDaemonConfig(['data-root' => $newDataDir]);

            // Step 3: Move data directory if it exists
            $checkCurrentResult = Process::run('sudo test -d ' . $currentDataDir);
            if ($checkCurrentResult->successful()) {
                // Create parent directory if needed (using sudo)
                $mkdirResult = Process::run('sudo mkdir -p ' . dirname($newDataDir));
                if (!$mkdirResult->successful()) {
                    // Rollback daemon.json on failure
                    $this->updateDaemonConfig(['data-root' => $currentDataDir]);

                    return [
                        'success' => false,
                        'message' => 'Failed to create parent directory: ' . $mkdirResult->errorOutput(),
                    ];
                }

                // Move the directory using sudo mv
                $moveResult = Process::run('sudo mv ' . $currentDataDir . ' ' . $newDataDir);
                if (!$moveResult->successful()) {
                    // Rollback daemon.json on failure
                    $this->updateDaemonConfig(['data-root' => $currentDataDir]);

                    return [
                        'success' => false,
                        'message' => 'Failed to move data directory: ' . $moveResult->errorOutput(),
                    ];
                }
            }

            // Step 4: Start Docker service using sudo
            $startResult = Process::run('sudo systemctl start docker');
            if (!$startResult->successful()) {
                return [
                    'success' => false,
                    'message' => 'Failed to start Docker service after moving directory: ' . $startResult->errorOutput(),
                ];
            }

            return [
                'success' => true,
                'message' => 'Docker data directory moved successfully to: ' . $newDataDir,
            ];
        } catch (\Exception $e) {
            // Attempt to rollback
            $this->updateDaemonConfig(['data-root' => $currentDataDir]);

            return [
                'success' => false,
                'message' => 'Error moving data directory: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Get available mount points for storage.
     *
     * @return array<int, array{name: string, path: string}>
     */
    public function getAvailableMountPoints(): array
    {
        $mountPoints = [];

        // Get mount points from /proc/mounts
        if (File::exists('/proc/mounts')) {
            $content = File::get('/proc/mounts');
            $lines = explode("\n", $content);

            foreach ($lines as $line) {
                $parts = preg_split('/\s+/', $line);
                if (count($parts) >= 2) {
                    $mountPoint = $parts[1];
                    // Only include actual mount points (not system directories)
                    if (str_starts_with($mountPoint, '/media') ||
                        str_starts_with($mountPoint, '/mnt') ||
                        str_starts_with($mountPoint, '/srv') ||
                        str_starts_with($mountPoint, '/storage')) {
                        $mountPoints[] = [
                            'name' => basename($mountPoint),
                            'path' => $mountPoint,
                        ];
                    }
                }
            }
        }

        return $mountPoints;
    }
}
