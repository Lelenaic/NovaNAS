<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use App\Services\GPU\GPUManager;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(GPUManager::class, function ($app) {
            return new GPUManager($app);
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
