<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
            'invitation_lifetime_hours' => (int) ($settings['users.invitation_lifetime_hours'] ?? 48),
            'user_files_home' => $settings['storage.user_files_home'] ?? '',
            'app_folders_home' => $settings['storage.app_folders_home'] ?? '',
        ]);
    }

    /**
     * Update general settings.
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'invitation_lifetime_hours' => 'required|integer|min:1|max:720',
        ]);

        Setting::setValue('users.invitation_lifetime_hours', (string) $validated['invitation_lifetime_hours']);

        return response()->json([
            'message' => 'Settings saved successfully.',
        ]);
    }
}
