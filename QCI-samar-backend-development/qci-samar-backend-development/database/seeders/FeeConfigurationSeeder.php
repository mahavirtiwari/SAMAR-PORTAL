<?php

namespace Database\Seeders;

use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class FeeConfigurationSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $now = Carbon::now();

        $feeConfigurations = [
            // Manufacturing sector configurations
            [
                'sector' => 'manufacturing',
                'enterprise_size' => 'startup',
                'base_certification_fee' => 30000.00,
                'food_and_accommodation_fee' => 2000.00,
                'gst_percentage' => 18.00,
                'tds_enabled' => false,
                'created_at' => $now,
                'updated_at' => $now,
                'created_by' => 1,
                'updated_by' => 1,
            ],
            [
                'sector' => 'manufacturing',
                'enterprise_size' => 'micro',
                'base_certification_fee' => 35000.00,
                'food_and_accommodation_fee' => 2000.00,
                'gst_percentage' => 18.00,
                'tds_enabled' => false,
                'created_at' => $now,
                'updated_at' => $now,
                'created_by' => 1,
                'updated_by' => 1,
            ],
            [
                'sector' => 'manufacturing',
                'enterprise_size' => 'small',
                'base_certification_fee' => 40000.00,
                'food_and_accommodation_fee' => 2000.00,
                'gst_percentage' => 18.00,
                'tds_enabled' => false,
                'created_at' => $now,
                'updated_at' => $now,
                'created_by' => 1,
                'updated_by' => 1,
            ],
            [
                'sector' => 'manufacturing',
                'enterprise_size' => 'medium',
                'base_certification_fee' => 45000.00,
                'food_and_accommodation_fee' => 2000.00,
                'gst_percentage' => 18.00,
                'tds_enabled' => false,
                'created_at' => $now,
                'updated_at' => $now,
                'created_by' => 1,
                'updated_by' => 1,
            ],
            [
                'sector' => 'manufacturing',
                'enterprise_size' => 'large',
                'base_certification_fee' => 50000.00,
                'food_and_accommodation_fee' => 2000.00,
                'gst_percentage' => 18.00,
                'tds_enabled' => false,
                'created_at' => $now,
                'updated_at' => $now,
                'created_by' => 1,
                'updated_by' => 1,
            ],

            // Service sector configurations
            [
                'sector' => 'service',
                'enterprise_size' => 'startup',
                'base_certification_fee' => 30000.00,
                'food_and_accommodation_fee' => 2000.00,
                'gst_percentage' => 18.00,
                'tds_enabled' => false,
                'created_at' => $now,
                'updated_at' => $now,
                'created_by' => 1,
                'updated_by' => 1,
            ],
            [
                'sector' => 'service',
                'enterprise_size' => 'micro',
                'base_certification_fee' => 35000.00,
                'food_and_accommodation_fee' => 2000.00,
                'gst_percentage' => 18.00,
                'tds_enabled' => false,
                'created_at' => $now,
                'updated_at' => $now,
                'created_by' => 1,
                'updated_by' => 1,
            ],
            [
                'sector' => 'service',
                'enterprise_size' => 'small',
                'base_certification_fee' => 40000.00,
                'food_and_accommodation_fee' => 2000.00,
                'gst_percentage' => 18.00,
                'tds_enabled' => false,
                'created_at' => $now,
                'updated_at' => $now,
                'created_by' => 1,
                'updated_by' => 1,
            ],
            [
                'sector' => 'service',
                'enterprise_size' => 'medium',
                'base_certification_fee' => 45000.00,
                'food_and_accommodation_fee' => 2000.00,
                'gst_percentage' => 18.00,
                'tds_enabled' => false,
                'created_at' => $now,
                'updated_at' => $now,
                'created_by' => 1,
                'updated_by' => 1,
            ],
            [
                'sector' => 'service',
                'enterprise_size' => 'large',
                'base_certification_fee' => 50000.00,
                'food_and_accommodation_fee' => 2000.00,
                'gst_percentage' => 18.00,
                'tds_enabled' => false,
                'created_at' => $now,
                'updated_at' => $now,
                'created_by' => 1,
                'updated_by' => 1,
            ],
        ];

        // Clear existing data and reset auto-increment
        DB::table('fee_configurations')->truncate();

        // Insert new data
        DB::table('fee_configurations')->insert($feeConfigurations);

        $this->command->info('Fee configurations seeded successfully!');
        $this->command->info('Created '.count($feeConfigurations).' fee configurations.');
    }
}
