<?php

namespace App\Services\Payment;

use App\Contracts\PaymentGatewayInterface;

class PaymentGatewayFactory
{
    /**
     * Create a payment gateway adapter instance.
     *
     * @param  string|null  $gateway  Gateway name (icici_eazypay)
     *
     * @throws \Exception
     */
    public static function create(?string $gateway = null): PaymentGatewayInterface
    {
        $gateway = $gateway ?? config('services.payment.default_gateway', 'icici_eazypay');

        return match (strtolower($gateway)) {
            'icici_eazypay', 'icici', 'eazypay' => new ICICIEazyPayAdapter,
            default => throw new \Exception("Unsupported payment gateway: {$gateway}"),
        };
    }

    /**
     * Get all available gateways.
     */
    public static function getAvailableGateways(): array
    {
        return [
            'icici_eazypay' => [
                'name' => 'ICICI EazyPay',
                'enabled' => config('services.icici_eazypay.enabled', false),
            ],
        ];
    }
}
