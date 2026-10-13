<?php

namespace App\Contracts;

use App\Services\Gst\GstinVerificationResult;

/**
 * Live GSTIN verification against the government registry. Distinct from
 * App\Services\Gst\GstinConsistencyValidator, which is the offline checksum /
 * state / PAN consistency check that runs first. Implementations are swappable
 * providers (Protean today) selected by config('services.gstin.provider').
 */
interface GstinVerifierInterface
{
    /**
     * Whether verification is switched on AND the provider has the credentials
     * it needs. When false, callers skip verification entirely (no gate).
     */
    public function isEnabled(): bool;

    public function providerName(): string;

    /**
     * Verify a GSTIN, serving a fresh cached result when one exists (unless
     * $forceRefresh). Never throws for a bad/absent GSTIN or a provider outage —
     * the outcome is carried in the returned result's status.
     */
    public function verify(string $gstin, bool $forceRefresh = false): GstinVerificationResult;
}
