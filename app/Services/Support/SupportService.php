<?php

namespace App\Services\Support;

use App\Models\InstalledApplication;
use App\Models\Setting;
use App\Services\NovaNasApiService;
use App\Services\Storage\StorageService;
use App\Services\UpdateService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

/**
 * Support Service
 *
 * Collects system information and manages support ticket operations.
 */
class SupportService
{
    public function __construct(
        protected NovaNasApiService $apiService,
        protected StorageService $storageService,
        protected UpdateService $updateService,
    ) {}

    /**
     * Get or create the NAS UUID.
     *
     * Reads from /etc/machine-id first. If missing or empty, generates a UUID,
     * writes it to /etc/machine-id, and returns it. Falls back to the settings
     * table if the file write fails.
     */
    public function getNasUuid(): string
    {
        // Try reading from /etc/machine-id
        $machineIdPath = '/etc/machine-id';
        if (File::exists($machineIdPath)) {
            $id = trim((string) file_get_contents($machineIdPath));
            if ($id !== '') {
                return $id;
            }
        }

        // Generate a new UUID and try to persist it
        $uuid = (string) Str::uuid();

        // Attempt to write to /etc/machine-id via sudo
        $escapedUuid = escapeshellarg($uuid);
        $escapedPath = escapeshellarg($machineIdPath);
        $result = shell_exec("echo {$escapedUuid} | sudo tee {$escapedPath} > /dev/null 2>&1");

        if (File::exists($machineIdPath)) {
            $written = trim((string) file_get_contents($machineIdPath));
            if ($written === $uuid) {
                return $uuid;
            }
        }

        // Fallback: store in the settings table
        Setting::setValue('system.nas_uuid', $uuid);

        return $uuid;
    }

    /**
     * Collect all system information for a support ticket.
     *
     * @return array{nas_uuid: string, email: string, novanas_version: string, debian_version: string|null, storage_info: list<string>, installed_software: list<string>, apt_updates_count: int|null}
     */
    public function collectSystemInfo(?string $userEmail = null): array
    {
        $nasUuid = $this->getNasUuid();
        $novanasVersion = config('app.version', 'unknown');
        $debianVersion = $this->getDebianVersion();
        $storageInfo = $this->getStorageInfo();
        $installedSoftware = $this->getInstalledSoftware();
        $aptUpdatesCount = $this->getAptUpdatesCount();

        return [
            'nas_uuid' => $nasUuid,
            'email' => $userEmail ?? '',
            'novanas_version' => $novanasVersion,
            'debian_version' => $debianVersion,
            'storage_info' => $storageInfo,
            'installed_software' => $installedSoftware,
            'apt_updates_count' => $aptUpdatesCount,
        ];
    }

    /**
     * Create a support ticket via the cloud API.
     *
     * @param  array{email: string, nas_uuid: string, subject: string, body: string, debian_version?: string|null, novanas_version?: string|null, storage_info?: list<string>|null, installed_software?: list<string>|null, apt_updates_count?: int|null, attachments?: array<int, UploadedFile>}  $data
     * @return array{success: bool, data?: array{id: int, security_key: string, subject: string, status: string, created_at: string}, error?: string, status?: int}
     */
    public function createTicket(array $data): array
    {
        return $this->apiService->createSupportTicket($data);
    }

    /**
     * Get messages for a support ticket.
     *
     * @return array{success: bool, data?: array{ticket: array{id: int, subject: string, status: string}, messages: array<int, mixed>}, error?: string}
     */
    public function getMessages(int $ticketId, string $securityKey): array
    {
        return $this->apiService->getSupportMessages($ticketId, $securityKey);
    }

    /**
     * Send a message to a support ticket.
     *
     * @param  array{body: string, attachments?: array<int, UploadedFile>}  $data
     * @return array{success: bool, data?: array{id: int, body: string, is_staff: bool, created_at: string}, error?: string, status?: int}
     */
    public function sendMessage(int $ticketId, string $securityKey, array $data): array
    {
        return $this->apiService->sendSupportMessage($ticketId, $securityKey, $data);
    }

    /**
     * Edit a message in a support ticket.
     *
     * @return array{success: bool, data?: array{id: int, body: string, is_staff: bool, created_at: string}, error?: string, status?: int}
     */
    public function editMessage(int $ticketId, int $messageId, string $securityKey, string $body): array
    {
        return $this->apiService->editSupportMessage($ticketId, $messageId, $securityKey, $body);
    }

    /**
     * Get the Debian version string.
     */
    protected function getDebianVersion(): ?string
    {
        $path = '/etc/debian_version';
        if (File::exists($path)) {
            $version = trim((string) file_get_contents($path));

            return $version !== '' ? $version : null;
        }

        return null;
    }

    /**
     * Get storage pool information as human-readable strings.
     *
     * @return list<string>
     */
    protected function getStorageInfo(): array
    {
        $pools = $this->storageService->listPools();
        $info = [];

        foreach ($pools as $pool) {
            $sizeGb = round($pool['size'] / (1024 ** 3), 1);
            $usedGb = round(($pool['size'] - $pool['free']) / (1024 ** 3), 1);
            $info[] = "{$pool['name']} ({$pool['type']}): {$usedGb}GB/{$sizeGb}GB used, health: {$pool['health']}";
        }

        return $info;
    }

    /**
     * Get list of installed software titles.
     *
     * @return list<string>
     */
    protected function getInstalledSoftware(): array
    {
        return InstalledApplication::pluck('title')->filter()->values()->all();
    }

    /**
     * Get the count of available apt updates.
     */
    protected function getAptUpdatesCount(): ?int
    {
        $status = $this->updateService->getUpdateStatus();

        return $status['count'] ?? null;
    }
}
