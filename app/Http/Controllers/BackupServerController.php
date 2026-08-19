<?php

namespace App\Http\Controllers;

use App\Services\Backup\BackupServerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Controller for managing the NovaNAS backup server.
 */
class BackupServerController extends Controller
{
    public function __construct(
        protected BackupServerService $backupServerService,
    ) {}

    /**
     * List all API keys.
     */
    public function listKeys(): JsonResponse
    {
        return response()->json([
            'keys' => $this->backupServerService->listApiKeys(),
        ]);
    }

    /**
     * Create a new API key.
     *
     * Returns the base64-encoded key once — it is never stored or shown again.
     */
    public function storeKey(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', 'regex:/^[a-zA-Z0-9._-]+$/'],
        ]);

        try {
            $result = $this->backupServerService->addApiKey($validated['name']);

            if ($this->backupServerService->getApiKeyCount() === 1) {
                $this->backupServerService->enableService();
            }

            return response()->json([
                'message' => 'API key created successfully. Copy the key below — it will not be shown again.',
                'key' => $result['key'],
                'name' => $result['name'],
            ], 201);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * Delete an API key.
     */
    public function destroyKey(string $name): JsonResponse
    {
        try {
            $deleted = $this->backupServerService->deleteApiKey($name);

            if (! $deleted) {
                return response()->json(['message' => 'API key not found.'], 404);
            }

            return response()->json(['message' => 'API key deleted successfully.']);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * Get the backup server status.
     */
    public function status(): JsonResponse
    {
        return response()->json([
            'enabled' => $this->backupServerService->isServiceEnabled(),
            'active' => $this->backupServerService->isServiceActive(),
            'backup_path' => $this->backupServerService->getBackupPath(),
            'api_key_count' => $this->backupServerService->getApiKeyCount(),
        ]);
    }

    /**
     * Update the backup path.
     */
    public function updatePath(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'backup_path' => ['required', 'string', 'max:500'],
        ]);

        try {
            $this->backupServerService->setBackupPath($validated['backup_path']);

            return response()->json([
                'message' => 'Backup path updated successfully.',
                'backup_path' => $this->backupServerService->getBackupPath(),
            ]);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * Get the machine-id of this server.
     */
    public function machineId(): JsonResponse
    {
        return response()->json([
            'machine_id' => $this->backupServerService->getMachineId(),
        ]);
    }
}
