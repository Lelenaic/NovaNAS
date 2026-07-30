<?php

namespace App\Services\Applications;

use App\Contracts\StoreProviderInterface;
use App\Models\DesktopApp;
use App\Models\InstalledApplication;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Request;

/**
 * Applications Service
 *
 * Handles application lifecycle management: browsing stores, installing,
 * updating, and removing applications via Docker Compose.
 */
class ApplicationsService
{
    private const COMPOSE_DIR = 'applications';

    public function __construct(
        protected StoreManager $storeManager,
    ) {}

    /**
     * Get all store providers with their basic info.
     *
     * @return array<int, array{id: string, name: string, description: string|null, healthy: bool}>
     */
    public function getStores(): array
    {
        $stores = [];

        foreach ($this->storeManager->getAllProviders() as $name => $provider) {
            $stores[] = [
                'id' => $provider->getProviderId(),
                'name' => $provider->getName(),
                'description' => $provider->getDescription(),
                'healthy' => $provider->isHealthy(),
            ];
        }

        return $stores;
    }

    /**
     * Get categories from a specific store.
     *
     * @return array<int, array{id: string, name: string, icon: string|null, description: string|null}>
     */
    public function getCategories(string $storeProvider): array
    {
        $provider = $this->resolveProvider($storeProvider);

        return $provider->getCategories();
    }

    /**
     * Get apps from a specific store.
     *
     * @return array<int, array{id: string, title: string, tagline: string|null, category: string, version: string, author: string|null, developer: string|null, icon: string|null, thumbnail: string|null, architectures: list<string>, installed: bool}>
     */
    public function getApps(string $storeProvider, ?string $category = null, ?string $search = null): array
    {
        $provider = $this->resolveProvider($storeProvider);
        $apps = $provider->getApps($category, $search);

        $installed = InstalledApplication::where('store_provider', $storeProvider)
            ->pluck('app_id')
            ->flip();

        return array_map(function (array $app) use ($installed) {
            $app['installed'] = $installed->has($app['id']);

            return $app;
        }, $apps);
    }

    /**
     * Get detailed information about a specific app.
     *
     * @return array{id: string, title: string, tagline: string|null, description: string|null, category: string, version: string, author: string|null, developer: string|null, icon: string|null, thumbnail: string|null, screenshot_link: list<string>, architectures: list<string>, website: string|null, repo: string|null, support: string|null, docs: string|null, release_notes: string|null, installed: bool, installed_version: string|null, status: string|null}|null
     */
    public function getAppDetails(string $storeProvider, string $appId): ?array
    {
        $provider = $this->resolveProvider($storeProvider);
        $details = $provider->getAppDetails($appId);

        if ($details === null) {
            return null;
        }

        $installed = InstalledApplication::where('store_provider', $storeProvider)
            ->where('app_id', $appId)
            ->first();

        $details['installed'] = $installed !== null;
        $details['installed_version'] = $installed?->installed_version;
        $details['status'] = $installed?->status;

        return $details;
    }

