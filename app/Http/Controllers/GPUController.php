<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use App\Services\GPU\GPUManager;

class GPUController extends Controller
{
    public function __construct(
        protected GPUManager $gpuManager
    ) {}

    /**
     * Get all GPUs from all available providers.
     */
    public function index(): JsonResponse
    {
        $gpus = $this->gpuManager->getAllGpus();

        return response()->json([
            'gpus' => $gpus,
            'has_gpu' => $this->gpuManager->hasGpuAvailable(),
        ]);
    }

    /**
     * Get driver status for all GPU providers.
     */
    public function status(): JsonResponse
    {
        $status = $this->gpuManager->getDriverStatus();

        return response()->json([
            'providers' => $status,
        ]);
    }

    /**
     * Get detailed information about a specific GPU.
     */
    public function show(string $provider, int $index): JsonResponse
    {
        try {
            $providerInstance = $this->gpuManager->getProvider($provider);
            $gpuInfo = $providerInstance->getGpuInfo($index);

            if ($gpuInfo === null) {
                return response()->json([
                    'error' => 'GPU not found',
                ], 404);
            }

            return response()->json([
                'gpu' => $gpuInfo,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'error' => 'Provider not found: ' . $e->getMessage(),
            ], 404);
        }
    }

    /**
     * Get available GPU providers.
     */
    public function providers(): JsonResponse
    {
        $providers = $this->gpuManager->getAvailableProviders();

        return response()->json([
            'providers' => $providers,
        ]);
    }
}
