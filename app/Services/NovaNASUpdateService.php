<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

/**
 * NovaNAS Update Service
 *
 * Handles checking for NovaNAS application updates from GitHub releases.
 */
class NovaNASUpdateService
{
    protected const GITHUB_REPO = 'NovaNasOrg/NovaNAS';

    protected const GITHUB_API_URL = 'https://api.github.com/repos/'.self::GITHUB_REPO.'/releases/latest';

    /**
     * Check for available NovaNAS updates.
     *
     * @return array{available: bool, current_version: string|null, latest_version: string|null, message: string, error?: string}
     */
    public function checkForUpdates(): array
    {
        try {
            // Get current version from config
            $currentVersion = config('app.version');

            if (! $currentVersion) {
                return [
                    'available' => false,
                    'current_version' => null,
                    'latest_version' => null,
                    'message' => 'Current version not found in configuration',
                ];
            }

            // Fetch latest release from GitHub
            $response = Http::timeout(10)->get(self::GITHUB_API_URL);

            if (! $response->successful()) {
                Log::error('Failed to fetch NovaNAS release info from GitHub', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return [
                    'available' => false,
                    'current_version' => $currentVersion,
                    'latest_version' => null,
                    'message' => 'Failed to fetch release information',
                    'error' => 'GitHub API request failed',
                ];
            }

            $releaseData = $response->json();

            if (! isset($releaseData['tag_name'])) {
                return [
                    'available' => false,
                    'current_version' => $currentVersion,
                    'latest_version' => null,
                    'message' => 'Invalid release data received',
                    'error' => 'Missing tag_name in response',
                ];
            }

            $latestTag = $releaseData['tag_name'];
            $latestVersion = ltrim($latestTag, 'v'); // Remove 'v' prefix if present

            // Compare versions
            $isNewer = $this->isVersionNewer($latestVersion, $currentVersion);

            return [
                'available' => $isNewer,
                'current_version' => $currentVersion,
                'latest_version' => $latestVersion,
                'message' => $isNewer ? "New version {$latestVersion} is available" : 'NovaNAS is up to date',
            ];

        } catch (\Exception $e) {
            Log::error('Exception during NovaNAS update check', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'available' => false,
                'current_version' => config('app.version'),
                'latest_version' => null,
                'message' => 'An error occurred while checking for updates',
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Trigger the NovaNAS update process via systemd service.
     *
     * @return array{success: bool, message: string, error?: string}
     */
    public function triggerUpdate(): array
    {
        try {
            $result = Process::timeout(10)->run('sudo systemctl start novanas-update');

            if ($result->successful()) {
                return [
                    'success' => true,
                    'message' => 'NovaNAS update process started successfully',
                ];
            } else {
                $errorOutput = $result->errorOutput();

                Log::error('Failed to start novanas-update service', [
                    'exit_code' => $result->exitCode(),
                    'error_output' => $errorOutput,
                ]);

                return [
                    'success' => false,
                    'message' => 'Failed to start update process',
                    'error' => $errorOutput ?: 'Unknown error',
                ];
            }

        } catch (\Exception $e) {
            Log::error('Exception while triggering NovaNAS update', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'message' => 'An error occurred while starting the update',
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Compare two semantic versions to determine if the first is newer than the second.
     *
     * @return bool True if version1 > version2
     */
    protected function isVersionNewer(string $version1, string $version2): bool
    {
        // Simple version comparison: split by dots and compare numerically
        $v1Parts = explode('.', $version1);
        $v2Parts = explode('.', $version2);

        // Pad shorter version with zeros
        $maxLength = max(count($v1Parts), count($v2Parts));
        $v1Parts = array_pad($v1Parts, $maxLength, '0');
        $v2Parts = array_pad($v2Parts, $maxLength, '0');

        for ($i = 0; $i < $maxLength; $i++) {
            $v1Num = (int) $v1Parts[$i];
            $v2Num = (int) $v2Parts[$i];

            if ($v1Num > $v2Num) {
                return true;
            } elseif ($v1Num < $v2Num) {
                return false;
            }
        }

        return false; // Versions are equal
    }
}
