<?php

namespace App\Http\Controllers;

use App\Services\DockerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Controller for managing Docker settings.
 */
class DockerSettingsController extends Controller
{
    public function __construct(public DockerService $dockerService)
    {
    }

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
     * Move Docker data directory to a new location.
     */
    public function moveDataDirectory(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'new_data_directory' => 'required|string',
        ]);

        $newDataDir = $validated['new_data_directory'];

        // Validate path
        if (!str_starts_with($newDataDir, '/')) {
            return response()->json([
                'success' => false,
                'message' => 'Path must be an absolute path starting with /',
            ], 422);
        }

        $currentDataDir = $this->dockerService->getDataDirectory();

        // Check if same as current
        if ($newDataDir === $currentDataDir) {
            return response()->json([
                'success' => false,
                'message' => 'New directory is the same as current directory',
            ], 422);
        }

        // Check if Docker is installed
        if (!$this->dockerService->isInstalled()) {
            return response()->json([
                'success' => false,
                'message' => 'Docker is not installed on this system',
            ], 422);
        }

        // Move the data directory
        $result = $this->dockerService->moveDataDirectory($newDataDir);

        return response()->json($result);
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
}
