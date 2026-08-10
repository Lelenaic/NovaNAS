<?php

namespace App\Http\Controllers;

use App\Models\BackupRepository;
use App\Services\Backup\ResticService;
use Illuminate\Http\JsonResponse;

/**
 * Controller for querying restic snapshots directly.
 *
 * No database table for snapshots - all data comes from restic.
 */
class BackupSnapshotController extends Controller
{
    public function __construct(
        protected ResticService $resticService,
    ) {}

    /**
     * List all snapshots for a repository.
     */
    public function index(BackupRepository $repository): JsonResponse
    {
        $result = $this->resticService->snapshots($repository);

        $statusCode = $result['success'] ? 200 : 400;

        return response()->json($result, $statusCode);
    }

    /**
     * Delete a snapshot from a repository.
     */
    public function destroy(BackupRepository $repository, string $snapshotId): JsonResponse
    {
        $result = $this->resticService->deleteSnapshot($repository, $snapshotId);

        $statusCode = $result['success'] ? 200 : 400;

        return response()->json($result, $statusCode);
    }
}
