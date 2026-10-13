<?php

namespace App\Services\Gst;

/**
 * Outcome of a GSTIN consistency check. Carries a machine-readable failure
 * code and a customer-facing message; a null result (not this object) means
 * the GSTIN is consistent or absent.
 */
readonly class GstinConsistencyResult
{
    public function __construct(
        public string $code,
        public string $message,
    ) {}

    public static function fail(string $code, string $message): self
    {
        return new self($code, $message);
    }
}
