<?php

namespace Database\Seeders;

use App\Models\ServiceVendorCategory;
use Illuminate\Database\Seeder;

class ServiceVendorCategoriesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $categories = [
            // Annual Maintenance Contract categories
            ['category_name' => 'IT Infrastructure Maintenance', 'service_provider_type' => 'annual_maintenance_contract'],
            ['category_name' => 'HVAC System Maintenance', 'service_provider_type' => 'annual_maintenance_contract'],
            ['category_name' => 'Electrical System Maintenance', 'service_provider_type' => 'annual_maintenance_contract'],
            ['category_name' => 'Equipment Calibration Services', 'service_provider_type' => 'annual_maintenance_contract'],
            ['category_name' => 'Fire Safety System Maintenance', 'service_provider_type' => 'annual_maintenance_contract'],
            ['category_name' => 'Security System Maintenance', 'service_provider_type' => 'annual_maintenance_contract'],
            ['category_name' => 'Elevator & Lift Maintenance', 'service_provider_type' => 'annual_maintenance_contract'],
            ['category_name' => 'UPS & Power Backup Maintenance', 'service_provider_type' => 'annual_maintenance_contract'],

            // Critical Service Provider categories
            ['category_name' => 'Testing & Calibration Laboratory', 'service_provider_type' => 'critical_service_provider'],
            ['category_name' => 'Quality Inspection Services', 'service_provider_type' => 'critical_service_provider'],
            ['category_name' => 'NDT Services', 'service_provider_type' => 'critical_service_provider'],
            ['category_name' => 'Heat Treatment Services', 'service_provider_type' => 'critical_service_provider'],
            ['category_name' => 'Surface Treatment Services', 'service_provider_type' => 'critical_service_provider'],
            ['category_name' => 'Packaging & Preservation Services', 'service_provider_type' => 'critical_service_provider'],
            ['category_name' => 'Logistics & Transportation', 'service_provider_type' => 'critical_service_provider'],
            ['category_name' => 'Specialized Training Services', 'service_provider_type' => 'critical_service_provider'],

            // Civil Works Contractor categories
            ['category_name' => 'Building Construction', 'service_provider_type' => 'civil_works_contractor'],
            ['category_name' => 'Road Construction', 'service_provider_type' => 'civil_works_contractor'],
            ['category_name' => 'Plumbing & Sanitation', 'service_provider_type' => 'civil_works_contractor'],
            ['category_name' => 'Electrical Works', 'service_provider_type' => 'civil_works_contractor'],
            ['category_name' => 'Interior Finishing', 'service_provider_type' => 'civil_works_contractor'],
            ['category_name' => 'Waterproofing Services', 'service_provider_type' => 'civil_works_contractor'],
            ['category_name' => 'Structural Repairs', 'service_provider_type' => 'civil_works_contractor'],
            ['category_name' => 'Landscaping Services', 'service_provider_type' => 'civil_works_contractor'],
        ];

        foreach ($categories as $category) {
            ServiceVendorCategory::firstOrCreate(
                [
                    'category_name' => $category['category_name'],
                    'service_provider_type' => $category['service_provider_type'],
                ],
                array_merge($category, ['is_active' => true])
            );
        }

        $this->command->info('Service vendor categories seeded successfully: '.count($categories).' items');
    }
}
