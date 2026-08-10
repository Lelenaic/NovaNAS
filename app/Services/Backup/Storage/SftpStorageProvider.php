<?php

namespace App\Services\Backup\Storage;

use App\Contracts\BackupStorageProviderInterface;
use Illuminate\Support\Facades\Process;

/**
 * SFTP storage provider for restic repositories.
 */
class SftpStorageProvider implements BackupStorageProviderInterface
{
    /**
     * {@inheritdoc}
     */
    public function getDisplayName(): string
    {
        return 'SFTP (SSH)';
    }

    /**
     * {@inheritdoc}
     */
    public function getRepositoryUri(string $repoPath, array $credentials): string
    {
        $host = $credentials['host'] ?? '';
        $port = $credentials['port'] ?? '22';
        $user = $credentials['user'] ?? '';

        $portPart = $port !== '22' ? ":{$port}" : '';

        return "sftp://{$user}@{$host}{$portPart}{$repoPath}";
    }

    /**
     * {@inheritdoc}
     */
    public function getEnvironmentVariables(array $credentials): array
    {
        $env = [];

        if (! empty($credentials['password'])) {
            $env['RESTIC_PASSWORD'] = $credentials['password'];
        }

        // Handle private key authentication
        $authMethod = $credentials['auth_method'] ?? 'password';

        if ($authMethod === 'private_key' && ! empty($credentials['private_key'])) {
            $env['RESTIC_SFTP_COMMAND'] = 'ssh -i '.escapeshellarg($credentials['private_key']);
        }

        return $env;
    }

    /**
     * {@inheritdoc}
     */
    public function validateCredentials(array $credentials): array
    {
        $errors = [];

        if (empty($credentials['host'])) {
            $errors[] = 'Host is required for SFTP.';
        }

        if (empty($credentials['user'])) {
            $errors[] = 'Username is required for SFTP.';
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors,
        ];
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
                'placeholder' => '/srv/backups/restic-repo',
            ],
            [
                'name' => 'host',
                'label' => 'Host',
                'type' => 'text',
                'required' => true,
                'placeholder' => '192.168.1.100',
            ],
            [
                'name' => 'port',
                'label' => 'Port',
                'type' => 'number',
                'required' => false,
                'placeholder' => '22',
            ],
            [
                'name' => 'user',
                'label' => 'Username',
                'type' => 'text',
                'required' => true,
                'placeholder' => 'backup',
            ],
            [
                'name' => 'auth_method',
                'label' => 'Authentication Method',
                'type' => 'select',
                'required' => true,
                'options' => [
                    ['value' => 'password', 'label' => 'Password'],
                    ['value' => 'private_key', 'label' => 'Private Key'],
                ],
            ],
            [
                'name' => 'password',
                'label' => 'SSH Password',
                'type' => 'password',
                'required' => false,
                'placeholder' => 'Enter SSH password',
            ],
            [
                'name' => 'private_key',
                'label' => 'Private Key Path',
                'type' => 'text',
                'required' => false,
                'placeholder' => '/root/.ssh/id_rsa',
            ],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function testConnection(string $repoPath, array $credentials): array
    {
        $host = $credentials['host'] ?? '';
        $port = $credentials['port'] ?? '22';
        $user = $credentials['user'] ?? '';
        $authMethod = $credentials['auth_method'] ?? 'password';

        if (empty($host) || empty($user)) {
            return ['success' => false, 'message' => 'Host and username are required.'];
        }

        try {
            $sshOptions = [
                '-o ConnectTimeout=10',
                '-o StrictHostKeyChecking=no',
            ];

            if ($authMethod === 'private_key') {
                $privateKey = $credentials['private_key'] ?? '';
                if (empty($privateKey)) {
                    return ['success' => false, 'message' => 'Private key path is required.'];
                }
                $sshOptions[] = '-i '.escapeshellarg($privateKey);
            }

            $sshOptionsStr = implode(' ', $sshOptions);

            $result = Process::timeout(15)->run(
                "ssh {$sshOptionsStr} -p {$port} {$user}@{$host} echo 'connection_ok'"
            );

            if ($result->successful()) {
                return ['success' => true, 'message' => 'SFTP connection successful.'];
            }

            $error = $result->errorOutput() ?: $result->output();

            return ['success' => false, 'message' => "SFTP connection failed: {$error}"];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => 'SFTP connection failed: '.$e->getMessage()];
        }
    }
}
