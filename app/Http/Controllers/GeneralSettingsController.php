<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Process;

/**
 * Controller for managing general settings.
 */
class GeneralSettingsController extends Controller
{
    /**
     * Get general settings.
     */
    public function index(): JsonResponse
    {
        $settings = Setting::getMultiple([
            'users.invitation_lifetime_hours',
            'storage.user_files_home',
            'storage.app_folders_home',
        ]);

        return response()->json([
            'invitation_lifetime_hours' => (int) $settings['users.invitation_lifetime_hours'],
            'user_files_home' => $settings['storage.user_files_home'],
            'app_folders_home' => $settings['storage.app_folders_home'],
            'hostname' => $this->getHostname(),
        ]);
    }

    /**
     * Update general settings.
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'invitation_lifetime_hours' => 'sometimes|required|integer|min:1|max:720',
            'hostname' => 'sometimes|required|string|max:255',
        ]);

        if (isset($validated['invitation_lifetime_hours'])) {
            Setting::setValue('users.invitation_lifetime_hours', (string) $validated['invitation_lifetime_hours']);
        }

        if (isset($validated['hostname'])) {
            $this->setHostname($validated['hostname']);
        }

        return response()->json([
            'message' => 'Settings saved successfully.',
            'hostname' => $this->getHostname(),
        ]);
    }

    /**
     * Get the current system hostname.
     */
    protected function getHostname(): string
    {
        $hostname = gethostname();

        return $hostname ?: 'localhost';
    }

    /**
     * Set the system hostname.
     */
    protected function setHostname(string $hostname): void
    {
        Process::run(['sudo', 'hostnamectl', 'set-hostname', $hostname]);
    }
}
