<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

/**
 * System Information Service
 *
 * Provides access to system-level identifiers and information.
 */
class SystemInfoService
{
    /**
     * Get or create the NAS UUID (machine-id).
     *
     * Reads from /etc/machine-id first. If missing or empty, generates a UUID,
     * writes it to /etc/machine-id, and returns it. Falls back to the settings
     * table if the file write fails.
     */
    public function getNasUuid(): string
    {
        $machineIdPath = '/etc/machine-id';
        if (File::exists($machineIdPath)) {
            $id = trim((string) file_get_contents($machineIdPath));
            if ($id !== '') {
                return $id;
            }
        }

        $uuid = (string) Str::uuid();

        $escapedUuid = escapeshellarg($uuid);
        $escapedPath = escapeshellarg($machineIdPath);
        shell_exec("echo {$escapedUuid} | sudo tee {$escapedPath} > /dev/null 2>&1");

        if (File::exists($machineIdPath)) {
            $written = trim((string) file_get_contents($machineIdPath));
            if ($written === $uuid) {
                return $uuid;
            }
        }

        Setting::setValue('system.nas_uuid', $uuid);

        return $uuid;
    }
}
