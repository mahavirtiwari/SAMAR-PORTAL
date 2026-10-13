<?php

namespace Database\Seeders;

use App\Models\ServiceOutsourcedComponent;
use Illuminate\Database\Seeder;

class ServiceOutsourcedComponentsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $components = [
            // Annual Maintenance Contract components
            ['component_name' => 'Specialized Repairs', 'service_provider_type' => 'annual_maintenance_contract'],
            ['component_name' => 'OEM Support', 'service_provider_type' => 'annual_maintenance_contract'],
            ['component_name' => 'Third Party Calibration', 'service_provider_type' => 'annual_maintenance_contract'],
            ['component_name' => 'Software Updates', 'service_provider_type' => 'annual_maintenance_contract'],
            ['component_name' => 'Remote Diagnostics', 'service_provider_type' => 'annual_maintenance_contract'],
            ['component_name' => 'Specialized Training', 'service_provider_type' => 'annual_maintenance_contract'],

            // Critical Service Provider components
            ['component_name' => 'Specialized Testing', 'service_provider_type' => 'critical_service_provider'],
            ['component_name' => 'Advanced Analysis', 'service_provider_type' => 'critical_service_provider'],
            ['component_name' => 'Reference Sample Testing', 'service_provider_type' => 'critical_service_provider'],
            ['component_name' => 'Certification Services', 'service_provider_type' => 'critical_service_provider'],
            ['component_name' => 'Proficiency Testing', 'service_provider_type' => 'critical_service_provider'],
            ['component_name' => 'Inter-laboratory Comparison', 'service_provider_type' => 'critical_service_provider'],
            ['component_name' => 'Environmental Conditioning', 'service_provider_type' => 'critical_service_provider'],
            ['component_name' => 'Specialized Coating', 'service_provider_type' => 'critical_service_provider'],
            ['component_name' => 'Precision Machining', 'service_provider_type' => 'critical_service_provider'],
            ['component_name' => 'Special Purpose Packaging', 'service_provider_type' => 'critical_service_provider'],

            // Civil Works Contractor components
            ['component_name' => 'Soil Investigation', 'service_provider_type' => 'civil_works_contractor'],
            ['component_name' => 'Structural Design', 'service_provider_type' => 'civil_works_contractor'],
            ['component_name' => 'MEP Services', 'service_provider_type' => 'civil_works_contractor'],
            ['component_name' => 'Precast Elements', 'service_provider_type' => 'civil_works_contractor'],
            ['component_name' => 'Ready Mix Concrete', 'service_provider_type' => 'civil_works_contractor'],
            ['component_name' => 'Steel Fabrication', 'service_provider_type' => 'civil_works_contractor'],
            ['component_name' => 'Glass & Glazing', 'service_provider_type' => 'civil_works_contractor'],
            ['component_name' => 'Waterproofing', 'service_provider_type' => 'civil_works_contractor'],
            ['component_name' => 'Fire Protection', 'service_provider_type' => 'civil_works_contractor'],
        ];

        foreach ($components as $component) {
            ServiceOutsourcedComponent::firstOrCreate(
                [
                    'component_name' => $component['component_name'],
                    'service_provider_type' => $component['service_provider_type'],
                ],
                array_merge($component, ['is_active' => true])
            );
        }

        $this->command->info('Service outsourced components seeded successfully: '.count($components).' items');
    }
}
