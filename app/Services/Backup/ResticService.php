<?php

namespace App\Services\Backup;

use App\Contracts\BackupStorageProviderInterface;
use App\Enums\BackupStorageType;
use App\Models\BackupExecution;
use App\Models\BackupJob;
use App\Models\BackupRepository;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

/**
 * Service for interacting with restic backup program.
 *
 * All restic commands are executed via sudo to avoid permission issues.
 */
class ResticService
{
    /**
     * Get the storage provider for a repository.
     */
    public function getStorageProvider(BackupRepository $repository): BackupStorageProviderInterface
    {
        return match (BackupStorageType::from($repository->storage_type)) {
            BackupStorageType::Local => new Storage\LocalStorageProvider,
            BackupStorageType::Sftp => new Storage\SftpStorageProvider,
            BackupStorageType::S3 => new Storage\S3StorageProvider,
        };
    }

    /**
     * Test connection to a storage backend.
     *
     * @return array{success: bool, message: string}
     */
    public function testConnection(string $storageType, string $repoPath, array $credentials): array
    {
        $provider = match (BackupStorageType::from($storageType)) {
            BackupStorageType::Local => new Storage\LocalStorageProvider,
            BackupStorageType::Sftp => new Storage\SftpStorageProvider,
            BackupStorageType::S3 => new Storage\S3StorageProvider,
        };

        return $provider->testConnection($repoPath, $credentials);
    }

    /**
     * Initialize a restic repository.
     *
     * @return array{success: bool, message: string}
     */
    public function init(BackupRepository $repository): array
    {
        $provider = $this->getStorageProvider($repository);
        $uri = $provider->getRepositoryUri($repository->repo_path, $repository->credentials ?? []);
        $passwordFile = $this->createPasswordFile();

        try {
            $env = $this->buildEnvironment($repository, $provider, $passwordFile);
            $command = $this->buildResticCommand($uri, 'init');

            $result = Process::env($env)->run($command);

            if ($result->successful()) {
                $repository->update(['is_initialized' => true]);

                return ['success' => true, 'message' => 'Repository initialized successfully.'];
            }

            return ['success' => false, 'message' => "Failed to initialize repository: {$result->errorOutput()}"];
        } catch (\Exception $e) {
            Log::error('ResticService: Init failed', ['error' => $e->getMessage()]);

            return ['success' => false, 'message' => 'Failed to initialize repository: '.$e->getMessage()];
        } finally {
            $this->cleanupPasswordFile($passwordFile);
        }
    }

    /**
     * Run a backup for a job.
     *
     * @return array{success: bool, message: string, snapshot_id?: string}
     */
    public function backup(BackupJob $job, BackupExecution $execution): array
    {
        $repository = $job->repository;
        $provider = $this->getStorageProvider($repository);
        $uri = $provider->getRepositoryUri($repository->repo_path, $repository->credentials ?? []);
        $passwordFile = $this->createPasswordFile();

        try {
            $env = $this->buildEnvironment($repository, $provider, $passwordFile);
            $resticArgs = $this->buildBackupArgs($uri, $job);
            $command = $this->buildResticCommand($uri, null, $resticArgs);

            $command .= ' 2>&1';

            $result = Process::env($env)->run($command);

            $output = $result->output();
            $execution->appendLogs($output);

            if ($result->successful()) {
                $snapshotId = $this->parseSnapshotId($output);

                return [
                    'success' => true,
                    'message' => 'Backup completed successfully.',
                    'snapshot_id' => $snapshotId,
                ];
            }

            return ['success' => false, 'message' => "Backup failed: {$result->errorOutput()}"];
        } catch (\Exception $e) {
            Log::error('ResticService: Backup failed', ['job_id' => $job->id, 'error' => $e->getMessage()]);

            return ['success' => false, 'message' => 'Backup failed: '.$e->getMessage()];
        } finally {
            $this->cleanupPasswordFile($passwordFile);
        }
    }

