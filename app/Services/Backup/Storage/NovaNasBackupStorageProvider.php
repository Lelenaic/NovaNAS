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

        $protocol = $credentials['protocol'] ?? 'https';
        $hostname = $credentials['hostname'] ?? '';
        if ($hostname === '') {
            return '';
        }

        $repoPath = ltrim($repoPath, '/');

        $userPart = rawurlencode($user).':'.rawurlencode($pass).'@';

        return "rest:{$protocol}://{$userPart}{$hostname}/apache/backup-server/{$repoPath}";
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

        $hostname = $credentials['hostname'] ?? '';
        if ($hostname === '') {
            $errors[] = 'Hostname is required.';
        } elseif (! $this->isValidHostnameOrIp($hostname)) {
            $errors[] = 'Hostname must be a valid hostname, IPv4, or IPv6 address.';
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
     * Check if a string is a valid hostname or IP address.
     */
    protected function isValidHostnameOrIp(string $value): bool
    {
        if (filter_var($value, FILTER_VALIDATE_IP)) {
            return true;
        }

        // RFC 1123 hostname: labels separated by dots, each 1-63 chars, alphanumeric + hyphens, not starting/ending with hyphen
        return (bool) preg_match('/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?$/', $value);
    }

    /**
     * {@inheritdoc}
     */
    public function getFormFields(): array
    {
        return [
            [
                'name' => 'protocol',
                'label' => 'Protocol',
                'type' => 'select',
                'required' => true,
                'options' => ['https' => 'https', 'http' => 'http'],
            ],
            [
                'name' => 'hostname',
                'label' => 'Hostname / IP',
                'type' => 'text',
                'required' => true,
                'placeholder' => 'nas.example.com',
            ],
            [
                'name' => 'api_key',
                'label' => 'API Key',
                'type' => 'password',
                'required' => true,
                'placeholder' => 'Paste the API key',
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
        $protocol = $credentials['protocol'] ?? 'https';
        $hostname = $credentials['hostname'] ?? '';
        $apiKey = $credentials['api_key'] ?? '';
        $allowUnsigned = ! empty($credentials['allow_unsigned_cert']);

        if ($hostname === '' || $apiKey === '') {
            return ['success' => false, 'message' => 'Hostname and API key are required.'];
        }

        $decoded = $this->decodeApiKey($apiKey);
        if ($decoded === null) {
            return ['success' => false, 'message' => 'Invalid API key format. Must be base64-encoded username:password.'];
        }

        $baseUrl = "{$protocol}://{$hostname}/apache/backup-server";

        // Step 1: Try to reach the server
        try {
            $http = Http::timeout(10);
            if ($allowUnsigned) {
                $http = $http->withoutVerifying();
            }

            $response = $http->withBasicAuth($decoded['user'], $decoded['pass'])
                ->get($baseUrl);

            if ($response->status() === 401) {
                return ['success' => false, 'message' => 'Authentication failed. Bad API key.'];
            }

            if ($response->failed() && ! in_array($response->status(), [404, 405])) {
                return ['success' => false, 'message' => "Cannot reach the server (HTTP {$response->status()})."];
            }
        } catch (\Exception $e) {
            return ['success' => false, 'message' => 'Cannot reach the server: '.$e->getMessage()];
        }

        // Step 2: Verify it's a NovaNAS instance via the public identify endpoint
        $apiBaseUrl = "{$protocol}://{$hostname}";

        try {
            $identifyResponse = $http->get($apiBaseUrl.'/api/backup/server/identify');

            if ($identifyResponse->successful()) {
                $data = $identifyResponse->json();

                return [
                    'success' => true,
                    'message' => "Connected to NovaNAS backup server. Machine ID: {$data['machine_id']}, Version: {$data['version']}",
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
