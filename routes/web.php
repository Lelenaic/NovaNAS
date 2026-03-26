<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\DesktopIconController;
use App\Http\Controllers\DockerController;
use App\Http\Controllers\DockerSettingsController;
use App\Http\Controllers\DynDnsController;
use App\Http\Controllers\EmailSettingsController;
use App\Http\Controllers\FirewallController;
use App\Http\Controllers\GeneralSettingsController;
use App\Http\Controllers\GPUController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\NetworkController;
use App\Http\Controllers\ServicesController;
use App\Http\Controllers\SmartController;
use App\Http\Controllers\StorageController;
use App\Http\Controllers\SystemController;
use App\Http\Controllers\UpnpController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\WizardController;
use Illuminate\Support\Facades\Route;

// Wizard routes (accessible without authentication when no users exist)
Route::get('/wizard', [WizardController::class, 'index']);
Route::get('/wizard/account', [WizardController::class, 'account']);
Route::post('/wizard/account', [WizardController::class, 'storeAccount']);
Route::get('/wizard/bind-user', [WizardController::class, 'bindUser']);
Route::post('/wizard/bind-user', [WizardController::class, 'storeBindUser']);
Route::get('/wizard/skip', [WizardController::class, 'skip']);

Route::get('/login', [AuthController::class, 'login'])->name('login');

Route::post('/login', [AuthController::class, 'authenticate']);

Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

// Password set route for invited users (no auth required)
Route::get('/set-password', [UserController::class, 'showSetPassword']);
Route::post('/set-password', [UserController::class, 'setPassword']);

// Invitation route (clean URL structure)
Route::get('/invitation/{token}', [UserController::class, 'showSetPassword']);

