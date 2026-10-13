<?php

namespace App\Providers;

use App\Contracts\BusinessCentralClientInterface;
use App\Services\BusinessCentral\BusinessCentralClient;
use App\Services\BusinessCentral\BusinessCentralOAuthService;
use Illuminate\Support\ServiceProvider;

class BusinessCentralServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        $this->app->singleton(BusinessCentralOAuthService::class, static fn () => new BusinessCentralOAuthService);

        $this->app->singleton(
            BusinessCentralClientInterface::class,
            static fn ($app) => new BusinessCentralClient($app->make(BusinessCentralOAuthService::class))
        );
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        //
    }
}
