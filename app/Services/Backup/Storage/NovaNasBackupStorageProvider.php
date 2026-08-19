<?php

namespace App\Services\Backup\Storage;

use App\Contracts\BackupStorageProviderInterface;
use Illuminate\Support\Facades\Http;

/**
 * NovaNAS Backup Server storage provider for restic repositories.
 *
 * Connects to a remote NovaNAS instance running a restic rest-server
 * behind Apache with htpasswd authentication.
 */
class NovaNasBackupStorageProvider implements BackupStorageProviderInterface
{
    /**
     * {@inheritdoc}
     */
    public function getDisplayName(): string
    {
        return 'NovaNAS Backup Server';
    }

    /**
     * {@inheritdoc}
     */
    public function getRepositoryUri(string $repoPath, array $credentials): string
    {
        $decoded = $this->decodeApiKey($credentials['api_key'] ?? '');
        if ($decoded === null) {
            return '';
        }

        ['user' => $user, 'pass' => $pass] = $decoded;

        $serverUrl = rtrim($credentials['server_url'] ?? '', '/');
        $parsedUrl = parse_url($serverUrl);
        if ($parsedUrl === false) {
            return '';
        }

        $scheme = $parsedUrl['scheme'] ?? 'https';
        $host = $parsedUrl['host'] ?? '';
        $port = isset($parsedUrl['port']) ? ':'.$parsedUrl['port'] : '';
        $basePath = $parsedUrl['path'] ?? '';

        $basePath = rtrim($basePath, '/');

        $repoPath = ltrim($repoPath, '/');

        $userPart = rawurlencode($user).':'.rawurlencode($pass).'@';

        return "rest:{$scheme}://{$userPart}{$host}{$port}{$basePath}/{$repoPath}";
    }

    /**
     * {@inheritdoc}
     */
    public function getEnvironmentVariables(array $credentials): array
    {
        $env = [];

        if (! empty($credentials['allow_unsigned_cert'])) {
            $env['RESTIC_INSECURE_TLS'] = '1';
        }

        return $env;
    }

    /**
     * {@inheritdoc}
     */
    public function validateCredentials(array $credentials): array
    {
        $errors = [];

        if (empty($credentials['server_url'])) {
            $errors[] = 'Server URL is required.';
        }

        if (empty($credentials['api_key'])) {
            $errors[] = 'API key is required.';
        }

        if (empty($credentials['repo_path'])) {
            $errors[] = 'Repository path is required.';
        }

        if (! empty($credentials['api_key']) && $this->decodeApiKey($credentials['api_key']) === null) {
            $errors[] = 'API key must be a valid base64-encoded username:password string.';
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
                'name' => 'server_url',
                'label' => 'Server URL',
                'type' => 'text',
                'required' => true,
                'placeholder' => 'https://nas.example.com/apache/backup-server',
            ],
            [
                'name' => 'api_key',
                'label' => 'API Key',
                'type' => 'password',
                'required' => true,
                'placeholder' => 'Paste the base64-encoded API key',
            ],
            [
                'name' => 'repo_path',
                'label' => 'Repository Path',
                'type' => 'text',
                'required' => true,
                'placeholder' => 'my-backups',
            ],
            [
                'name' => 'allow_unsigned_cert',
                'label' => 'Allow unsigned/self-signed certificates',
                'type' => 'checkbox',
                'required' => false,
            ],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function testConnection(string $repoPath, array $credentials): array
    {
        $serverUrl = rtrim($credentials['server_url'] ?? '', '/');
        $apiKey = $credentials['api_key'] ?? '';
        $allowUnsigned = ! empty($credentials['allow_unsigned_cert']);

        if (empty($serverUrl) || empty($apiKey)) {
            return ['success' => false, 'message' => 'Server URL and API key are required.'];
        }

        $decoded = $this->decodeApiKey($apiKey);
        if ($decoded === null) {
            return ['success' => false, 'message' => 'Invalid API key format. Must be base64-encoded username:password.'];
        }

        // Step 1: Try to reach the server
        try {
            $http = Http::timeout(10);
            if ($allowUnsigned) {
                $http = $http->withoutVerifying();
            }

            $response = $http->withBasicAuth($decoded['user'], $decoded['pass'])
                ->get($serverUrl);

            if ($response->status() === 401) {
                return ['success' => false, 'message' => 'Authentication failed. Bad API key.'];
            }

            if ($response->failed() && $response->status() !== 404) {
                return ['success' => false, 'message' => "Cannot reach the server (HTTP {$response->status()})."];
            }
        } catch (\Exception $e) {
            return ['success' => false, 'message' => 'Cannot reach the server: '.$e->getMessage()];
        }

        // Step 2: Verify it's a NovaNAS instance by checking the machine-id endpoint
        $parsedUrl = parse_url($serverUrl);
        $baseUrl = ($parsedUrl['scheme'] ?? 'https').'://'.$parsedUrl['host'].(isset($parsedUrl['port']) ? ':'.$parsedUrl['port'] : '');

        try {
            $machineIdResponse = $http->withBasicAuth($decoded['user'], $decoded['pass'])
                ->get($baseUrl.'/api/backup/server/machine-id');

            if ($machineIdResponse->successful()) {
                $machineId = $machineIdResponse->json('machine_id');

                return [
                    'success' => true,
                    'message' => "Connected to NovaNAS backup server. Machine ID: {$machineId}",
                    'machine_id' => $machineId,
                ];
            }
        } catch (\Exception $e) {
            // Fall through to generic check
        }

        // Step 3: Try to reach the Laravel API to confirm it's NovaNAS
        try {
            $statusResponse = $http->withBasicAuth($decoded['user'], $decoded['pass'])
                ->get($baseUrl.'/api/backup/server/status');

            if ($statusResponse->successful()) {
                return [
                    'success' => true,
                    'message' => 'Connected to NovaNAS backup server.',
                ];
            }
        } catch (\Exception $e) {
            // Fall through
        }

        return [
            'success' => false,
            'message' => 'We could reach the server, but it does not appear to be a NovaNAS backup instance. Are you sure you created an API key so the backup server has started?',
        ];
    }

    /**
     * Decode the base64 API key into user and password.
     *
     * @return array{user: string, pass: string}|null
     */
    protected function decodeApiKey(string $apiKey): ?array
    {
        $decoded = base64_decode($apiKey, true);
        if ($decoded === false || ! str_contains($decoded, ':')) {
            return null;
        }

        $colonPos = strpos($decoded, ':');

        return [
            'user' => substr($decoded, 0, $colonPos),
            'pass' => substr($decoded, $colonPos + 1),
        ];
    }
}
