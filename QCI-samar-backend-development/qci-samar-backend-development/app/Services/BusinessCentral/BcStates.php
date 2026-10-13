<?php

namespace App\Services\BusinessCentral;

/**
 * Business Central's state master, read from the sandbox States_Excel entity
 * (16-Jul-2026). BC matches the customer State by exact name, and validates
 * that the first two digits of a GSTIN equal the state's GST registration code.
 *
 * Map is state name => GST state code.
 */
class BcStates
{
    public const GST_CODES = [
        'Jammu and Kashmir' => '01',
        'Himachal Pradesh' => '02',
        'Punjab' => '03',
        'Chandigarh' => '04',
        'Uttarakhand' => '05',
        'Haryana' => '06',
        'Delhi' => '07',
        'Rajasthan' => '08',
        'Uttar Pradesh' => '09',
        'Bihar' => '10',
        'Sikkim' => '11',
        'Arunachal Pradesh' => '12',
        'Nagaland' => '13',
        'Manipur' => '14',
        'Mizoram' => '15',
        'Tripura' => '16',
        'Meghalaya' => '17',
        'Assam' => '18',
        'West Bengal' => '19',
        'Jharkhand' => '20',
        'Odisha' => '21',
        'Chhattisgarh' => '22',
        'Madhya Pradesh' => '23',
        'Gujarat' => '24',
        'Dadra and Nagar Haveli & Daman and Diu' => '26',
        'Maharashtra' => '27',
        'Karnataka' => '29',
        'Goa' => '30',
        'Lakshadweep Islands' => '31',
        'Kerala' => '32',
        'Tamil Nadu' => '33',
        'Puducherry' => '34',
        'Andaman and Nicobar Islands' => '35',
        'Telangana' => '36',
        'Andhra Pradesh' => '37',
        'Ladakh' => '38',
        'others' => '97',
    ];

    /**
     * Resolve a SAMAR state value to BC's canonical spelling (case-insensitive).
     */
    public static function canonical(?string $state): ?string
    {
        if ($state === null || trim($state) === '') {
            return null;
        }

        $needle = mb_strtolower(trim($state));
        foreach (array_keys(self::GST_CODES) as $name) {
            if (mb_strtolower($name) === $needle) {
                return $name;
            }
        }

        return null;
    }

    /**
     * GST registration code for a canonical state name.
     */
    public static function gstCode(string $canonicalState): ?string
    {
        return self::GST_CODES[$canonicalState] ?? null;
    }
}
