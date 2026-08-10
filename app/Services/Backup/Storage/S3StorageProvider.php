<?php

namespace App\Services\Backup\Storage;

use App\Contracts\BackupStorageProviderInterface;
use Aws\Exception\AwsException;
use Aws\S3\S3Client;

/**
 * S3-compatible storage provider for restic repositories.
 */
class S3StorageProvider implements BackupStorageProviderInterface
{
    /**
     * {@inheritdoc}
     */
    public function getDisplayName(): string
    {
        return 'S3-Compatible Storage';
    }

    /**
     * {@inheritdoc}
     */
    public function getRepositoryUri(string $repoPath, array $credentials): string
    {
        $endpoint = $credentials['endpoint'] ?? 'https://s3.amazonaws.com';
        $bucket = $credentials['bucket'] ?? '';

        // Remove trailing slash from endpoint
        $endpoint = rtrim($endpoint, '/');

        return "s3:{$endpoint}/{$bucket}{$repoPath}";
    }

    /**
     * {@inheritdoc}
     */
    public function getEnvironmentVariables(array $credentials): array
    {
        $env = [];

        if (! empty($credentials['access_key_id'])) {
            $env['AWS_ACCESS_KEY_ID'] = $credentials['access_key_id'];
        }

        if (! empty($credentials['secret_access_key'])) {
            $env['AWS_SECRET_ACCESS_KEY'] = $credentials['secret_access_key'];
        }

        if (! empty($credentials['region'])) {
            $env['AWS_DEFAULT_REGION'] = $credentials['region'];
        }

        return $env;
    }

    /**
     * {@inheritdoc}
     */
    public function validateCredentials(array $credentials): array
    {
        $errors = [];

        if (empty($credentials['endpoint'])) {
            $errors[] = 'Endpoint URL is required for S3.';
        }

        if (empty($credentials['bucket'])) {
            $errors[] = 'Bucket name is required for S3.';
        }

        if (empty($credentials['access_key_id'])) {
            $errors[] = 'Access Key ID is required for S3.';
        }

        if (empty($credentials['secret_access_key'])) {
            $errors[] = 'Secret Access Key is required for S3.';
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
                'placeholder' => '/restic-repo',
            ],
            [
                'name' => 'endpoint',
                'label' => 'Endpoint URL',
                'type' => 'text',
                'required' => true,
                'placeholder' => 'https://s3.amazonaws.com',
            ],
            [
                'name' => 'bucket',
                'label' => 'Bucket Name',
                'type' => 'text',
                'required' => true,
                'placeholder' => 'my-backup-bucket',
            ],
            [
                'name' => 'region',
                'label' => 'Region',
                'type' => 'text',
                'required' => false,
                'placeholder' => 'us-east-1',
            ],
            [
                'name' => 'access_key_id',
                'label' => 'Access Key ID',
                'type' => 'text',
                'required' => true,
                'placeholder' => 'AKIAIOSFODNN7EXAMPLE',
            ],
            [
                'name' => 'secret_access_key',
                'label' => 'Secret Access Key',
                'type' => 'password',
                'required' => true,
                'placeholder' => 'Enter secret access key',
            ],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function testConnection(string $repoPath, array $credentials): array
    {
        $endpoint = $credentials['endpoint'] ?? '';
        $bucket = $credentials['bucket'] ?? '';
        $accessKeyId = $credentials['access_key_id'] ?? '';
        $secretAccessKey = $credentials['secret_access_key'] ?? '';
        $region = $credentials['region'] ?? 'us-east-1';

        if (empty($endpoint) || empty($bucket) || empty($accessKeyId) || empty($secretAccessKey)) {
            return ['success' => false, 'message' => 'Endpoint, bucket, access key, and secret key are required.'];
        }

        try {
            $s3Client = new S3Client([
                'version' => 'latest',
                'region' => $region,
                'endpoint' => $endpoint,
                'credentials' => [
                    'key' => $accessKeyId,
                    'secret' => $secretAccessKey,
                ],
                'use_path_style_endpoint' => true,
            ]);

            $s3Client->headBucket(['Bucket' => $bucket]);

            return ['success' => true, 'message' => 'S3 connection successful. Bucket is accessible.'];
        } catch (AwsException $e) {
            $errorCode = $e->getAwsErrorCode();

            if ($errorCode === 'NoSuchBucket') {
                return ['success' => false, 'message' => "Bucket '{$bucket}' does not exist."];
            }

            if ($errorCode === 'AccessDenied') {
                return ['success' => false, 'message' => 'Access denied. Check your credentials.'];
            }

            return ['success' => false, 'message' => 'S3 connection failed: '.$e->getMessage()];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => 'S3 connection failed: '.$e->getMessage()];
        }
    }
}
