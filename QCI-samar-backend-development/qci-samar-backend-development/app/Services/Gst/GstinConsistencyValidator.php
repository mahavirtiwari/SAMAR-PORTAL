<?php

namespace App\Services\Gst;

use App\Services\BusinessCentral\BcStates;

/**
 * Single source of truth for GSTIN ↔ registered-state ↔ PAN consistency.
 *
 * A GSTIN is 15 chars: positions 1-2 are the state GST code, 3-12 the PAN,
 * 13 the entity count, 14 a literal 'Z', 15 a checksum. This checks the two
 * rules that must hold against the organisation's own data — pos 1-2 == the
 * registered state's GST code, and pos 3-12 == the PAN — plus length and the
 * "PAN required when GSTIN present" precondition.
 *
 * Used both at application submission (surfaced as a 422 to the customer) and
 * by the Business Central customer payload (which asserts before pushing).
 */
class GstinConsistencyValidator
{
    /**
     * Returns null when the GSTIN is consistent or empty (GST is optional),
     * otherwise the first failure as a structured, user-friendly result.
     *
     * When the registered state cannot be mapped to a GST code, the state-code
     * rule is skipped (it cannot be evaluated) rather than treated as a failure.
     */
    public function validate(?string $gstin, ?string $pan, ?string $registeredState): ?GstinConsistencyResult
    {
        $gstin = strtoupper(trim((string) $gstin));
        if ($gstin === '') {
            return null;
        }

        if (strlen($gstin) !== 15) {
            return GstinConsistencyResult::fail('length', 'GSTIN must be exactly 15 characters.');
        }

        $state = BcStates::canonical($registeredState);
        $stateCode = $state !== null ? BcStates::gstCode($state) : null;
        $gstinStateCode = substr($gstin, 0, 2);
        if ($stateCode !== null && $gstinStateCode !== $stateCode) {
            return GstinConsistencyResult::fail(
                'state_mismatch',
                "The first two digits of a GSTIN are its state code. This GSTIN's state code ({$gstinStateCode}) "
                    ."does not match your registered office state, {$state} (state code {$stateCode}). A GSTIN must be "
                    ."registered in the same state as the registered office. Please check the GSTIN or the registered office state."
            );
        }

        $pan = strtoupper(trim((string) $pan));
        if ($pan === '') {
            return GstinConsistencyResult::fail('pan_required', "Your organisation's PAN is required before a GST-registered application can be submitted. Please add the PAN in your Organisation profile.");
        }

        if (substr($gstin, 2, 10) !== $pan) {
            return GstinConsistencyResult::fail(
                'pan_mismatch',
                "The PAN embedded in this GSTIN does not match your organisation's PAN. Please verify both."
            );
        }

        return null;
    }

    /**
     * Assert consistency, throwing when it fails. Kept for callers (the BC push)
     * that must hard-fail rather than surface a message.
     */
    public function assert(?string $gstin, ?string $pan, ?string $registeredState): void
    {
        $result = $this->validate($gstin, $pan, $registeredState);
        if ($result !== null) {
            throw new \InvalidArgumentException($result->message);
        }
    }
}
