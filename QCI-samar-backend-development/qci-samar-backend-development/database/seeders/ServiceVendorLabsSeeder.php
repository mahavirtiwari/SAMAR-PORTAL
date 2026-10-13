<?php

namespace Database\Seeders;

use App\Models\ServiceVendorLab;
use Illuminate\Database\Seeder;

class ServiceVendorLabsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $labs = [
            // Annual Maintenance Contract labs
            ['lab_name' => 'Calibration Lab', 'service_provider_type' => 'annual_maintenance_contract'],
            ['lab_name' => 'Environmental Testing Lab', 'service_provider_type' => 'annual_maintenance_contract'],
            ['lab_name' => 'Electrical Safety Testing Lab', 'service_provider_type' => 'annual_maintenance_contract'],

            // Critical Service Provider labs
            ['lab_name' => 'Chemical Analysis Lab', 'service_provider_type' => 'critical_service_provider'],
            ['lab_name' => 'Material Testing Lab', 'service_provider_type' => 'critical_service_provider'],
            ['lab_name' => 'NDT Lab', 'service_provider_type' => 'critical_service_provider'],
            ['lab_name' => 'Metrology Lab', 'service_provider_type' => 'critical_service_provider'],
            ['lab_name' => 'Mechanical Testing Lab', 'service_provider_type' => 'critical_service_provider'],
            ['lab_name' => 'Metallurgical Lab', 'service_provider_type' => 'critical_service_provider'],
            ['lab_name' => 'Vibration Testing Lab', 'service_provider_type' => 'critical_service_provider'],
            ['lab_name' => 'EMI/EMC Testing Lab', 'service_provider_type' => 'critical_service_provider'],
            ['lab_name' => 'Thermal Testing Lab', 'service_provider_type' => 'critical_service_provider'],
            ['lab_name' => 'Fatigue Testing Lab', 'service_provider_type' => 'critical_service_provider'],
            ['lab_name' => 'Corrosion Testing Lab', 'service_provider_type' => 'critical_service_provider'],
            ['lab_name' => 'Reliability Testing Lab', 'service_provider_type' => 'critical_service_provider'],

            // Civil Works Contractor labs
            ['lab_name' => 'Soil Testing Lab', 'service_provider_type' => 'civil_works_contractor'],
            ['lab_name' => 'Concrete Testing Lab', 'service_provider_type' => 'civil_works_contractor'],
            ['lab_name' => 'Construction Materials Lab', 'service_provider_type' => 'civil_works_contractor'],
        ];

        foreach ($labs as $lab) {
            ServiceVendorLab::firstOrCreate(
                [
                    'lab_name' => $lab['lab_name'],
                    'service_provider_type' => $lab['service_provider_type'],
                ],
                array_merge($lab, ['is_active' => true])
            );
        }

        $this->command->info('Service vendor labs seeded successfully: '.count($labs).' items');
    }
}
