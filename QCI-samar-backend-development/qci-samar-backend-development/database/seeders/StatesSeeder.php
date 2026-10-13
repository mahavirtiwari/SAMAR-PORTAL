<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class StatesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Read the SQL file
        $sqlFile = database_path('seeders/c-s-d.sql');

        if (! File::exists($sqlFile)) {
            $this->command->error('SQL file not found: c-s-d.sql');

            return;
        }

        $sqlContent = File::get($sqlFile);

        // Extract states data using regex
        preg_match('/REPLACE INTO `states`.*?VALUES\s*(.*?);/s', $sqlContent, $matches);

        if (empty($matches[1])) {
            $this->command->error('Could not extract states data from SQL file');

            return;
        }

        $dataString = $matches[1];

        // Parse individual rows - adjust regex based on actual structure
        preg_match_all('/\((\d+),\s*\'([^\']*)\',\s*\'([^\']*)\',\s*(\d+)/i', $dataString, $rows, PREG_SET_ORDER);

        // Standard 2-letter Indian state/UT abbreviations
        $standardCodes = [
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

        $states = [];
        foreach ($rows as $row) {
            $name = $row[2];
            $states[] = [
                'id' => (int) $row[1],
                'name' => $name,
                'code' => $standardCodes[strtoupper($name)] ?? $row[3],
                'country_id' => 101, // India
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        $this->command->info('Parsed '.count($states).' states');

        // Insert in chunks
        foreach (array_chunk($states, 100) as $chunk) {
            DB::table('states')->insertOrIgnore($chunk);
        }

        $this->command->info('States seeded successfully!');
    }
}
