<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use OTPHP\TOTP;

class AuthController extends Controller
{
    /**
     * Display the login page.
     */
    public function login(Request $request)
    {
        return Inertia::render('Login', [
            'version' => config('app.version'),
            'passwordSet' => $request->boolean('password_set', false),
            'twoFactorRequired' => $request->session()->get('2fa_required', false),
            'twoFactorEmail' => $request->session()->get('2fa_email'),
        ]);
    }

    /**
     * Handle an authentication attempt.
     * If 2FA is enabled, store pending user in session and ask for TOTP code.
     */
    public function authenticate(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        // Check credentials without logging in
        $user = Auth::getProvider()->retrieveByCredentials($credentials);

        if (! $user || ! Auth::getProvider()->validateCredentials($user, $credentials)) {
            return back()->withErrors([
                'email' => 'The provided credentials do not match our records.',
            ])->onlyInput('email');
        }

        // Ensure we have a User model instance
        if (! $user instanceof User) {
            return back()->withErrors([
                'email' => 'The provided credentials do not match our records.',
            ])->onlyInput('email');
        }

        // If 2FA is enabled, store pending auth in session
        if ($user->two_factor_enabled) {
            $request->session()->put('2fa_pending_user_id', $user->id);
            $request->session()->put('2fa_pending_remember', $request->boolean('remember'));

            return back()->with([
                '2fa_required' => true,
                '2fa_email' => $user->email,
            ]);
        }

        // No 2FA — log in directly
        Auth::login($user, $request->boolean('remember'));
        $request->session()->regenerate();

        return redirect()->intended('/');
    }

    /**
     * Verify a 2FA TOTP code and complete the login.
     */
    public function verifyTwoFactor(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'size:6'],
        ]);

        $pendingUserId = $request->session()->get('2fa_pending_user_id');

        if (! $pendingUserId) {
            return redirect('/login');
        }

        $user = User::find($pendingUserId);

        if (! $user || ! $user->two_factor_enabled) {
            $request->session()->forget(['2fa_pending_user_id', '2fa_pending_remember']);

            return redirect('/login');
        }

        $totp = TOTP::createFromSecret($user->two_factor_secret);
        $totp->setLabel($user->email);
        $totp->setIssuer(config('app.name', 'NovaNAS'));

        if (! $totp->verify($validated['code'])) {
            return back()->withErrors([
                'code' => 'Invalid verification code. Please try again.',
            ]);
        }

        // Code is valid — complete the login
        $remember = $request->session()->pull('2fa_pending_remember', false);
        $request->session()->forget('2fa_pending_user_id');

        Auth::login($user, $remember);
        $request->session()->regenerate();

        return redirect()->intended('/');
    }

    /**
     * Log the user out of the application.
     */
    public function logout(Request $request): RedirectResponse
    {
        Auth::logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/login');
    }
}
