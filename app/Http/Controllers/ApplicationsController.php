<?php

namespace App\Http\Controllers;

use App\Services\Applications\ApplicationsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApplicationsController extends Controller
{
    public function __construct(
        protected ApplicationsService $applicationsService,
    ) {}

    /**
     * Get all available store providers.
     */
    public function stores(): JsonResponse
    {
        return response()->json($this->applicationsService->getStores());
    }

    /**
     * Get categories for a specific store.
     */
    public function categories(string $store): JsonResponse
    {
        return response()->json($this->applicationsService->getCategories($store));
    }

    /**
     * Get available applications from a store.
     */
    public function apps(Request $request, string $store): JsonResponse
    {
        $request->validate([
            'category' => 'nullable|string',
            'search' => 'nullable|string|max:100',
        ]);

        return response()->json($this->applicationsService->getApps(
            $store,
            $request->input('category'),
            $request->input('search'),
        ));
    }

    /**
     * Get detailed information about a specific application.
     */
    public function show(string $store, string $app): JsonResponse
    {
        $details = $this->applicationsService->getAppDetails($store, $app);

        if ($details === null) {
            return response()->json(['message' => 'Application not found.'], 404);
        }

        return response()->json($details);
    }

    /**
     * Install an application from a store.
     */
    public function install(Request $request, string $store, string $app): JsonResponse
    {
        $result = $this->applicationsService->installApp(
            $store,
            $app,
            $request->user()?->id,
        );

        return response()->json($result, $result['success'] ? 201 : 422);
    }

    /**
     * Update an installed application.
     */
    public function update(string $store, string $app): JsonResponse
    {
        $result = $this->applicationsService->updateApp($store, $app);

        return response()->json($result, $result['success'] ? 200 : 422);
    }

    /**
     * Stop an installed application.
     */
    public function stop(string $store, string $app): JsonResponse
    {
        $result = $this->applicationsService->stopApp($store, $app);

        return response()->json($result, $result['success'] ? 200 : 422);
    }

    /**
     * Start a stopped application.
     */
    public function start(string $store, string $app): JsonResponse
    {
        $result = $this->applicationsService->startApp($store, $app);

        return response()->json($result, $result['success'] ? 200 : 422);
    }

    /**
     * Remove an installed application.
     */
    public function destroy(string $store, string $app): JsonResponse
    {
        $result = $this->applicationsService->removeApp($store, $app);

        return response()->json($result, $result['success'] ? 200 : 422);
    }

    /**
     * Get all installed applications.
     */
    public function installed(): JsonResponse
    {
        return response()->json($this->applicationsService->getInstalledApps());
    }

    /**
     * Get container status for an installed application.
     */
    public function status(string $store, string $app): JsonResponse
    {
        $installed = \App\Models\InstalledApplication::where('store_provider', $store)
            ->where('app_id', $app)
            ->first();

        if ($installed === null) {
            return response()->json(['message' => 'Application is not installed.'], 404);
        }

        return response()->json($this->applicationsService->getContainerStatus($installed->compose_path));
    }
}
