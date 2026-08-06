<?php

namespace App\Http\Controllers;

use App\Services\NutService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Controller for managing UPS settings via NUT.
 */
class UpsSettingsController extends Controller
{
    public function __construct(
        protected NutService $nutService
    ) {}

    /**
     * Get the current UPS configuration and selected device status.
     */
    public function index(): JsonResponse
    {
        $config = $this->nutService->getConfig();
        $status = null;

        if ($config['selected_device']) {
            $status = $this->nutService->getDeviceStatus();
        }

        $serviceStatus = $this->nutService->getServiceStatus();

        return response()->json([
            'config' => $config,
            'status' => $status,
            'service_status' => $serviceStatus,
        ]);
    }

    /**
     * Detect connected UPS devices.
     */
    public function detect(): JsonResponse
    {
        $devices = $this->nutService->detectDevices();

        return response()->json([
            'devices' => $devices,
        ]);
    }

    /**
     * Get status of the configured UPS device.
     */
    public function status(): JsonResponse
    {
        $status = $this->nutService->getDeviceStatus();

        return response()->json([
            'status' => $status,
        ]);
    }

    /**
     * Save UPS configuration and optionally apply it.
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'selected_device' => 'sometimes|nullable|string',
            'shutdown_mode' => 'sometimes|in:battery,time',
            'shutdown_battery_pct' => 'sometimes|integer|min:5|max:100',
            'shutdown_minutes' => 'sometimes|integer|min:1|max:60',
            'cancel_on_power_return' => 'sometimes|boolean',
        ]);

        $this->nutService->saveConfig($validated);

        return response()->json([
            'message' => 'UPS settings saved successfully.',
            'config' => $this->nutService->getConfig(),
        ]);
    }

    /**
     * Apply the current UPS configuration to NUT and restart services.
     */
    public function apply(): JsonResponse
    {
        $result = $this->nutService->applyConfig();

        $statusCode = $result['success'] ? 200 : 500;

        return response()->json($result, $statusCode);
    }
}
