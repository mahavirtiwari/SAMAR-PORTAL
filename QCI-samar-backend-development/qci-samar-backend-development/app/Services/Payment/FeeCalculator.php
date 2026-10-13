<?php

namespace App\Services\Payment;

use App\Exceptions\BusinessException;
use App\Exceptions\FeeConfigurationMissingException;
use App\Models\Application;
use App\Models\FeeConfiguration;

/**
 * Server-side source of truth for what an application costs.
 *
 * The amount was previously computed only in the web client and persisted
 * verbatim, so a tampered request could pay any figure. Everything here is
 * derived from fee_configurations; the only client-supplied inputs are the
 * applicant's TDS election, and even those are ignored unless the matched
 * configuration enables TDS.
 */
class FeeCalculator
{
    /** TDS rates the applicant may elect, mirroring the portal's radio options. */
    public const ALLOWED_TDS_PERCENTAGES = [2.0, 10.0];

    /**
     * Resolve the authoritative total and its breakdown for an application.
     *
     * `metadata` is the shape persisted on the payment; `tdsAvailable` is quote-time
     * information for the payment screen and is deliberately not stored.
     *
     * @return array{total: float, metadata: array<string, mixed>, tdsAvailable: bool}
     *
     * @throws FeeConfigurationMissingException
     */
    public function forApplication(
        Application $application,
        bool $tdsDeductible = false,
        ?float $tdsPercentage = null
    ): array {
        $config = $this->configFor($application);

        $baseFee = (float) $config->base_certification_fee;
        $foodAccommodation = (float) $config->food_and_accommodation_fee;

        // The model owns the base arithmetic; this service owns the policy on top of
        // it — TDS eligibility, rounding, and the persisted breakdown shape.
        $amountPayable = $config->total_fee;
        $gstPercentage = (float) $config->gst_percentage;
        $gstAmount = round($config->gst_amount, 2);

        $applyTds = $tdsDeductible && $config->tds_enabled;
        $effectiveTdsPercentage = $applyTds ? $this->assertAllowedTdsPercentage($tdsPercentage) : 0.0;
        $tdsAmount = round($amountPayable * $effectiveTdsPercentage / 100, 2);

        return [
            'total' => round($amountPayable + $gstAmount - $tdsAmount, 2),
            'tdsAvailable' => (bool) $config->tds_enabled,
            // Keys mirror what Payment::getBreakdownAttribute() reads back for display.
            'metadata' => [
                'base_fee' => $baseFee,
                'food_accommodation' => $foodAccommodation,
                'gst_percentage' => $gstPercentage,
                'gst_amount' => $gstAmount,
                'tds_deductible' => $applyTds,
                'tds_percentage' => $effectiveTdsPercentage,
                'tds_amount' => $tdsAmount,
            ],
        ];
    }

    /**
     * @throws FeeConfigurationMissingException
     */
    private function configFor(Application $application): FeeConfiguration
    {
        $sector = $application->sector;
        $enterpriseSize = $application->enterprise_classification;

        if (! $sector || ! $enterpriseSize) {
            throw FeeConfigurationMissingException::forApplication($sector, $enterpriseSize);
        }

        $config = FeeConfiguration::findByConfiguration($sector, $enterpriseSize);

        if (! $config) {
            throw FeeConfigurationMissingException::forApplication($sector, $enterpriseSize);
        }

        return $config;
    }

    /**
     * Guards the legacy path too: older clients send the TDS election inside
     * `metadata`, which never passes through request validation.
     */
    private function assertAllowedTdsPercentage(?float $tdsPercentage): float
    {
        if (! in_array($tdsPercentage, self::ALLOWED_TDS_PERCENTAGES, true)) {
            throw new BusinessException(sprintf(
                'TDS percentage must be one of %s, got "%s".',
                implode(', ', self::ALLOWED_TDS_PERCENTAGES),
                $tdsPercentage ?? 'null'
            ));
        }

        return $tdsPercentage;
    }
}
