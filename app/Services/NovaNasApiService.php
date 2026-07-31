<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * NovaNAS API Service
 *
 * Provides methods for interacting with the NovaNAS cloud API.
 */
class NovaNasApiService
{
    /**
     * Get the base URL for the NovaNAS API.
     */
    public function getBaseUrl(): string
    {
        return config('services.novanas.api_url');
    }

    /**
     * Check if a domain is reachable from the internet via the NovaNAS API.
     *
     * @param  string  $domain  The domain to check (e.g. "myhost.mynovanas.com")
     * @return array{reachable: bool, ip?: string, message?: string}
     */
    public function checkReachability(string $domain): array
    {
        $url = $this->getBaseUrl().'/check-reachability';

        try {
            $response = Http::timeout(15)->post($url, [
                'domain' => $domain,
            ]);

            if ($response->successful()) {
                $data = $response->json();

                return [
                    'reachable' => $data['reachable'] ?? false,
                    'ip' => $data['ip'] ?? null,
                    'message' => $data['message'] ?? null,
                ];
            }

            Log::warning('NovaNAS reachability check failed', [
                'domain' => $domain,
                'status' => $response->status(),
                'response' => $response->json(),
            ]);

            return [
                'reachable' => false,
                'message' => 'Reachability check failed: HTTP '.$response->status(),
            ];
        } catch (\Exception $e) {
            Log::error('NovaNAS reachability check exception', [
                'domain' => $domain,
                'error' => $e->getMessage(),
            ]);

            return [
                'reachable' => false,
                'message' => 'Reachability check failed: '.$e->getMessage(),
            ];
        }
    }
}
