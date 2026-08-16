<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Spatie\LaravelPasskeys\Actions\GeneratePasskeyRegisterOptionsAction;
use Spatie\LaravelPasskeys\Actions\StorePasskeyAction;
use Spatie\LaravelPasskeys\Support\Config;
use Throwable;

class PasskeyController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $passkeys = $request->user()->passkeys()
            ->get()
            ->map(fn ($key) => $key->only(['id', 'name', 'last_used_at']));

        return response()->json(['passkeys' => $passkeys]);
    }

    public function generateOptions(Request $request): JsonResponse
    {
        $generatePasskeyRegisterOptionsAction = Config::getAction(
            'generate_passkey_register_options',
            GeneratePasskeyRegisterOptionsAction::class
        );

        $options = $generatePasskeyRegisterOptionsAction->execute($request->user());

        return response()->json(json_decode($options, true));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'passkey' => 'required|json',
            'options' => 'required|json',
            'name' => 'required|string|max:255',
        ]);

        $storePasskeyAction = Config::getAction(
            'store_passkey',
            StorePasskeyAction::class
        );

        try {
            $storePasskeyAction->execute(
                $request->user(),
                $data['passkey'],
                $data['options'],
                $request->getHost(),
                ['name' => $data['name']],
            );

            return response()->json(['message' => 'Passkey created successfully']);
        } catch (Throwable $e) {
            throw ValidationException::withMessages([
                'passkey' => 'Something went wrong generating the passkey.',
            ]);
        }
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $request->user()->passkeys()->where('id', $id)->delete();

        return response()->json(['message' => 'Passkey deleted successfully']);
    }
}
