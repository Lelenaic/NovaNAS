<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RedirectIfNoUsers
{
    /**
     * Handle an incoming request.
     *
     * Redirects to the wizard if no users exist in the database.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Skip redirect if we're already on wizard routes
        if ($request->is('wizard') || $request->is('wizard/*')) {
            return $next($request);
        }

        // Skip redirect if users already exist
        if (User::query()->exists()) {
            return $next($request);
        }

        // Redirect to wizard if no users exist
        return redirect('/wizard');
    }
}
