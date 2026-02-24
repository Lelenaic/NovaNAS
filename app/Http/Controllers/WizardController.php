<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class WizardController extends Controller
{
    /**
     * Check if the wizard should run (no users exist).
     */
    public function shouldRun(): bool
    {
        return User::query()->doesntExist();
    }

    /**
     * Show the wizard index (welcome page).
     */
    public function index()
    {
        if (!$this->shouldRun()) {
            return redirect('/');
        }

        return inertia('Wizard/Welcome');
    }

    /**
     * Show the account creation step.
     */
    public function account()
    {
        if (!$this->shouldRun()) {
            return redirect('/');
        }

        return inertia('Wizard/Account');
    }

    /**
     * Store the admin user account.
     */
    public function storeAccount(Request $request)
    {
        if (!$this->shouldRun()) {
            return redirect('/');
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ], [
            'name.required' => 'The name field is required.',
            'email.required' => 'The email field is required.',
            'email.email' => 'Please enter a valid email address.',
            'email.unique' => 'This email is already registered.',
            'password.required' => 'The password field is required.',
            'password.min' => 'The password must be at least 8 characters.',
            'password.confirmed' => 'The password confirmation does not match.',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'is_admin' => true,
        ]);

        Auth::login($user);

        return redirect('/')->with('success', 'Welcome to NovaNAS!');
    }

    /**
     * Skip the wizard (for development purposes).
     */
    public function skip()
    {
        if (!$this->shouldRun()) {
            return redirect('/');
        }

        // Create a default admin user for testing
        $user = User::create([
            'name' => 'Admin',
            'email' => 'admin@novanas.local',
            'password' => Hash::make('password'),
            'is_admin' => true,
        ]);

        Auth::login($user);

        return redirect('/');
    }
}
