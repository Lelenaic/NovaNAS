<?php

namespace App\Services\Backup\Storage;

use App\Contracts\BackupStorageProviderInterface;

/**
 * Local storage provider for restic repositories.
 */
class LocalStorageProvider implements BackupStorageProviderInterface
{
    /**
     * {@inheritdoc}
     */
    public function getDisplayName(): string
    {
        return 'Local Directory';
    }

    /**
     * {@inheritdoc}
     */
    public function getRepositoryUri(string $repoPath, array $credentials): string
    {
        return $repoPath;
    }

    /**
     * {@inheritdoc}
     */
    public function getEnvironmentVariables(array $credentials): array
    {
        return [];
    }

    /**
     * {@inheritdoc}
     */
    public function validateCredentials(array $credentials): array
    {
        return ['valid' => true, 'errors' => []];
    }

    /**
     * {@inheritdoc}
     */
    public function getFormFields(): array
    {
        return [
            [
                'name' => 'repo_path',
                'label' => 'Repository Path',
                'type' => 'text',
                'required' => true,
                'placeholder' => '/mnt/backup/restic-repo',
            ],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function testConnection(string $repoPath, array $credentials): array
    {
        $parentDir = dirname($repoPath);

        if (! is_dir($parentDir)) {
            return ['success' => false, 'message' => "Parent directory does not exist: {$parentDir}"];
        }

        if (! is_writable($parentDir)) {
            return ['success' => false, 'message' => "Parent directory is not writable: {$parentDir}"];
        }

        return ['success' => true, 'message' => 'Local path is accessible and writable.'];
    }
}
