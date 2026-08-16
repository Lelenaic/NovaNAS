<?php

namespace App\Http\Controllers;

use App\Services\DockerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Process;

/**
 * Controller for managing Docker settings.
 */
class DockerSettingsController extends Controller
{
    public function __construct(public DockerService $dockerService) {}

    /**
     * Get Docker settings and status.
     */
    public function index(): JsonResponse
    {
        $isInstalled = $this->dockerService->isInstalled();
        $isRunning = $this->dockerService->isRunning();
        $dataDirectory = $this->dockerService->getDataDirectory();
        $daemonConfig = $this->dockerService->getDaemonConfig();
        $mountPoints = $this->dockerService->getAvailableMountPoints();

        return response()->json([
            'is_installed' => $isInstalled,
            'is_running' => $isRunning,
            'data_directory' => $dataDirectory,
            'daemon_config' => $daemonConfig,
            'available_mount_points' => $mountPoints,
            'default_data_dir' => '/var/lib/docker',
        ]);
    }

    /**
     * Get available mount points for Docker data directory.
     */
    public function mountPoints(): JsonResponse
    {
        $mountPoints = $this->dockerService->getAvailableMountPoints();

        return response()->json([
            'mount_points' => $mountPoints,
        ]);
    }

    /**
     * Get Docker auto-update settings.
     */
    public function getAutoUpdate(): JsonResponse
    {
        // Check if watchtower container is actually running
        $containerInfo = $this->getWatchtowerContainerInfo();
        $enabled = $containerInfo !== null;

        $intervalValue = 30;
        $intervalUnit = 'minutes';

        if ($enabled) {
            [$intervalValue, $intervalUnit] = $this->parseWatchtowerInterval($containerInfo);
        }

        return response()->json([
            'auto_update_enabled' => $enabled,
            'auto_update_interval_value' => $intervalValue,
            'auto_update_interval_unit' => $intervalUnit,
        ]);
    }

    /**
     * Update Docker auto-update settings.
     */
    public function updateAutoUpdate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'auto_update_enabled' => 'required|boolean',
            'auto_update_interval_value' => 'required|integer|min:1|max:86400',
            'auto_update_interval_unit' => 'required|in:seconds,minutes,hours',
        ]);

        // Manage the watchtower container based on the requested state
        if ($validated['auto_update_enabled']) {
            $this->ensureWatchtowerContainer($validated['auto_update_interval_value'], $validated['auto_update_interval_unit']);
        } else {
            $this->stopWatchtowerContainer();
        }

        return response()->json([
            'success' => true,
            'message' => 'Auto-update settings saved successfully',
        ]);
    }

    /**
     * Ensure the watchtower container is running with the correct settings.
     */
    private function ensureWatchtowerContainer(int $intervalValue, string $intervalUnit): void
    {
        // Convert to seconds
        $intervalSeconds = match ($intervalUnit) {
            'seconds' => $intervalValue,
            'minutes' => $intervalValue * 60,
            'hours' => $intervalValue * 3600,
            default => $intervalValue,
        };

        // Check if container exists and has correct settings
        $containerInfo = $this->getWatchtowerContainerInfo();
        if ($containerInfo) {
            [$currentValue, $currentUnit] = $this->parseWatchtowerInterval($containerInfo);
            $currentSeconds = match ($currentUnit) {
                'seconds' => $currentValue,
                'minutes' => $currentValue * 60,
                'hours' => $currentValue * 3600,
                default => $currentValue,
            };

            // If settings match, do nothing
            if ($currentSeconds === $intervalSeconds) {
                return;
            }

            // Stop and remove existing container
            $this->stopWatchtowerContainer();
        }

        // Create new container
        $configPath = $this->dockerService->getDockerConfigPath();

        $args = [
            'run',
            '-d',
            '--name', 'watchtower',
            '--label', 'com.centurylinklabs.watchtower.enable=true',
            '--restart', 'unless-stopped',
            '-v', '/var/run/docker.sock:/var/run/docker.sock',
            '-v', "{$configPath}:/config.json",
            '-e', 'WATCHTOWER_CLEANUP=true',
            '-e', "WATCHTOWER_POLL_INTERVAL={$intervalSeconds}",
            'nickfedor/watchtower',
            '--label-enable',
            '--cleanup',
            '-i', (string) $intervalSeconds,
        ];

        $result = Process::timeout(60)->run(array_merge(['docker'], $args));

        if ($result->failed()) {
            throw new \RuntimeException('Failed to start watchtower container: '.$result->errorOutput());
        }
    }

    /**
     * Stop and remove the watchtower container.
     */
    private function stopWatchtowerContainer(): void
    {
        // Try to stop and remove the container
        Process::timeout(30)->run(['docker', 'stop', 'watchtower']);

        Process::timeout(30)->run(['docker', 'rm', 'watchtower']);

        // Don't throw errors if container doesn't exist or fails to stop/remove
    }

    /**
     * Get watchtower container information.
     */
    private function getWatchtowerContainerInfo(): ?array
    {
        $result = Process::timeout(30)->run(['docker', 'inspect', 'watchtower']);

        if ($result->failed()) {
            return null;
        }

        $containers = json_decode($result->output(), true);

        return $containers[0] ?? null;
    }

    /**
     * Parse interval from watchtower container command.
     */
    private function parseWatchtowerInterval(array $containerInfo): array
    {
        $args = $containerInfo['Args'] ?? $containerInfo['Config']['Cmd'] ?? [];

        $intervalSeconds = 1800; // Default 30 minutes in seconds
        $intervalUnit = 'minutes';

        // Look for -i parameter
        $iIndex = array_search('-i', $args);
        if ($iIndex !== false && isset($args[$iIndex + 1])) {
            $intervalSeconds = (int) $args[$iIndex + 1];
        }

        // Convert seconds to appropriate unit
        if ($intervalSeconds >= 3600 && $intervalSeconds % 3600 === 0) {
            $intervalUnit = 'hours';
            $intervalValue = $intervalSeconds / 3600;
        } elseif ($intervalSeconds >= 60 && $intervalSeconds % 60 === 0) {
            $intervalUnit = 'minutes';
            $intervalValue = $intervalSeconds / 60;
        } else {
            $intervalUnit = 'seconds';
            $intervalValue = $intervalSeconds;
        }

        return [$intervalValue, $intervalUnit];
    }
}
