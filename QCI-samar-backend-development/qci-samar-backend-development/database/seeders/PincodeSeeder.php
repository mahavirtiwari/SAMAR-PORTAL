<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class PincodeSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        // Path to the CSV file
        $csvFile = database_path('seeders/LGD_Pincodeto_District.csv');

        if (! File::exists($csvFile)) {
            $this->command->error("CSV file not found at: {$csvFile}");

            return;
        }

        // Clear existing data
        DB::table('pincodes')->truncate();

        // Read CSV file
        $file = fopen($csvFile, 'r');

        // Skip header row
        $header = fgetcsv($file);

        $batchSize = 500;
        $batch = [];
        $count = 0;

        while (($row = fgetcsv($file)) !== false) {
            if (count($row) >= 3) {
                $batch[] = [
                    'pincode' => trim($row[2]),
                    'district' => trim($row[1]),
                    'state' => trim($row[0]),
                    'created_at' => now(),
                    'updated_at' => now(),
                ];

                $count++;

                // Insert in batches for better performance
                if (count($batch) >= $batchSize) {
                    DB::table('pincodes')->insert($batch);
                    $batch = [];
                    $this->command->info("Imported {$count} records...");
                }
            }
        }

        // Insert remaining records
        if (! empty($batch)) {
            DB::table('pincodes')->insert($batch);
        }

        fclose($file);

        $this->command->info("Successfully imported {$count} pincode records!");
    }
}