Route::group(['middleware' => 'auth'], function () {
    Route::get('/', [HomeController::class, 'index']);

    Route::withoutMiddleware(\App\Http\Middleware\HandleInertiaRequests::class)->group(function () {
        Route::get('/api/system/info', [SystemController::class, 'info']);
        Route::get('/api/system/network-interfaces', [SystemController::class, 'networkInterfaces']);
        Route::get('/api/system/network-config', [SystemController::class, 'getNetworkConfig']);
        Route::get('/api/system/interface-config/{interface}', [SystemController::class, 'getInterfaceConfig']);
        Route::post('/api/system/network-config', [SystemController::class, 'setNetworkConfig']);
        Route::get('/api/storage/directories', [SystemController::class, 'listDirectory']);

        // Network controller routes
        Route::get('/api/network/interfaces', [NetworkController::class, 'index']);
        Route::get('/api/network/config/{interface}', [NetworkController::class, 'getConfig']);
        Route::post('/api/network/config', [NetworkController::class, 'setConfig']);

        // Desktop icon routes - order based (simple 1, 2, 3, 4...)
        Route::put('/api/desktop-icons/order', [DesktopIconController::class, 'updateOrder']);
        Route::put('/api/desktop-icons/visibility', [DesktopIconController::class, 'toggleVisibility']);
        Route::get('/api/desktop-icons/orders', [DesktopIconController::class, 'orders']);

        // DynDNS routes
        Route::get('/api/dyndns/configs', [DynDnsController::class, 'index']);
        Route::get('/api/dyndns/info', [DynDnsController::class, 'getInfo']);
        Route::post('/api/dyndns/configs', [DynDnsController::class, 'store']);
        Route::put('/api/dyndns/configs/{id}', [DynDnsController::class, 'update']);
        Route::delete('/api/dyndns/configs/{id}', [DynDnsController::class, 'destroy']);
        Route::post('/api/dyndns/configs/{id}/update', [DynDnsController::class, 'updateNow']);
        Route::post('/api/dyndns/update-all', [DynDnsController::class, 'updateAll']);
        Route::get('/api/dyndns/provider-fields', [DynDnsController::class, 'getProviderFields']);

        // UPNP routes
        Route::get('/api/upnp/rules', [UpnpController::class, 'index']);
        Route::post('/api/upnp/rules', [UpnpController::class, 'store']);
        Route::put('/api/upnp/rules/{id}', [UpnpController::class, 'update']);
        Route::delete('/api/upnp/rules/{id}', [UpnpController::class, 'destroy']);
        Route::post('/api/upnp/publish-all', [UpnpController::class, 'publishAll']);
        Route::get('/api/upnp/discover', [UpnpController::class, 'discover']);
        Route::get('/api/upnp/interfaces', [UpnpController::class, 'getInterfaces']);

        // Firewall routes
        Route::get('/api/firewall/status', [FirewallController::class, 'status']);
        Route::get('/api/firewall/rules', [FirewallController::class, 'rules']);
        Route::get('/api/firewall/default-policies', [FirewallController::class, 'defaultPolicies']);
        Route::post('/api/firewall/enable', [FirewallController::class, 'enable']);
        Route::post('/api/firewall/disable', [FirewallController::class, 'disable']);
        Route::post('/api/firewall/rules', [FirewallController::class, 'store']);
        Route::put('/api/firewall/rules/reorder', [FirewallController::class, 'reorder']);
        Route::put('/api/firewall/rules/{id}', [FirewallController::class, 'update']);
        Route::delete('/api/firewall/rules/{id}', [FirewallController::class, 'destroy']);
        Route::put('/api/firewall/default-policies', [FirewallController::class, 'setDefaultPolicy']);
        Route::get('/api/firewall/interfaces', [FirewallController::class, 'interfaces']);

        // Storage routes
        Route::get('/api/storage/disks', [StorageController::class, 'disks']);
        Route::get('/api/storage/disks/{device}/capacity', [StorageController::class, 'capacity']);
        Route::get('/api/storage/pools', [StorageController::class, 'pools']);
        Route::get('/api/storage/pools/{pool}', [StorageController::class, 'pool']);
        Route::get('/api/storage/pools/{pool}/directories', [StorageController::class, 'poolDirectories']);
        Route::get('/api/storage/settings', [StorageController::class, 'getSettings']);
        Route::post('/api/storage/settings', [StorageController::class, 'updateSettings']);

        // SMART routes
        Route::get('/api/storage/smart/health', [SmartController::class, 'health']);
        Route::get('/api/storage/smart/{device}/health', [SmartController::class, 'healthStatus']);
        Route::get('/api/storage/smart/{device}/tests', [SmartController::class, 'testResults']);
        Route::get('/api/storage/smart/{device}/info', [SmartController::class, 'detailedInfo']);
        Route::post('/api/storage/smart/{device}/test', [SmartController::class, 'startTest']);
        Route::post('/api/storage/smart/scan-all', [SmartController::class, 'scanAll']);

        // Shares routes
        Route::get('/api/storage/shares', [StorageController::class, 'shares']);
        Route::post('/api/storage/shares', [StorageController::class, 'createShare']);
        Route::put('/api/storage/shares/{name}', [StorageController::class, 'updateShare']);
        Route::delete('/api/storage/shares/{name}', [StorageController::class, 'deleteShare']);
        Route::get('/api/storage/shares/users', [StorageController::class, 'shareUsers']);
        Route::post('/api/storage/shares/homes', [StorageController::class, 'toggleHomes']);

        // User management routes
        Route::get('/api/users', [UserController::class, 'index']);
        Route::post('/api/users', [UserController::class, 'store']);
        Route::put('/api/users/{user}', [UserController::class, 'update']);
        Route::delete('/api/users/{user}', [UserController::class, 'destroy']);

        // Current user profile route
        Route::get('/api/profile', [UserController::class, 'showProfile']);
        Route::put('/api/profile', [UserController::class, 'profile']);

        // User invitation routes
        Route::get('/api/users/pending', [UserController::class, 'pending']);
        Route::post('/api/users/invite', [UserController::class, 'invite']);
        Route::post('/api/users/invitations/{user}/send-email', [UserController::class, 'sendInvitationEmail']);
        Route::delete('/api/users/invitations/{user}', [UserController::class, 'revokeInvitation']);

        // SMTP status check
        Route::get('/api/email/status', [UserController::class, 'smtpStatus']);

        // Available Linux users for linking
        Route::get('/api/users/linux/available', [UserController::class, 'availableLinuxUsers']);

        // Email/SMTP settings routes
        Route::get('/api/email/settings', [EmailSettingsController::class, 'index']);
        Route::post('/api/email/settings', [EmailSettingsController::class, 'store']);
        Route::post('/api/email/test', [EmailSettingsController::class, 'test']);

        // General settings routes
        Route::get('/api/settings/general', [GeneralSettingsController::class, 'index']);
        Route::put('/api/settings/general', [GeneralSettingsController::class, 'update']);

        // Docker settings routes
        Route::get('/api/settings/docker', [DockerSettingsController::class, 'index']);
        Route::post('/api/settings/docker/move-data-directory', [DockerSettingsController::class, 'moveDataDirectory']);
        Route::get('/api/settings/docker/mount-points', [DockerSettingsController::class, 'mountPoints']);

        // Docker API routes
        Route::get('/api/docker/ping', [DockerController::class, 'ping']);
        Route::get('/api/docker/info', [DockerController::class, 'info']);
        Route::get('/api/docker/version', [DockerController::class, 'version']);

        // Containers
        Route::get('/api/docker/containers', [DockerController::class, 'containers']);
        Route::get('/api/docker/containers/{id}', [DockerController::class, 'container']);
        Route::post('/api/docker/containers/{id}/start', [DockerController::class, 'startContainer']);
        Route::post('/api/docker/containers/{id}/stop', [DockerController::class, 'stopContainer']);
        Route::post('/api/docker/containers/{id}/restart', [DockerController::class, 'restartContainer']);
        Route::delete('/api/docker/containers/{id}', [DockerController::class, 'removeContainer']);
        Route::get('/api/docker/containers/{id}/logs', [DockerController::class, 'containerLogs']);
        Route::get('/api/docker/containers/{id}/stats', [DockerController::class, 'containerStats']);
        Route::post('/api/docker/containers', [DockerController::class, 'createContainer']);
        Route::get('/api/docker/containers/{id}/config', [DockerController::class, 'getContainerConfig']);
        Route::post('/api/docker/containers/{id}/recreate', [DockerController::class, 'recreateContainer']);

        // Images
        Route::get('/api/docker/images', [DockerController::class, 'images']);
        Route::get('/api/docker/images/{id}', [DockerController::class, 'image']);
        Route::post('/api/docker/images/pull', [DockerController::class, 'pull']);
        Route::delete('/api/docker/images/{id}', [DockerController::class, 'removeImage']);

        // Volumes
        Route::get('/api/docker/volumes', [DockerController::class, 'volumes']);
        Route::get('/api/docker/volumes/{name}', [DockerController::class, 'volume']);
        Route::post('/api/docker/volumes', [DockerController::class, 'createVolume']);
        Route::delete('/api/docker/volumes/{name}', [DockerController::class, 'removeVolume']);

        // Networks
        Route::get('/api/docker/networks', [DockerController::class, 'networks']);
        Route::get('/api/docker/networks/{id}', [DockerController::class, 'network']);
        Route::post('/api/docker/networks', [DockerController::class, 'createNetwork']);
        Route::delete('/api/docker/networks/{id}', [DockerController::class, 'removeNetwork']);
        Route::post('/api/docker/networks/{id}/connect', [DockerController::class, 'connectNetwork']);
        Route::post('/api/docker/networks/{id}/disconnect', [DockerController::class, 'disconnectNetwork']);

        // Prune
        Route::post('/api/docker/prune/containers', [DockerController::class, 'pruneContainers']);
        Route::post('/api/docker/prune/images', [DockerController::class, 'pruneImages']);
        Route::post('/api/docker/prune/volumes', [DockerController::class, 'pruneVolumes']);
        Route::post('/api/docker/prune/networks', [DockerController::class, 'pruneNetworks']);

        // Registries
        Route::get('/api/docker/registries', [DockerController::class, 'listRegistries']);
        Route::post('/api/docker/registries', [DockerController::class, 'addRegistry']);
        Route::post('/api/docker/registries/{address}/login', [DockerController::class, 'loginToRegistry']);
        Route::post('/api/docker/registries/{address}/logout', [DockerController::class, 'logoutFromRegistry']);
        Route::delete('/api/docker/registries/{address}', [DockerController::class, 'removeRegistry']);

        // Services routes
        Route::get('/api/services', [ServicesController::class, 'index']);
        Route::post('/api/services/toggle', [ServicesController::class, 'toggle']);

        // GPU routes
        Route::get('/api/gpus', [GPUController::class, 'index']);
        Route::get('/api/gpus/status', [GPUController::class, 'status']);
        Route::get('/api/gpus/providers', [GPUController::class, 'providers']);
        Route::get('/api/gpus/{provider}/{index}', [GPUController::class, 'show']);
    });

    // API routes - exclude Inertia middleware
});