    /**
     * Install an application from a store.
     *
     * @return array{success: bool, message: string, app_id: string|null}
     */
    public function installApp(string $storeProvider, string $appId, ?int $userId = null): array
    {
        $existing = InstalledApplication::where('store_provider', $storeProvider)
            ->where('app_id', $appId)
            ->first();

        if ($existing) {
            return [
                'success' => false,
                'message' => 'Application is already installed.',
                'app_id' => null,
            ];
        }

        $provider = $this->resolveProvider($storeProvider);
        $details = $provider->getAppDetails($appId);

        if ($details === null) {
            return [
                'success' => false,
                'message' => 'Application not found in store.',
                'app_id' => null,
            ];
        }

        $compose = $provider->getAppCompose($appId);

        if ($compose === null) {
            return [
                'success' => false,
                'message' => 'Failed to fetch application compose file.',
                'app_id' => null,
            ];
        }

        $composeDir = storage_path(self::COMPOSE_DIR.'/'.$appId);

        if (! is_dir($composeDir)) {
            mkdir($composeDir, 0755, true);
        }

        $composePath = $composeDir.'/docker-compose.yml';
        file_put_contents($composePath, $compose);

        // Parse x-casaos metadata from compose
        $xCasaos = $provider->parseComposeMetadata($compose);
        $portMap = $xCasaos['port_map'] ?? null;
        $appIndex = $xCasaos['index'] ?? null;

        $result = Process::timeout(120)->run("sudo docker compose -f {$composePath} up -d");

        if (! $result->successful()) {
            Log::error("Failed to install app {$appId}: {$result->errorOutput()}");

            return [
                'success' => false,
                'message' => 'Failed to start application containers: '.$result->errorOutput(),
                'app_id' => null,
            ];
        }

        $installed = InstalledApplication::create([
            'app_id' => $appId,
            'store_provider' => $storeProvider,
            'title' => $details['title'],
            'tagline' => $details['tagline'],
            'description' => $details['description'],
            'category' => $details['category'],
            'installed_version' => $details['version'],
            'author' => $details['author'],
            'developer' => $details['developer'],
            'icon' => $details['icon'],
            'port_map' => $portMap,
            'app_index' => $appIndex,
            'compose_path' => $composePath,
            'status' => 'running',
            'installed_by' => $userId,
            'installed_at' => now(),
        ]);

        // Create desktop app icon for the installed application
        $this->createDesktopApp($installed);

        return [
            'success' => true,
            'message' => 'Application installed successfully.',
            'app_id' => $installed->app_id,
        ];
    }

    /**
     * Update an installed application to the latest version.
     *
     * @return array{success: bool, message: string}
     */
    public function updateApp(string $storeProvider, string $appId): array
    {
        $installed = InstalledApplication::where('store_provider', $storeProvider)
            ->where('app_id', $appId)
            ->first();

        if ($installed === null) {
            return [
                'success' => false,
                'message' => 'Application is not installed.',
            ];
        }

        $provider = $this->resolveProvider($storeProvider);
        $compose = $provider->getAppCompose($appId);

        if ($compose === null) {
            return [
                'success' => false,
                'message' => 'Failed to fetch updated compose file.',
            ];
        }

        file_put_contents($installed->compose_path, $compose);

        $result = Process::timeout(120)->run("sudo docker compose -f {$installed->compose_path} up -d");

        if (! $result->successful()) {
            Log::error("Failed to update app {$appId}: {$result->errorOutput()}");

            return [
                'success' => false,
                'message' => 'Failed to update application: '.$result->errorOutput(),
            ];
        }

        $details = $provider->getAppDetails($appId);

        $installed->update([
            'installed_version' => $details['version'] ?? $installed->installed_version,
            'available_version' => null,
            'status' => 'running',
        ]);

        return [
            'success' => true,
            'message' => 'Application updated successfully.',
        ];
    }

    /**
     * Stop an installed application.
     *
     * @return array{success: bool, message: string}
     */
    public function stopApp(string $storeProvider, string $appId): array
    {
        $installed = InstalledApplication::where('store_provider', $storeProvider)
            ->where('app_id', $appId)
            ->first();

        if ($installed === null) {
            return [
                'success' => false,
                'message' => 'Application is not installed.',
            ];
        }

        $result = Process::timeout(60)->run("sudo docker compose -f {$installed->compose_path} stop");

        if (! $result->successful()) {
            return [
                'success' => false,
                'message' => 'Failed to stop application: '.$result->errorOutput(),
            ];
        }

        $installed->update(['status' => 'stopped']);

        return [
            'success' => true,
            'message' => 'Application stopped.',
        ];
    }

    /**
     * Start a stopped application.
     *
     * @return array{success: bool, message: string}
     */
    public function startApp(string $storeProvider, string $appId): array
    {
        $installed = InstalledApplication::where('store_provider', $storeProvider)
            ->where('app_id', $appId)
            ->first();

        if ($installed === null) {
            return [
                'success' => false,
                'message' => 'Application is not installed.',
            ];
        }

        $result = Process::timeout(60)->run("sudo docker compose -f {$installed->compose_path} start");

        if (! $result->successful()) {
            return [
                'success' => false,
                'message' => 'Failed to start application: '.$result->errorOutput(),
            ];
        }

        $installed->update(['status' => 'running']);

        return [
            'success' => true,
            'message' => 'Application started.',
        ];
    }

