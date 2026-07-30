<?php

namespace App\Http\Controllers;

use App\Models\DesktopApp;
use App\Models\UserDesktopIcon;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;

class HomeController extends Controller
{
    /**
     * Get current badge counts for all apps.
     */
    public function badges()
    {
        $user = request()->user();

        // Get desktop apps visible for the current user
        $desktopApps = DesktopApp::query()
            ->visibleFor($user)
            ->get();

        // Get badge counts for apps
        $badges = [];
        foreach ($desktopApps as $app) {
            $badgeCount = Cache::get("app_badge_{$app->identifier}", 0);
            if ($badgeCount > 0) {
                $badges[$app->identifier] = $badgeCount;
            }
        }

        return response()->json($badges);
    }

    /**
     * Get desktop apps and icon orders as JSON (for live refresh).
     */
    public function desktopApps()
    {
        $user = request()->user();

        $desktopApps = DesktopApp::query()
            ->visibleFor($user)
            ->orderBy('name')
            ->get();

        $userIconOrders = UserDesktopIcon::where('user_id', $user->id)
            ->where('is_visible', true)
            ->get()
            ->keyBy('desktop_app_id');

        return response()->json([
            'desktopApps' => $desktopApps,
            'userIconOrders' => $userIconOrders,
        ]);
    }

    /**
     * Display the home page.
     */
    public function index()
    {
        $user = request()->user();

        // Get desktop apps visible for the current user
        $desktopApps = DesktopApp::query()
            ->visibleFor($user)
            ->orderBy('name')
            ->get();

        // Get user icon orders
        $userIconOrders = UserDesktopIcon::where('user_id', $user->id)
            ->where('is_visible', true)
            ->get()
            ->keyBy('desktop_app_id');

        // Get badge counts for apps
        $badges = [];
        foreach ($desktopApps as $app) {
            $badgeCount = Cache::get("app_badge_{$app->identifier}", 0);
            if ($badgeCount > 0) {
                $badges[$app->identifier] = $badgeCount;
            }
        }

        return Inertia::render('Home', [
            'version' => config('app.version'),
            'desktopApps' => $desktopApps,
            'userIconOrders' => $userIconOrders,
            'appBadges' => $badges,
        ]);
    }
}
