<?php

namespace Database\Seeders;

use App\Models\ServiceKeyResource;
use Illuminate\Database\Seeder;

class ServiceKeyResourcesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $resources = [
            // Annual Maintenance Contract resources
            ['resource_name' => 'Service Engineers', 'service_provider_type' => 'annual_maintenance_contract'],
            ['resource_name' => 'Technicians', 'service_provider_type' => 'annual_maintenance_contract'],
            ['resource_name' => 'Diagnostic Equipment', 'service_provider_type' => 'annual_maintenance_contract'],
            ['resource_name' => 'Spare Parts Inventory', 'service_provider_type' => 'annual_maintenance_contract'],
            ['resource_name' => 'Testing Instruments', 'service_provider_type' => 'annual_maintenance_contract'],
            ['resource_name' => 'Service Vehicles', 'service_provider_type' => 'annual_maintenance_contract'],
            ['resource_name' => 'Technical Documentation', 'service_provider_type' => 'annual_maintenance_contract'],
            ['resource_name' => 'Helpdesk Support', 'service_provider_type' => 'annual_maintenance_contract'],

            // Critical Service Provider resources
            ['resource_name' => 'Lab Equipment', 'service_provider_type' => 'critical_service_provider'],
            ['resource_name' => 'Certified Inspectors', 'service_provider_type' => 'critical_service_provider'],
            ['resource_name' => 'Calibrated Instruments', 'service_provider_type' => 'critical_service_provider'],
            ['resource_name' => 'Reference Standards', 'service_provider_type' => 'critical_service_provider'],
            ['resource_name' => 'Testing Machines', 'service_provider_type' => 'critical_service_provider'],
            ['resource_name' => 'Quality Engineers', 'service_provider_type' => 'critical_service_provider'],
            ['resource_name' => 'NDT Equipment', 'service_provider_type' => 'critical_service_provider'],
            ['resource_name' => 'Transport Containers', 'service_provider_type' => 'critical_service_provider'],
            ['resource_name' => 'Climate Controlled Storage', 'service_provider_type' => 'critical_service_provider'],
            ['resource_name' => 'Documentation System', 'service_provider_type' => 'critical_service_provider'],
            ['resource_name' => 'Trained Operators', 'service_provider_type' => 'critical_service_provider'],

            // Civil Works Contractor resources
            ['resource_name' => 'Civil Engineers', 'service_provider_type' => 'civil_works_contractor'],
            ['resource_name' => 'Site Supervisors', 'service_provider_type' => 'civil_works_contractor'],
            ['resource_name' => 'Skilled Labor', 'service_provider_type' => 'civil_works_contractor'],
            ['resource_name' => 'Construction Equipment', 'service_provider_type' => 'civil_works_contractor'],
            ['resource_name' => 'Safety Equipment', 'service_provider_type' => 'civil_works_contractor'],
            ['resource_name' => 'Quality Testing Equipment', 'service_provider_type' => 'civil_works_contractor'],
            ['resource_name' => 'Material Handling Equipment', 'service_provider_type' => 'civil_works_contractor'],
            ['resource_name' => 'Scaffolding & Formwork', 'service_provider_type' => 'civil_works_contractor'],
            ['resource_name' => 'Survey Instruments', 'service_provider_type' => 'civil_works_contractor'],
        ];

        foreach ($resources as $resource) {
            ServiceKeyResource::firstOrCreate(
                [
                    'resource_name' => $resource['resource_name'],
                    'service_provider_type' => $resource['service_provider_type'],
                ],
                array_merge($resource, ['is_active' => true])
            );
        }

        $this->command->info('Service key resources seeded successfully: '.count($resources).' items');
    }
}
