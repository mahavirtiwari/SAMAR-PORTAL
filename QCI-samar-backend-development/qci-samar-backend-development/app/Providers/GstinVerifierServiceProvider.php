<?php

namespace App\Providers;

use App\Contracts\GstinVerifierInterface;
use App\Services\Gst\ProteanGstinVerifier;
use Illuminate\Support\ServiceProvider;

class GstinVerifierServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(GstinVerifierInterface::class, static function () {
            $provider = config('services.gstin.provider', 'protean');

            return match (strtolower((string) $provider)) {
                'protean' => new ProteanGstinVerifier,
                default => throw new \InvalidArgumentException("Unsupported GSTIN verification provider: {$provider}"),
            };
        });
    }

    public function boot(): void
    {
        //
    }
}
