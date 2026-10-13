<?php

namespace App\Providers;

use App\Contracts\SupportPlatformInterface;
use App\Services\SupportPlatforms\ZohoDeskAdapter;
use Illuminate\Support\ServiceProvider;

class SupportPlatformServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        // Bind the SupportPlatformInterface to ZohoDeskAdapter
        // Per SAMAR-ZOHODESK documentation for NDIE Department
        $this->app->singleton(SupportPlatformInterface::class, function ($app) {
            return new ZohoDeskAdapter;
        });
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        //
    }
}
