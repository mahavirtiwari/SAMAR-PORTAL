<?php

namespace App\Contracts;

interface PaymentGatewayInterface
{
    /**
     * Initialize a payment transaction.
     *
     * @param  array  $data  Payment data (amount, currency, order_id, customer_info, etc.)
     * @return array Payment response with gateway-specific data
     */
    public function initiatePayment(array $data): array;

    /**
     * Verify payment status.
     *
     * @param  string  $paymentId  Gateway payment ID
     * @param  array  $data  Additional verification data
     * @return array Payment verification result
     */
    public function verifyPayment(string $paymentId, array $data = []): array;

    /**
     * Verify webhook signature.
     *
     * @param  array  $payload  Webhook payload
     * @param  string  $signature  Webhook signature
     * @param  string|null  $secret  Webhook secret (optional, uses config if not provided)
     */
    public function verifyWebhookSignature(array $payload, string $signature, ?string $secret = null): bool;

    /**
     * Parse webhook payload.
     *
     * @param  array  $payload  Raw webhook payload
     * @return array Normalized webhook data
     */
    public function parseWebhookPayload(array $payload): array;

    /**
     * Get payment status from gateway.
     *
     * @param  string  $paymentId  Gateway payment ID
     * @return string Normalized status (pending, success, failed)
     */
    public function getPaymentStatus(string $paymentId): string;

    /**
     * Get gateway name.
     */
    public function getGatewayName(): string;
}
