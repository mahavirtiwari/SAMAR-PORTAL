<?php

namespace App\Services\BusinessCentral;

use App\Models\InvoiceSequence;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Generates the portal-side invoice reference sent to Business Central.
 *
 * QCI confirmed (16-Jul-2026) that BC leaves Invoice_No blank and expects the
 * portal to generate, store, and send a unique reference in the 'TADA Invoice
 * No.' field. Format follows QCI's existing house convention (their NABH series
 * reads SHCO/2025/00001), so their finance team can read ours without a lookup:
 *
 *     SAMAR/2026-27/00001
 *
 * BC does not de-duplicate on resubmission, so this reference is the only thing
 * standing between a retry and a duplicate ledger entry. It is allocated inside
 * a locked transaction and is unique at the database level.
 */
class InvoiceReferenceGenerator
{
    private const PREFIX = 'SAMAR';

    /** Business Central 'TADA Invoice No.' is Code 20. */
    private const MAX_LENGTH = 20;

    public function generate(?Carbon $on = null): string
    {
        $financialYear = $this->financialYear($on ?? now());
        $number = $this->nextNumber($financialYear);

        $reference = sprintf('%s/%s/%05d', self::PREFIX, $financialYear, $number);

        if (strlen($reference) > self::MAX_LENGTH) {
            throw new \RuntimeException(
                "Generated invoice reference '{$reference}' exceeds Business Central's ".self::MAX_LENGTH.'-character limit.'
            );
        }

        return $reference;
    }

    /**
     * Allocate the next sequence number for the financial year.
     */
    private function nextNumber(string $financialYear): int
    {
        return DB::transaction(function () use ($financialYear) {
            InvoiceSequence::firstOrCreate(
                ['financial_year' => $financialYear],
                ['last_number' => 0]
            );

            $sequence = InvoiceSequence::where('financial_year', $financialYear)
                ->lockForUpdate()
                ->first();

            $sequence->last_number++;
            $sequence->save();

            return $sequence->last_number;
        });
    }

    /**
     * Indian financial year label (April to March), e.g. 16-Jul-2026 => 2026-27.
     */
    private function financialYear(Carbon $date): string
    {
        $startYear = $date->month >= 4 ? $date->year : $date->year - 1;

        return sprintf('%d-%02d', $startYear, ($startYear + 1) % 100);
    }
}