    /**
     * Apply retention policy to a repository.
     *
     * @return array{success: bool, message: string}
     */
    public function forget(BackupRepository $repository, array $retentionPolicy): array
    {
        $provider = $this->getStorageProvider($repository);
        $uri = $provider->getRepositoryUri($repository->repo_path, $repository->credentials ?? []);
        $passwordFile = $this->createPasswordFile();

        try {
            $env = $this->buildEnvironment($repository, $provider, $passwordFile);
            $forgetArgs = $this->buildForgetArgs($retentionPolicy);
            $command = $this->buildResticCommand($uri, null, "forget {$forgetArgs} --prune");

            $result = Process::env($env)->run($command);

            if ($result->successful()) {
                return ['success' => true, 'message' => 'Retention policy applied successfully.'];
            }

            return ['success' => false, 'message' => "Failed to apply retention policy: {$result->errorOutput()}"];
        } catch (\Exception $e) {
            Log::error('ResticService: Forget failed', ['error' => $e->getMessage()]);

            return ['success' => false, 'message' => 'Failed to apply retention policy: '.$e->getMessage()];
        } finally {
            $this->cleanupPasswordFile($passwordFile);
        }
    }

    /**
     * List snapshots for a repository.
     *
     * @return array{success: bool, snapshots?: list<array<string, mixed>>, message?: string}
     */
    public function snapshots(BackupRepository $repository): array
    {
        $provider = $this->getStorageProvider($repository);
        $uri = $provider->getRepositoryUri($repository->repo_path, $repository->credentials ?? []);
        $passwordFile = $this->createPasswordFile();

        try {
            $env = $this->buildEnvironment($repository, $provider, $passwordFile);
            $command = $this->buildResticCommand($uri, 'snapshots', '--json');

            $result = Process::env($env)->run($command);

            if ($result->successful()) {
                $snapshots = json_decode($result->output(), true) ?? [];

                return ['success' => true, 'snapshots' => $snapshots];
            }

            return ['success' => false, 'message' => "Failed to list snapshots: {$result->errorOutput()}"];
        } catch (\Exception $e) {
            Log::error('ResticService: List snapshots failed', ['error' => $e->getMessage()]);

            return ['success' => false, 'message' => 'Failed to list snapshots: '.$e->getMessage()];
        } finally {
            $this->cleanupPasswordFile($passwordFile);
        }
    }

    /**
     * Delete a snapshot from a repository.
     *
     * @return array{success: bool, message: string}
     */
    public function deleteSnapshot(BackupRepository $repository, string $snapshotId): array
    {
        $provider = $this->getStorageProvider($repository);
        $uri = $provider->getRepositoryUri($repository->repo_path, $repository->credentials ?? []);
        $passwordFile = $this->createPasswordFile();

        try {
            $env = $this->buildEnvironment($repository, $provider, $passwordFile);
            $command = $this->buildResticCommand($uri, null, 'forget '.escapeshellarg($snapshotId));

            $result = Process::env($env)->run($command);

            if ($result->successful()) {
                return ['success' => true, 'message' => 'Snapshot deleted successfully.'];
            }

            return ['success' => false, 'message' => "Failed to delete snapshot: {$result->errorOutput()}"];
        } catch (\Exception $e) {
            Log::error('ResticService: Delete snapshot failed', ['error' => $e->getMessage()]);

            return ['success' => false, 'message' => 'Failed to delete snapshot: '.$e->getMessage()];
        } finally {
            $this->cleanupPasswordFile($passwordFile);
        }
    }

    /**
     * Check repository integrity.
     *
     * @return array{success: bool, message: string}
     */
    public function check(BackupRepository $repository): array
    {
        $provider = $this->getStorageProvider($repository);
        $uri = $provider->getRepositoryUri($repository->repo_path, $repository->credentials ?? []);
        $passwordFile = $this->createPasswordFile();

        try {
            $env = $this->buildEnvironment($repository, $provider, $passwordFile);
            $command = $this->buildResticCommand($uri, 'check');

            $result = Process::env($env)->run($command);

            if ($result->successful()) {
                $repository->update(['last_check_at' => now()]);

                return ['success' => true, 'message' => 'Repository integrity check passed.'];
            }

            return ['success' => false, 'message' => "Integrity check failed: {$result->errorOutput()}"];
        } catch (\Exception $e) {
            Log::error('ResticService: Check failed', ['error' => $e->getMessage()]);

            return ['success' => false, 'message' => 'Integrity check failed: '.$e->getMessage()];
        } finally {
            $this->cleanupPasswordFile($passwordFile);
        }
    }

