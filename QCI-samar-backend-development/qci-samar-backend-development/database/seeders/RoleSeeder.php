<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $roles = [
            [
                'name' => 'System Admin',
                'slug' => Role::SYSTEM_ADMIN,
                'description' => 'Full system access with all administrative capabilities',
                'is_system_role' => true,
                'requires_organization' => false,
                'requires_unit' => false,
                'enforce_single_session' => true,
                'level' => 100,
            ],
            [
                'name' => 'DRDO Admin',
                'slug' => Role::DRDO_ADMIN,
                'description' => 'DRDO administrative oversight and approval authority',
                'is_system_role' => true,
                'requires_organization' => false,
                'requires_unit' => false,
                'enforce_single_session' => true,
                'level' => 90,
            ],
            [
                'name' => 'DRDO Lab',
                'slug' => Role::DRDO_LAB,
                'description' => 'DRDO Lab user with read-only access to certified enterprises',
                'is_system_role' => true,
                'requires_organization' => false,
                'requires_unit' => false,
                'enforce_single_session' => true,
                'level' => 85,
            ],
            [
                'name' => 'Operations Manager',
                'slug' => Role::OPERATIONS_MANAGER,
                'description' => 'Manages operations team and oversees assessment processes',
                'is_system_role' => true,
                'requires_organization' => false,
                'requires_unit' => false,
                'enforce_single_session' => true,
                'level' => 80,
            ],
            [
                'name' => 'Operations Admin',
                'slug' => Role::OPERATIONS_ADMIN,
                'description' => 'Handles day-to-day operations and application processing',
                'is_system_role' => true,
                'requires_organization' => false,
                'requires_unit' => false,
                'enforce_single_session' => true,
                'level' => 70,
            ],
            [
                'name' => 'Assessor',
                'slug' => Role::ASSESSOR,
                'description' => 'Conducts assessments and evaluations',
                'is_system_role' => true,
                'requires_organization' => false,
                'requires_unit' => false,
                'enforce_single_session' => true,
                'level' => 60,
            ],
            [
                'name' => 'Enterprise Admin',
                'slug' => Role::ENTERPRISE_ADMIN,
                'description' => 'Organization administrator with full org-level access',
                'is_system_role' => true,
                'requires_organization' => true,
                'requires_unit' => false,
                'enforce_single_session' => true,
                'level' => 50,
            ],
            [
                'name' => 'Unit Admin',
                'slug' => Role::UNIT_ADMIN,
                'description' => 'Unit-level administrator within an organization',
                'is_system_role' => true,
                'requires_organization' => true,
                'requires_unit' => true,
                'enforce_single_session' => true,
                'level' => 40,
            ],
            [
                'name' => 'ERP Integration',
                'slug' => Role::ERP_INTEGRATION,
                'description' => 'Machine account for the Business Central ERP to push invoice/receipt PDFs',
                'is_system_role' => true,
                'requires_organization' => false,
                'requires_unit' => false,
                // M2M: concurrent batch calls from BC must not displace each other's sessions.
                'enforce_single_session' => false,
                'level' => 10,
            ],
        ];

        foreach ($roles as $roleData) {
            Role::firstOrCreate(
                ['slug' => $roleData['slug']],
                $roleData
            );
            $this->command->info("Role created/updated: {$roleData['name']}");
        }
    }
}
