<?php

namespace App\Contracts;

/**
 * Interface for backup storage provider implementations.
 *
 * Each storage backend (Local, SFTP, S3, etc.) must implement this interface
 * to handle repository initialization, URI generation, and credential management.
 */
interface BackupStorageProviderInterface
{
    /**
     * Get the display name for this storage provider.
     */
    public function getDisplayName(): string;

    /**
     * Get the restic repository URI for the given path and credentials.
     *
     * @param  string  $repoPath  The repository path or URI
     * @param  array<string, mixed>  $credentials  Provider-specific credentials
     */
    public function getRepositoryUri(string $repoPath, array $credentials): string;

    /**
     * Get environment variables needed for restic to authenticate.
     *
     * @param  array<string, mixed>  $credentials  Provider-specific credentials
     * @return array<string, string>
     */
    public function getEnvironmentVariables(array $credentials): array;

    /**
     * Validate that the required credentials are present and valid.
     *
     * @param  array<string, mixed>  $credentials  Provider-specific credentials
     * @return array{valid: bool, errors: list<string>}
     */
    public function validateCredentials(array $credentials): array;

    /**
     * Get the form field definitions for this provider.
     *
     * Returns an array of field definitions for the frontend form.
     *
     * @return list<array{name: string, label: string, type: string, required: bool, placeholder?: string}>
     */
    public function getFormFields(): array;

    /**
     * Test the connection to the storage backend.
     *
     * @param  string  $repoPath  The repository path or URI
     * @param  array<string, mixed>  $credentials  Provider-specific credentials
     * @return array{success: bool, message: string}
     */
    public function testConnection(string $repoPath, array $credentials): array;
}
