<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Services\Storage\StorageService;
use App\Services\SettingsService;
use App\Services\SambaService;
use App\Services\LinuxUserService;
use App\Services\NetworkService;

class StorageController extends Controller
{
    public function __construct(
        protected StorageService $storageService,
        protected SettingsService $settingsService,
        protected SambaService $sambaService,
        protected LinuxUserService $linuxUserService,
        protected NetworkService $networkService
    ) {}

    /**
     * List all disks in the system.
     */
    public function disks(): JsonResponse
    {
        $disks = $this->storageService->listDisks();

        return response()->json([
            'disks' => $disks,
        ]);
    }

    /**
     * Get capacity information for a specific disk.
     */
    public function capacity(string $device): JsonResponse
    {
        $capacity = $this->storageService->getCapacity($device);

        if ($capacity === null) {
            return response()->json([
                'error' => 'Unable to get capacity for device',
            ], 404);
        }

        return response()->json($capacity);
    }

    /**
     * List all storage pools (ZFS).
     */
    public function pools(): JsonResponse
    {
        $pools = $this->storageService->listPools();

        return response()->json([
            'pools' => $pools,
        ]);
    }

    /**
     * Get detailed information about a specific pool.
     */
    public function pool(string $pool): JsonResponse
    {
        $info = $this->storageService->getPoolInfo($pool);

        if ($info === null) {
            return response()->json([
                'error' => 'Pool not found',
            ], 404);
        }

        return response()->json($info);
    }

    /**
     * Get settings by keys.
     */
    public function getSettings(Request $request): JsonResponse
    {
        $keys = $request->input('keys', []);

        if (empty($keys)) {
            $keys = ['storage.user_files_home', 'storage.app_folders_home'];
        }

        $settings = $this->settingsService->getMultiple($keys);

        return response()->json([
            'settings' => $settings,
        ]);
    }

    /**
     * Update settings.
     */
    public function updateSettings(Request $request): JsonResponse
    {
        $settings = $request->input('settings', []);

        foreach ($settings as $key => $value) {
            $this->settingsService->set($key, $value);
        }

        return response()->json([
            'message' => 'Settings updated successfully',
        ]);
    }

    /**
     * List directories in a storage pool's mountpoint.
     */
    public function poolDirectories(string $pool): JsonResponse
    {
        $directories = $this->settingsService->listDirectoriesInPool($pool);

        return response()->json([
            'directories' => $directories,
        ]);
    }

    /**
     * List all shares from smb.conf.
     */
    public function shares(): JsonResponse
    {
        $allShares = $this->sambaService->getShares();

        // Filter to show only custom shares and homes
        $shares = array_filter($allShares, function ($share) {
            return $share['type'] === 'custom' || $share['name'] === 'homes';
        });

        // Get the default IP address for network paths
        $ipAddress = $this->networkService->getDefaultIPAddress();

        return response()->json([
            'shares' => array_values($shares),
            'ip_address' => $ipAddress,
        ]);
    }

    /**
     * Create a new share.
     */
    public function createShare(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:80|regex:/^[a-zA-Z0-9_-]+$/',
            'comment' => 'nullable|string|max:255',
            'path' => 'required|string|max:4096',
            'writable' => 'nullable|in:yes,no',
            'guest' => 'nullable|in:yes,no,only',
            'valid_users' => 'nullable|string|max:1000',
        ]);

        try {
            $this->sambaService->createShare($validated['name'], [
                'comment' => $validated['comment'] ?? null,
                'path' => $validated['path'],
                'writable' => $validated['writable'] ?? 'yes',
                'guest' => $validated['guest'] ?? 'no',
                'valid users' => $validated['valid_users'] ?? null,
            ]);

            return response()->json([
                'message' => 'Share created successfully',
            ]);
        } catch (\RuntimeException $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Update an existing share.
     */
    public function updateShare(Request $request, string $name): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'nullable|string|max:80|regex:/^[a-zA-Z0-9_-]+$/',
            'comment' => 'nullable|string|max:255',
            'path' => 'nullable|string|max:4096',
            'writable' => 'nullable|in:yes,no',
            'guest' => 'nullable|in:yes,no,only',
            'valid_users' => 'nullable|string|max:1000',
        ]);

        // Check if name is being changed to a name that's already used
        $newName = $validated['name'] ?? $name;
        if ($newName !== $name) {
            $existingShare = $this->sambaService->getShare($newName);
            if ($existingShare !== null) {
                return response()->json([
                    'error' => "Share '{$newName}' already exists",
                ], 422);
            }
        }

        try {
            $this->sambaService->updateShare($name, [
                'name' => $validated['name'] ?? null,
                'comment' => $validated['comment'] ?? null,
                'path' => $validated['path'] ?? null,
                'writable' => $validated['writable'] ?? null,
                'guest' => $validated['guest'] ?? null,
                'valid users' => $validated['valid_users'] ?? null,
            ]);

            return response()->json([
                'message' => 'Share updated successfully',
            ]);
        } catch (\RuntimeException $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Delete a share.
     */
    public function deleteShare(string $name): JsonResponse
    {
        try {
            $this->sambaService->deleteShare($name);

            return response()->json([
                'message' => 'Share deleted successfully',
            ]);
        } catch (\RuntimeException $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Get available users for share access.
     */
    public function shareUsers(): JsonResponse
    {
        $users = $this->linuxUserService->listUsers();

        return response()->json([
            'users' => $users,
        ]);
    }

    /**
     * Toggle homes share enabled/disabled.
     */
    public function toggleHomes(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'enabled' => 'required|boolean',
        ]);

        try {
            $this->sambaService->setHomesEnabled($validated['enabled']);

            return response()->json([
                'message' => 'Homes share ' . ($validated['enabled'] ? 'enabled' : 'disabled') . ' successfully',
            ]);
        } catch (\RuntimeException $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 422);
        }
    }
}
