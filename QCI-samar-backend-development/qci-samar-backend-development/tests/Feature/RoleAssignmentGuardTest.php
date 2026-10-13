<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use App\Services\UserService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RoleAssignmentGuardTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function assignRole(User $user, string $slug, ?int $orgId, ?int $unitId): void
    {
        $role = Role::where('slug', $slug)->firstOrFail();
        $user->roles()->attach($role->id, [
            'organization_id' => $orgId,
            'unit_id' => $unitId,
            'is_active' => true,
            'assigned_at' => now(),
        ]);
    }

    private function makeUnit(Organization $org): Unit
    {
        return Unit::create([
            'organization_id' => $org->id,
            'name' => 'Unit',
            'address' => 'Addr',
            'state' => 'State',
            'district' => 'District',
            'pincode' => '110011',
            'unit_type' => 'manufacturing',
            'status' => 'active',
        ]);
    }

    public function test_enterprise_admin_cannot_assign_unit_from_another_organization(): void
    {
        $orgA = Organization::factory()->create();
        $orgB = Organization::factory()->create();
        $unitB = $this->makeUnit($orgB);

        $ea = User::factory()->create(['organization_id' => $orgA->id]);
        $this->assignRole($ea, Role::ENTERPRISE_ADMIN, $orgA->id, null);

        $service = app(UserService::class);

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('does not belong');

        $service->createUser([
            'first_name' => 'Cross',
            'last_name' => 'Org',
            'email' => 'cross.org@example.com',
            'mobile_number' => '9876543210',
            'organization_id' => $orgA->id,
            'roles' => [
                // unit belongs to orgB, but the role is scoped to the EA's orgA
                ['slug' => Role::UNIT_ADMIN, 'organization_id' => $orgA->id, 'unit_id' => $unitB->id],
            ],
        ], $ea);
    }

    public function test_unit_admin_cannot_assign_roles_at_service_level(): void
    {
        $org = Organization::factory()->create();
        $unit = $this->makeUnit($org);

        $unitAdmin = User::factory()->create(['organization_id' => $org->id]);
        $this->assignRole($unitAdmin, Role::UNIT_ADMIN, $org->id, $unit->id);

        $service = app(UserService::class);

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Unit Admins cannot');

        $service->createUser([
            'first_name' => 'Should',
            'last_name' => 'Fail',
            'email' => 'should.fail@example.com',
            'mobile_number' => '9876543211',
            'organization_id' => $org->id,
            'roles' => [
                ['slug' => Role::UNIT_ADMIN, 'organization_id' => $org->id, 'unit_id' => $unit->id],
            ],
        ], $unitAdmin);
    }
}
