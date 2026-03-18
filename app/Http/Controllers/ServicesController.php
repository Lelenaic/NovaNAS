<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Services\SystemService;

class ServicesController extends Controller
{
    public function __construct(
        protected SystemService $systemService
    ) {}

    /**
     * Get all services with their status.
     */
    public function index(): JsonResponse
    {
        $services = $this->systemService->getServices();

        return response()->json([
            'services' => $services,
        ]);
    }

    /**
     * Enable or disable a service.
     */
    public function toggle(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'service_id' => 'required|string',
            'enabled' => 'required|boolean',
        ]);

        try {
            $this->systemService->setEnabled($validated['service_id'], $validated['enabled']);

            return response()->json([
                'message' => $validated['enabled'] ? 'Service enabled successfully' : 'Service disabled successfully',
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 422);
        } catch (\RuntimeException $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