    /**
     * Remove an installed application (stop containers and delete compose files).
     *
     * @return array{success: bool, message: string}
     */
    public function removeApp(string $storeProvider, string $appId): array
    {
        $installed = InstalledApplication::where('store_provider', $storeProvider)
            ->where('app_id', $appId)
            ->first();

        if ($installed === null) {
            return [
                'success' => false,
                'message' => 'Application is not installed.',
            ];
        }

        $result = Process::timeout(60)->run("sudo docker compose -f {$installed->compose_path} down -v");

        if (! $result->successful()) {
            Log::warning("Failed to stop containers for {$appId}: {$result->errorOutput()}");
        }

        $composeDir = dirname($installed->compose_path);
        if (is_dir($composeDir)) {
            File::deleteDirectory($composeDir);
        }

        $this->removeDesktopApp($installed);

        $installed->delete();

        return [
            'success' => true,
            'message' => 'Application removed.',
        ];
    }

    /**
     * Get all installed applications.
     *
     * @return array<int, array{id: int, app_id: string, store_provider: string, title: string, tagline: string|null, category: string, installed_version: string, author: string|null, developer: string|null, icon: string|null, status: string, installed_at: \Carbon\Carbon}>
     */
    public function getInstalledApps(): array
    {
        return InstalledApplication::all()
            ->map(fn (InstalledApplication $app) => [
                'id' => $app->id,
                'app_id' => $app->app_id,
                'store_provider' => $app->store_provider,
                'title' => $app->title,
                'tagline' => $app->tagline,
                'category' => $app->category,
                'installed_version' => $app->installed_version,
                'author' => $app->author,
                'developer' => $app->developer,
                'icon' => $app->icon,
                'status' => $app->status,
                'installed_at' => $app->installed_at,
            ])
            ->toArray();
    }

    /**
     * Get the running status of Docker containers for an installed app.
     *
     * @return array<int, array{name: string, state: string, status: string}>
     */
    public function getContainerStatus(string $composePath): array
    {
        $result = Process::run(
            "sudo docker compose -f {$composePath} ps --format json"
        );

        if (! $result->successful()) {
            return [];
        }

        $containers = [];
        $lines = array_filter(explode("\n", trim($result->output())));

        foreach ($lines as $line) {
            $data = json_decode($line, true);
            if (is_array($data)) {
                $containers[] = [
                    'name' => $data['Name'] ?? $data['name'] ?? '',
                    'state' => $data['State'] ?? $data['state'] ?? '',
                    'status' => $data['Status'] ?? $data['status'] ?? '',
                ];
            }
        }

        return $containers;
    }

    /**
     * Create a desktop app icon for an installed application.
     */
    private function createDesktopApp(InstalledApplication $installed): void
    {
        $scheme = Request::secure() ? 'https' : 'http';
        $host = Request::getHost();
        $port = $installed->port_map;
        $index = rtrim($installed->app_index ?? '/', '/');

        $url = $port ? "{$scheme}://{$host}:{$port}{$index}" : "{$scheme}://{$host}{$index}";

        $identifier = 'app-'.$installed->app_id;

        DesktopApp::updateOrCreate(
            ['identifier' => $identifier],
            [
                'name' => $installed->title,
                'description' => $installed->tagline,
                'type' => 'url',
                'url' => $url,
                'icon_type' => 'image',
                'icon_path' => $installed->icon,
                'color' => '#7c3aed',
                'is_system' => false,
                'is_global' => true,
                'is_admin_only' => false,
                'created_by' => $installed->installed_by,
            ],
        );
    }

    /**
     * Remove the desktop app icon for an installed application.
     */
    private function removeDesktopApp(InstalledApplication $installed): void
    {
        $identifier = 'app-'.$installed->app_id;

        DesktopApp::where('identifier', $identifier)->delete();
    }

    /**
     * Resolve a store provider by name.
     *
     * @throws \InvalidArgumentException
     */
    private function resolveProvider(string $storeProvider): StoreProviderInterface
    {
        /** @var StoreProviderInterface $provider */
        $provider = $this->storeManager->driver($storeProvider);

        return $provider;
    }
}
