<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
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

    /**
     * Create a new support ticket via the NovaNAS cloud API.
     *
     * @param  array{email: string, nas_uuid: string, subject: string, body: string, debian_version?: string|null, novanas_version?: string|null, storage_info?: list<string>|null, installed_software?: list<string>|null, apt_updates_count?: int|null, attachments?: array<int, UploadedFile>}  $data
     * @return array{success: bool, data?: array{id: int, security_key: string, subject: string, status: string, created_at: string}, error?: string, status?: int}
     */
    public function createSupportTicket(array $data): array
    {
        $url = $this->getBaseUrl().'/support/tickets';

        try {
            $http = Http::timeout(30);

            // Build multipart form data
            $multipart = [
                ['name' => 'email', 'contents' => $data['email']],
                ['name' => 'nas_uuid', 'contents' => $data['nas_uuid']],
                ['name' => 'subject', 'contents' => $data['subject']],
                ['name' => 'body', 'contents' => $data['body']],
            ];

            if (isset($data['debian_version']) && $data['debian_version'] !== null) {
                $multipart[] = ['name' => 'debian_version', 'contents' => $data['debian_version']];
            }
            if (isset($data['novanas_version']) && $data['novanas_version'] !== null) {
                $multipart[] = ['name' => 'novanas_version', 'contents' => $data['novanas_version']];
            }
            if (isset($data['storage_info']) && $data['storage_info'] !== null) {
                foreach ($data['storage_info'] as $index => $info) {
                    $multipart[] = ['name' => "storage_info[{$index}]", 'contents' => $info];
                }
            }
            if (isset($data['installed_software']) && $data['installed_software'] !== null) {
                foreach ($data['installed_software'] as $index => $software) {
                    $multipart[] = ['name' => "installed_software[{$index}]", 'contents' => $software];
                }
            }
            if (isset($data['apt_updates_count']) && $data['apt_updates_count'] !== null) {
                $multipart[] = ['name' => 'apt_updates_count', 'contents' => (string) $data['apt_updates_count']];
            }

            // Handle file attachments (max 10)
            if (isset($data['attachments']) && is_array($data['attachments'])) {
                foreach (array_slice($data['attachments'], 0, 10) as $attachment) {
                    $multipart[] = [
                        'name' => 'attachments[]',
                        'contents' => file_get_contents($attachment->getPathname()),
                        'filename' => $attachment->getClientOriginalName(),
                    ];
                }
            }

            $response = $http->attach($multipart)->post($url);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'data' => $response->json('data'),
                ];
            }

            Log::warning('NovaNAS support ticket creation failed', [
                'status' => $response->status(),
                'response' => $response->json(),
            ]);

            return [
                'success' => false,
                'error' => $response->json('message') ?? $response->json('error') ?? 'Failed to create support ticket.',
                'status' => $response->status(),
            ];
        } catch (\Exception $e) {
            Log::error('NovaNAS support ticket creation exception', [
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => 'Failed to create support ticket: '.$e->getMessage(),
            ];
        }
    }

    /**
     * Get messages for a support ticket.
     *
     * @return array{success: bool, data?: array{ticket: array{id: int, subject: string, status: string}, messages: array<int, mixed>}, error?: string}
     */
    public function getSupportMessages(int $ticketId, string $securityKey): array
    {
        $url = $this->getBaseUrl().'/support/tickets/'.$ticketId.'/messages';

        try {
            $response = Http::timeout(15)
                ->withHeaders(['X-Support-Key' => $securityKey])
                ->get($url);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'data' => $response->json('data'),
                ];
            }

            return [
                'success' => false,
                'error' => $response->json('error') ?? 'Failed to retrieve messages.',
            ];
        } catch (\Exception $e) {
            Log::error('NovaNAS support messages fetch exception', [
                'ticket_id' => $ticketId,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => 'Failed to retrieve messages: '.$e->getMessage(),
            ];
        }
    }

    /**
     * Send a message to a support ticket.
     *
     * @param  array{body: string, attachments?: array<int, UploadedFile>}  $data
     * @return array{success: bool, data?: array{id: int, body: string, is_staff: bool, created_at: string}, error?: string, status?: int}
     */
    public function sendSupportMessage(int $ticketId, string $securityKey, array $data): array
    {
        $url = $this->getBaseUrl().'/support/tickets/'.$ticketId.'/messages';

        try {
            $http = Http::timeout(30)
                ->withHeaders(['X-Support-Key' => $securityKey]);

            $multipart = [
                ['name' => 'body', 'contents' => $data['body']],
            ];

            if (isset($data['attachments']) && is_array($data['attachments'])) {
                foreach (array_slice($data['attachments'], 0, 10) as $attachment) {
                    $multipart[] = [
                        'name' => 'attachments[]',
                        'contents' => file_get_contents($attachment->getPathname()),
                        'filename' => $attachment->getClientOriginalName(),
                    ];
                }
            }

            $response = $http->attach($multipart)->post($url);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'data' => $response->json('data'),
                ];
            }

            return [
                'success' => false,
                'error' => $response->json('message') ?? $response->json('error') ?? 'Failed to send message.',
                'status' => $response->status(),
            ];
        } catch (\Exception $e) {
            Log::error('NovaNAS support message send exception', [
                'ticket_id' => $ticketId,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => 'Failed to send message: '.$e->getMessage(),
            ];
        }
    }

    /**
     * Edit a message in a support ticket.
     *
     * @return array{success: bool, data?: array{id: int, body: string, is_staff: bool, created_at: string}, error?: string, status?: int}
     */
    public function editSupportMessage(int $ticketId, int $messageId, string $securityKey, string $body): array
    {
        $url = $this->getBaseUrl().'/support/tickets/'.$ticketId.'/messages/'.$messageId;

        try {
            $response = Http::timeout(15)
                ->withHeaders(['X-Support-Key' => $securityKey])
                ->put($url, ['body' => $body]);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'data' => $response->json('data'),
                ];
            }

            return [
                'success' => false,
                'error' => $response->json('message') ?? $response->json('error') ?? 'Failed to edit message.',
                'status' => $response->status(),
            ];
        } catch (\Exception $e) {
            Log::error('NovaNAS support message edit exception', [
                'ticket_id' => $ticketId,
                'message_id' => $messageId,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => 'Failed to edit message: '.$e->getMessage(),
            ];
        }
    }
}
