<?php

namespace App\Providers;

use App\Services\Applications\StoreManager;
use App\Services\GPU\GPUManager;
use App\Services\NovaNasApiService;
use Illuminate\Support\ServiceProvider;

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

        $this->app->singleton(NovaNasApiService::class, function () {
            return new NovaNasApiService;
        });

        $this->app->singleton(StoreManager::class, function ($app) {
            return new StoreManager($app);
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