    /**
     * Get repository statistics.
     *
     * @return array{success: bool, stats?: array<string, mixed>, message?: string}
     */
    public function stats(BackupRepository $repository): array
    {
        $provider = $this->getStorageProvider($repository);
        $uri = $provider->getRepositoryUri($repository->repo_path, $repository->credentials ?? []);
        $passwordFile = $this->createPasswordFile();

        try {
            $env = $this->buildEnvironment($repository, $provider, $passwordFile);
            $command = $this->buildResticCommand($uri, 'stats', '--mode raw-data --json');

            $result = Process::env($env)->run($command);

            if ($result->successful()) {
                $stats = json_decode($result->output(), true) ?? [];

                return ['success' => true, 'stats' => $stats];
            }

            return ['success' => false, 'message' => "Failed to get stats: {$result->errorOutput()}"];
        } catch (\Exception $e) {
            Log::error('ResticService: Stats failed', ['error' => $e->getMessage()]);

            return ['success' => false, 'message' => 'Failed to get stats: '.$e->getMessage()];
        } finally {
            $this->cleanupPasswordFile($passwordFile);
        }
    }

    /**
     * Build a restic command string.
     */
    protected function buildResticCommand(string $uri, ?string $subcommand, ?string $extraArgs = null): string
    {
        $parts = ['sudo -E restic -r '.escapeshellarg($uri)];

        if ($subcommand !== null) {
            $parts[] = $subcommand;
        }

        if ($extraArgs !== null) {
            $parts[] = $extraArgs;
        }

        return implode(' ', $parts);
    }

    /**
     * Build environment variables for Process::env().
     *
     * @return array<string, string>
     */
    protected function buildEnvironment(BackupRepository $repository, BackupStorageProviderInterface $provider, string $passwordFile): array
    {
        $env = [
            'RESTIC_PASSWORD_FILE' => $passwordFile,
        ];

        foreach ($provider->getEnvironmentVariables($repository->credentials ?? []) as $key => $value) {
            $env[$key] = $value;
        }

        return $env;
    }

    /**
     * Build the restic backup arguments.
     */
    protected function buildBackupArgs(string $uri, BackupJob $job): string
    {
        $parts = ['backup'];

        foreach ($job->source_paths as $path) {
            $parts[] = escapeshellarg($path);
        }

        if (! empty($job->exclude_patterns)) {
            foreach ($job->exclude_patterns as $pattern) {
                $parts[] = '--exclude '.escapeshellarg($pattern);
            }
        }

        if (! empty($job->tags)) {
            foreach ($job->tags as $tag) {
                $parts[] = '--tag '.escapeshellarg($tag);
            }
        }

        if ($job->compression !== 'auto') {
            $parts[] = '--compression '.escapeshellarg($job->compression);
        }

        $parts[] = '--json';

        return implode(' ', $parts);
    }

    /**
     * Build the forget command arguments from retention policy.
     */
    protected function buildForgetArgs(array $retentionPolicy): string
    {
        $args = [];

        if (isset($retentionPolicy['keep_last'])) {
            $args[] = '--keep-last '.(int) $retentionPolicy['keep_last'];
        }

        if (isset($retentionPolicy['keep_hourly'])) {
            $args[] = '--keep-hourly '.(int) $retentionPolicy['keep_hourly'];
        }

        if (isset($retentionPolicy['keep_daily'])) {
            $args[] = '--keep-daily '.(int) $retentionPolicy['keep_daily'];
        }

        if (isset($retentionPolicy['keep_weekly'])) {
            $args[] = '--keep-weekly '.(int) $retentionPolicy['keep_weekly'];
        }

        if (isset($retentionPolicy['keep_monthly'])) {
            $args[] = '--keep-monthly '.(int) $retentionPolicy['keep_monthly'];
        }

        if (isset($retentionPolicy['keep_yearly'])) {
            $args[] = '--keep-yearly '.(int) $retentionPolicy['keep_yearly'];
        }

        return implode(' ', $args);
    }

    /**
     * Create a temporary password file for restic.
     */
    protected function createPasswordFile(): string
    {
        $key = config('app.key');
        $password = str_starts_with($key, 'base64:') ? base64_decode(substr($key, 7)) : $key;
        $tmpFile = tempnam(sys_get_temp_dir(), 'restic_pw_');
        file_put_contents($tmpFile, $password);
        chmod($tmpFile, 0600);

        return $tmpFile;
    }

    /**
     * Remove the temporary password file.
     */
    protected function cleanupPasswordFile(string $passwordFile): void
    {
        if (file_exists($passwordFile)) {
            @unlink($passwordFile);
        }
    }

    /**
     * Parse snapshot ID from restic backup output.
     */
    protected function parseSnapshotId(string $output): ?string
    {
        $lines = explode("\n", $output);

        foreach ($lines as $line) {
            $data = json_decode($line, true);

            if (is_array($data) && isset($data['snapshot_id'])) {
                return $data['snapshot_id'];
            }
        }

        return null;
    }
}
