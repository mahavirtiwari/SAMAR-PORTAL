<?php

namespace Database\Seeders;

use App\Models\ServiceKeyProcess;
use Illuminate\Database\Seeder;

class ServiceKeyProcessesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $processes = [
            // Annual Maintenance Contract processes
            ['process_name' => 'Preventive Maintenance', 'service_provider_type' => 'annual_maintenance_contract'],
            ['process_name' => 'Corrective Maintenance', 'service_provider_type' => 'annual_maintenance_contract'],
            ['process_name' => 'Scheduled Servicing', 'service_provider_type' => 'annual_maintenance_contract'],
            ['process_name' => 'Breakdown Support', 'service_provider_type' => 'annual_maintenance_contract'],
            ['process_name' => 'Spare Parts Management', 'service_provider_type' => 'annual_maintenance_contract'],
            ['process_name' => 'Performance Monitoring', 'service_provider_type' => 'annual_maintenance_contract'],
            ['process_name' => 'System Health Check', 'service_provider_type' => 'annual_maintenance_contract'],
            ['process_name' => 'Documentation & Reporting', 'service_provider_type' => 'annual_maintenance_contract'],

            // Critical Service Provider processes
            ['process_name' => 'Sample Collection', 'service_provider_type' => 'critical_service_provider'],
            ['process_name' => 'Testing & Analysis', 'service_provider_type' => 'critical_service_provider'],
            ['process_name' => 'Quality Inspection', 'service_provider_type' => 'critical_service_provider'],
            ['process_name' => 'Calibration Services', 'service_provider_type' => 'critical_service_provider'],
            ['process_name' => 'Non-Destructive Testing', 'service_provider_type' => 'critical_service_provider'],
            ['process_name' => 'Certificate Issuance', 'service_provider_type' => 'critical_service_provider'],
            ['process_name' => 'Result Verification', 'service_provider_type' => 'critical_service_provider'],
            ['process_name' => 'Traceability Management', 'service_provider_type' => 'critical_service_provider'],
            ['process_name' => 'Heat Treatment Processing', 'service_provider_type' => 'critical_service_provider'],
            ['process_name' => 'Surface Finishing', 'service_provider_type' => 'critical_service_provider'],
            ['process_name' => 'Packaging & Preservation', 'service_provider_type' => 'critical_service_provider'],

            // Civil Works Contractor processes
            ['process_name' => 'Site Survey', 'service_provider_type' => 'civil_works_contractor'],
            ['process_name' => 'Foundation Work', 'service_provider_type' => 'civil_works_contractor'],
            ['process_name' => 'Structural Work', 'service_provider_type' => 'civil_works_contractor'],
            ['process_name' => 'Brick Masonry', 'service_provider_type' => 'civil_works_contractor'],
            ['process_name' => 'Plastering', 'service_provider_type' => 'civil_works_contractor'],
            ['process_name' => 'Flooring', 'service_provider_type' => 'civil_works_contractor'],
            ['process_name' => 'Painting', 'service_provider_type' => 'civil_works_contractor'],
            ['process_name' => 'Electrical Installation', 'service_provider_type' => 'civil_works_contractor'],
            ['process_name' => 'Plumbing Installation', 'service_provider_type' => 'civil_works_contractor'],
            ['process_name' => 'Quality Control Inspection', 'service_provider_type' => 'civil_works_contractor'],
        ];

        foreach ($processes as $process) {
            ServiceKeyProcess::firstOrCreate(
                [
                    'process_name' => $process['process_name'],
                    'service_provider_type' => $process['service_provider_type'],
                ],
                array_merge($process, ['is_active' => true])
            );
        }

        $this->command->info('Service key processes seeded successfully: '.count($processes).' items');
    }
}
