<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class CountriesSeeder extends Seeder
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

        // Extract countries data using regex
        preg_match('/REPLACE INTO `countries`.*?VALUES\s*(.*?);/s', $sqlContent, $matches);

        if (empty($matches[1])) {
            $this->command->error('Could not extract countries data from SQL file');

            return;
        }

        $dataString = $matches[1];

        // Parse individual rows
        preg_match_all('/\((\d+),\s*\'([^\']*)\',\s*\'([^\']*)\',\s*\'([^\']*)\',\s*(?:\'[^\']*\'|NULL)\)/i', $dataString, $rows, PREG_SET_ORDER);

        $countries = [];
        foreach ($rows as $row) {
            $countries[] = [
                'id' => (int) $row[1],
                'name' => $row[2],
                'code' => $row[3],
                'phone_code' => $row[4],
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        $this->command->info('Parsed '.count($countries).' countries');

        // Insert in chunks
        foreach (array_chunk($countries, 100) as $chunk) {
            DB::table('countries')->insertOrIgnore($chunk);
        }

        $this->command->info('Countries seeded successfully!');
    }
}
