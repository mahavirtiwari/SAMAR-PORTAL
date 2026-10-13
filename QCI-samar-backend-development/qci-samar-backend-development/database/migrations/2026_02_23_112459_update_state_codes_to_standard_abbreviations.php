<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Update state codes to standard 2-letter Indian state abbreviations.
     */
    public function up(): void
    {
        $stateCodes = [
            'ANDAMAN AND NICOBAR ISLANDS' => 'AN',
            'ANDHRA PRADESH' => 'AP',
            'ARUNACHAL PRADESH' => 'AR',
            'ASSAM' => 'AS',
            'BIHAR' => 'BR',
            'CHANDIGARH' => 'CH',
            'CHHATTISGARH' => 'CG',
            'DELHI' => 'DL',
            'GOA' => 'GA',
            'GUJARAT' => 'GJ',
            'HARYANA' => 'HR',
            'HIMACHAL PRADESH' => 'HP',
            'JAMMU AND KASHMIR' => 'JK',
            'JHARKHAND' => 'JH',
            'KARNATAKA' => 'KA',
            'KERALA' => 'KL',
            'LADAKH' => 'LA',
            'LAKSHADWEEP' => 'LD',
            'MADHYA PRADESH' => 'MP',
            'MAHARASHTRA' => 'MH',
            'MANIPUR' => 'MN',
            'MEGHALAYA' => 'ML',
            'MIZORAM' => 'MZ',
            'NAGALAND' => 'NL',
            'ODISHA' => 'OD',
            'PUDUCHERRY' => 'PY',
            'PUNJAB' => 'PB',
            'RAJASTHAN' => 'RJ',
            'SIKKIM' => 'SK',
            'TAMIL NADU' => 'TN',
            'TELANGANA' => 'TG',
            'THE DADRA AND NAGAR HAVELI AND DAMAN AND DIU' => 'DD',
            'TRIPURA' => 'TR',
            'UTTARAKHAND' => 'UK',
            'UTTAR PRADESH' => 'UP',
            'WEST BENGAL' => 'WB',
        ];

        foreach ($stateCodes as $name => $code) {
            DB::table('states')
                ->whereRaw('UPPER(name) = ?', [$name])
                ->update(['code' => $code]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $oldCodes = [
            'ANDAMAN AND NICOBAR ISLANDS' => 'andaman-an',
            'ANDHRA PRADESH' => 'andhra-pra',
            'ARUNACHAL PRADESH' => 'arunachal-',
            'ASSAM' => 'assam',
            'BIHAR' => 'bihar',
            'CHANDIGARH' => 'chandigarh',
            'CHHATTISGARH' => 'chhattisga',
            'DELHI' => 'delhi',
            'GOA' => 'goa',
            'GUJARAT' => 'gujarat',
            'HARYANA' => 'haryana',
            'HIMACHAL PRADESH' => 'himachal-p',
            'JAMMU AND KASHMIR' => 'jammu-and-',
            'JHARKHAND' => 'jharkhand',
            'KARNATAKA' => 'karnataka',
            'KERALA' => 'kerala',
            'LADAKH' => 'ladakh',
            'LAKSHADWEEP' => 'lakshadwee',
            'MADHYA PRADESH' => 'madhya-pra',
            'MAHARASHTRA' => 'maharashtr',
            'MANIPUR' => 'manipur',
            'MEGHALAYA' => 'meghalaya',
            'MIZORAM' => 'mizoram',
            'NAGALAND' => 'nagaland',
            'ODISHA' => 'odisha',
            'PUDUCHERRY' => 'puducherry',
            'PUNJAB' => 'punjab',
            'RAJASTHAN' => 'rajasthan',
            'SIKKIM' => 'sikkim',
            'TAMIL NADU' => 'tamil-nadu',
            'TELANGANA' => 'telangana',
            'THE DADRA AND NAGAR HAVELI AND DAMAN AND DIU' => 'the-dadra-',
            'TRIPURA' => 'tripura',
            'UTTARAKHAND' => 'uttarakhan',
            'UTTAR PRADESH' => 'uttar-prad',
            'WEST BENGAL' => 'west-benga',
        ];

        foreach ($oldCodes as $name => $code) {
            DB::table('states')
                ->whereRaw('UPPER(name) = ?', [$name])
                ->update(['code' => $code]);
        }
    }
};
