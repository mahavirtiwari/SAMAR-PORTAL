<?php

namespace App\Services\Gst;

/**
 * Outcome of a live GSTIN verification against the government registry.
 *
 * `status` is one of:
 *  - 'verified' — the registry returned a taxpayer for the GSTIN (Status=S with
 *                 a legal name; Status=S alone is only transport success).
 *  - 'rejected' — the GSTIN is genuinely invalid or has no record.
 *  - 'error'    — the check could not be completed (auth / IP whitelist /
 *                 session / technical / network). Not the applicant's fault.
 *
 * On 'verified' the registry snapshot fields are populated; on the other two
 * `errorCode` / `reason` carry the provider's diagnostics.
 */
readonly class GstinVerificationResult
{
    public function __construct(
        public string $gstin,
        public bool $verified,
        public string $status,
        public ?string $errorCode = null,
        public ?string $reason = null,
        public ?string $legalName = null,
        public ?string $tradeName = null,
        public ?string $constitution = null,
        public ?string $taxpayerType = null,
        public ?string $gstinStatus = null,
        public ?string $registrationDate = null,
        public ?string $stateJurisdiction = null,
        public ?string $centreJurisdiction = null,
        public ?string $natureOfBusiness = null,
        public ?array $principalAddress = null,
        public array $raw = [],
        public string $provider = 'protean',
    ) {}

    /**
     * Message shown to the applicant when a hard gate blocks on this result.
     * A definitive rejection surfaces the registry reason; a technical error is
     * kept generic so we never leak our own IP/credential/session problems.
     */
    public function customerMessage(): string
    {
        return match ($this->status) {
            'verified' => 'GSTIN verified with the GST registry.',
            'rejected' => $this->reason !== null && $this->reason !== ''
                ? "This GSTIN could not be verified with the GST registry: {$this->reason} Please check the GSTIN."
                : 'This GSTIN could not be verified with the GST registry. Please check the GSTIN.',
            default => 'GSTIN verification is temporarily unavailable. Please try again in a few minutes.',
        };
    }
}
