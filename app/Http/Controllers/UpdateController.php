<?php

namespace App\Http\Controllers;

use App\Services\NovaNASUpdateService;
use App\Services\UpdateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Controller for managing system updates.
 */
class UpdateController extends Controller
{
    public function __construct(
        public UpdateService $updateService,
        public NovaNASUpdateService $novaNasUpdateService,
    ) {}

    /**
     * Get update status including last update time and available updates.
     */
    public function status(): JsonResponse
    {
        $lastUpdate = $this->updateService->getLastUpdateTime();
        $updateStatus = $this->updateService->getUpdateStatus();

        // Update badge count based on current status
        $this->updateService->updateBadgeCount('updates', $updateStatus['count'] ?? 0);

        return response()->json([
            'last_update' => $lastUpdate,
            'updates_available' => $updateStatus['available'],
            'available_count' => $updateStatus['count'] ?? 0,
            'message' => $updateStatus['message'],
        ]);
    }

    /**
     * Start checking for updates in the background.
     */
    public function check(Request $request): JsonResponse
    {
        // Start the check process
        $result = $this->updateService->startCheckForUpdates();

        if ($result['success']) {
            return response()->json([
                'message' => $result['message'],
                'job_id' => $result['job_id'],
            ]);
        } else {
            return response()->json([
                'message' => $result['message'],
                'error' => $result['error'] ?? 'Unknown error occurred',
            ], 500);
        }
    }

    /**
     * Get check job status and output.
     */
    public function checkStatus(string $jobId): JsonResponse
    {
        $status = $this->updateService->getCheckStatus($jobId);

        return response()->json($status);
    }

    /**
     * Start system upgrade process.
     */
    public function upgrade(Request $request): JsonResponse
    {
        // Start the upgrade process
        $result = $this->updateService->startUpgrade();

        if ($result['success']) {
            return response()->json([
                'message' => $result['message'],
                'job_id' => $result['job_id'],
            ]);
        } else {
            return response()->json([
                'message' => $result['message'],
                'error' => $result['error'] ?? 'Unknown error occurred',
            ], 500);
        }
    }

    /**
     * Get upgrade job status and output.
     */
    public function upgradeStatus(string $jobId): JsonResponse
    {
        $status = $this->updateService->getUpgradeStatus($jobId);

        return response()->json($status);
    }

    /**
     * Get detailed list of available updates.
     */
    public function availableUpdates(): JsonResponse
    {
        $updates = $this->updateService->getAvailableUpdates();

        return response()->json($updates);
    }

    /**
     * Clean apt cache to free disk space.
     */
    public function cleanCache(): JsonResponse
    {
        $result = $this->updateService->cleanCache();

        if ($result['success']) {
            return response()->json([
                'message' => $result['message'],
            ]);
        } else {
            return response()->json([
                'message' => $result['message'],
                'error' => $result['error'] ?? 'Unknown error occurred',
            ], 500);
        }
    }

    /**
     * Check if system reboot is required.
     */
    public function rebootStatus(): JsonResponse
    {
        $rebootStatus = $this->updateService->getRebootStatus();

        return response()->json($rebootStatus);
    }

    /**
     * Clear badge for the updates app.
     */
    public function clearBadge(): JsonResponse
    {
        $this->updateService->updateBadgeCount('updates', 0);

        return response()->json([
            'message' => 'Badge cleared successfully',
        ]);
    }

    /**
     * Get NovaNAS update status including current version and availability.
     */
    public function novaNasStatus(): JsonResponse
    {
        $status = $this->novaNasUpdateService->checkForUpdates();

        return response()->json($status);
    }

    /**
     * Trigger NovaNAS update process.
     */
    public function novaNasUpdate(): JsonResponse
    {
        $result = $this->novaNasUpdateService->triggerUpdate();

        if ($result['success']) {
            return response()->json([
                'message' => $result['message'],
            ]);
        } else {
            return response()->json([
                'message' => $result['message'],
                'error' => $result['error'] ?? 'Unknown error occurred',
            ], 500);
        }
    }
}
