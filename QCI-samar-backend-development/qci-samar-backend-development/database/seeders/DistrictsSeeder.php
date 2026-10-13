<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class DistrictsSeeder extends Seeder
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

        // Extract districts data using regex
        preg_match('/REPLACE INTO `districts`.*?VALUES\s*(.*?);/s', $sqlContent, $matches);

        if (empty($matches[1])) {
            $this->command->error('Could not extract districts data from SQL file');

            return;
        }

        $dataString = $matches[1];

        // Parse individual rows from SQL: (id, state_id, 'title', 'title_slug', district_code_numeric, 'district_acr', ...)
        // We need: id (1), state_id (2), title (3), and district_acr (6) - skipping title_slug (4) and district_code (5)
        preg_match_all('/\((\d+),\s*(\d+),\s*\'([^\']*)\',\s*\'[^\']*\',\s*\d+,\s*\'([^\']*)\'/i', $dataString, $rows, PREG_SET_ORDER);

        $districts = [];
        foreach ($rows as $row) {
            $districts[] = [
                'id' => (int) $row[1],
                'state_id' => (int) $row[2],
                'name' => $row[3],
                'code' => $row[4], // Now correctly captures district_acr (e.g., 'NIC', 'GNT')
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        $this->command->info('Parsed '.count($districts).' districts');

        // Upsert in chunks of 100 (insert new records OR update code for existing ones)
        foreach (array_chunk($districts, 100) as $chunk) {
            DB::table('districts')->upsert(
                $chunk,
                ['id'], // Unique key
                ['name', 'code', 'updated_at'] // Columns to update on conflict
            );
        }

        $this->command->info('Districts seeded successfully!');
    }
}
