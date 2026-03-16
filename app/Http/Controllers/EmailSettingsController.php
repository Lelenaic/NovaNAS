<?php

namespace App\Http\Controllers;

use App\Services\EmailService;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

/**
 * Controller for managing SMTP email settings.
 */
class EmailSettingsController extends Controller
{
    /**
     * Get current SMTP settings.
     */
    public function index(): JsonResponse
    {
        $settings = Setting::getMultiple(array_values(EmailService::KEYS));

        // Don't return the actual password - return a masked version if set
        $password = $settings['smtp_password'];

        return response()->json([
            'smtp_host' => $settings['smtp_host'] ?? '',
            'smtp_port' => $settings['smtp_port'] ?? '587',
            'smtp_username' => $settings['smtp_username'] ?? '',
            'smtp_password' => $password ? '***' : '',
            'smtp_encryption' => $settings['smtp_encryption'] ?? 'tls',
            'smtp_from_address' => $settings['smtp_from_address'] ?? '',
            'smtp_from_name' => $settings['smtp_from_name'] ?? 'NovaNAS',
            'is_configured' => !empty($settings['smtp_host']) && !empty($settings['smtp_username']),
        ]);
    }

    /**
     * Store SMTP settings.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'smtp_host' => 'required|string|max:255',
            'smtp_port' => 'required|integer|min:1|max:65535',
            'smtp_username' => 'nullable|string|max:255',
            'smtp_password' => 'nullable|string',
            'smtp_encryption' => 'required|in:none,ssl,tls',
            'smtp_from_address' => 'required|email|max:255',
            'smtp_from_name' => 'required|string|max:255',
        ]);

        // Store each setting
        foreach (EmailService::KEYS as $key) {
            // Only update password if not masked (i.e., actually provided)
            // Skip if password is '***' (masked) or empty (preserves existing password)
            if ($key === 'smtp_password' && (empty($validated[$key]) || $validated[$key] === '***')) {
                continue;
            }

            Setting::setValue($key, $validated[$key] ?? '');
        }

        return response()->json([
            'message' => 'Email settings saved successfully.',
        ]);
    }

    /**
     * Test SMTP settings by sending a test email.
     */
    public function test(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'test_email' => 'required|email',
        ]);

        // Get current settings
        $settings = Setting::getMultiple(array_values(EmailService::KEYS));

        // Check if SMTP is configured
        if (empty($settings['smtp_host']) || empty($settings['smtp_username'])) {
            return response()->json([
                'success' => false,
                'message' => 'SMTP settings are not configured. Please save your settings first.',
            ], 400);
        }

        // Configure mail with SMTP settings
        config([
            'mail.mailers.smtp.host' => $settings['smtp_host'],
            'mail.mailers.smtp.port' => $settings['smtp_port'] ?? 587,
            'mail.mailers.smtp.username' => $settings['smtp_username'],
            'mail.mailers.smtp.password' => $settings['smtp_password'] ?? '',
            'mail.mailers.smtp.encryption' => $this->mapEncryption($settings['smtp_encryption'] ?? 'tls'),
            'mail.from.address' => $settings['smtp_from_address'] ?? 'noreply@localhost',
            'mail.from.name' => $settings['smtp_from_name'] ?? 'NovaNAS',
        ]);

        try {
            Mail::raw('This is a test email from NovaNAS to verify your SMTP configuration.', function ($message) use ($validated, $settings) {
                $message->from($settings['smtp_from_address'] ?? 'noreply@localhost', $settings['smtp_from_name'] ?? 'NovaNAS');
                $message->to($validated['test_email']);
                $message->subject('NovaNAS SMTP Test');
            });

            return response()->json([
                'success' => true,
                'message' => 'Test email sent successfully!',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to send test email: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Map encryption option to mail config value.
     */
    protected function mapEncryption(string $encryption): ?string
    {
        return match ($encryption) {
            'ssl' => 'ssl',
            'tls' => 'tls',
            default => null,
        };
    }
}
