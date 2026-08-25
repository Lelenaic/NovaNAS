<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OTPHP\TOTP;

class TwoFactorController extends Controller
{
    /**
     * Get the current 2FA status for the authenticated user.
     */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'enabled' => $user->two_factor_enabled,
        ]);
    }

    /**
     * Generate a new TOTP secret and provisioning URI for setup.
     * Does NOT enable 2FA yet — user must confirm with a valid code first.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $totp = TOTP::create();
        $totp->setLabel($user->email);
        $totp->setIssuer(config('app.name', 'NovaNAS'));

        $secret = $totp->getSecret();
        $provisioningUri = $totp->getProvisioningUri();

        // Store the secret temporarily (not enabled yet)
        $user->update(['two_factor_secret' => $secret]);

        return response()->json([
            'secret' => $secret,
            'provisioning_uri' => $provisioningUri,
        ]);
    }

    /**
     * Verify a TOTP code and enable 2FA for the user.
     */
    public function confirm(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'size:6'],
        ]);

        $user = $request->user();

        if (! $user->two_factor_secret) {
            return response()->json([
                'message' => 'No 2FA setup in progress. Please generate a secret first.',
            ], 422);
        }

        $totp = TOTP::createFromSecret($user->two_factor_secret);
        $totp->setLabel($user->email);
        $totp->setIssuer(config('app.name', 'NovaNAS'));

        if (! $totp->verify($validated['code'])) {
            return response()->json([
                'message' => 'Invalid verification code. Please try again.',
            ], 422);
        }

        $user->update(['two_factor_enabled' => true]);

        return response()->json([
            'message' => 'Two-factor authentication has been enabled.',
        ]);
    }

    /**
     * Disable 2FA for the user. Requires current password confirmation.
     */
    public function destroy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'password' => ['required', 'string'],
        ]);

        $user = $request->user();

        if (! \Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'message' => 'Incorrect password.',
            ], 422);
        }

        $user->update([
            'two_factor_enabled' => false,
            'two_factor_secret' => null,
        ]);

        return response()->json([
            'message' => 'Two-factor authentication has been disabled.',
        ]);
    }
}
