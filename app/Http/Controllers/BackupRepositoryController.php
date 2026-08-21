<?php

namespace App\Http\Controllers;

use App\Enums\BackupStorageType;
use App\Http\Requests\StoreBackupRepositoryRequest;
use App\Http\Requests\UpdateBackupRepositoryRequest;
use App\Models\BackupRepository;
use App\Services\Backup\ResticService;
use App\Services\Backup\Storage\LocalStorageProvider;
use App\Services\Backup\Storage\NovaNasBackupStorageProvider;
use App\Services\Backup\Storage\S3StorageProvider;
use App\Services\Backup\Storage\SftpStorageProvider;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Controller for managing backup repositories.
 */
class BackupRepositoryController extends Controller
{
    public function __construct(
        protected ResticService $resticService,
    ) {}

    /**
     * Get all backup repositories.
     */
    public function index(): JsonResponse
    {
        $repositories = BackupRepository::with('jobs')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'repositories' => $repositories->map(fn ($repo) => $this->formatRepository($repo)),
        ]);
    }

    /**
     * Store a new backup repository.
     */
    public function store(StoreBackupRepositoryRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $repository = BackupRepository::create([
            'name' => $validated['name'],
            'storage_type' => $validated['storage_type'],
            'repo_path' => $validated['repo_path'],
            'credentials' => $validated['credentials'] ?? null,
            'user_id' => auth()->id(),
        ]);

        // Automatically initialize the repository
        $initResult = $this->resticService->init($repository);

        if (! $initResult['success']) {
            $repository->delete();

            return response()->json([
                'message' => 'Failed to initialize repository: '.$initResult['message'],
            ], 422);
        }

        return response()->json([
            'message' => 'Destination created and initialized successfully.',
            'repository' => $this->formatRepository($repository->fresh()),
        ], 201);
    }

    /**
     * Show a backup repository.
     */
    public function show(BackupRepository $repository): JsonResponse
    {
        return response()->json([
            'repository' => $this->formatRepository($repository->load('jobs')),
        ]);
    }

    /**
     * Update a backup repository.
     */
    public function update(UpdateBackupRepositoryRequest $request, BackupRepository $repository): JsonResponse
    {
        $validated = $request->validated();

        if (isset($validated['credentials'])) {
            $validated['credentials'] = array_merge(
                $repository->credentials ?? [],
                $validated['credentials']
            );
        }

        $repository->update($validated);

        return response()->json([
            'message' => 'Repository updated successfully.',
            'repository' => $this->formatRepository($repository->fresh()),
        ]);
    }

    /**
     * Delete a backup repository.
     */
    public function destroy(BackupRepository $repository): JsonResponse
    {
        $repository->delete();

        return response()->json([
            'message' => 'Repository deleted successfully.',
        ]);
    }

    /**
     * Check repository integrity.
     */
    public function check(BackupRepository $repository): JsonResponse
    {
        $result = $this->resticService->check($repository);

        $statusCode = $result['success'] ? 200 : 400;

        return response()->json($result, $statusCode);
    }

    /**
     * Get repository statistics.
     */
    public function stats(BackupRepository $repository): JsonResponse
    {
        $result = $this->resticService->stats($repository);

        $statusCode = $result['success'] ? 200 : 400;

        return response()->json($result, $statusCode);
    }

    /**
     * Test connection to a storage backend.
     */
    public function testConnection(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'storage_type' => 'required|string|in:local,sftp,s3,novanas_backup',
            'repo_path' => 'required|string',
            'credentials' => 'nullable|array',
        ]);

        $result = $this->resticService->testConnection(
            $validated['storage_type'],
            $validated['repo_path'],
            $validated['credentials'] ?? []
        );

        $statusCode = $result['success'] ? 200 : 400;

        return response()->json($result, $statusCode);
    }

    /**
     * Get storage provider form fields.
     */
    public function providerFields(): JsonResponse
    {
        $providers = [];

        foreach (BackupStorageType::cases() as $type) {
            $provider = match ($type) {
                BackupStorageType::Local => new LocalStorageProvider,
                BackupStorageType::Sftp => new SftpStorageProvider,
                BackupStorageType::S3 => new S3StorageProvider,
                BackupStorageType::NovaNasBackup => new NovaNasBackupStorageProvider,
            };

            $providers[] = [
                'type' => $type->value,
                'name' => $provider->getDisplayName(),
                'fields' => $provider->getFormFields(),
            ];
        }

        return response()->json(['providers' => $providers]);
    }

    /**
     * Format a repository for JSON response.
     *
     * @return array<string, mixed>
     */
    protected function formatRepository(BackupRepository $repository): array
    {
        return [
            'id' => $repository->id,
            'name' => $repository->name,
            'storage_type' => $repository->storage_type,
            'storage_type_label' => BackupStorageType::from($repository->storage_type)->label(),
            'repo_path' => $repository->repo_path,
            'is_initialized' => $repository->is_initialized,
            'last_check_at' => $repository->last_check_at?->toIso8601String(),
            'jobs_count' => $repository->jobs->count(),
            'created_at' => $repository->created_at->toIso8601String(),
            'updated_at' => $repository->updated_at->toIso8601String(),
        ];
    }
}
