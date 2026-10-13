<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Organization;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

class ApplicationRenewalTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function tokenFor(User $user): string
    {
        return JWTAuth::fromUser($user);
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
            'name' => 'Test Unit',
            'address' => 'Plot 1, Industrial Area',
            'state' => 'Haryana',
            'district' => 'Gurugram',
            'pincode' => '122016',
            'unit_type' => 'manufacturing',
            'status' => 'active',
        ]);
    }

    private function makeCertifiedApplication(Organization $org, Unit $unit, array $overrides = []): Application
    {
        return Application::create(array_merge([
            'organization_id' => $org->id,
            'organization_name' => $org->name ?? 'Org',
            'unit_id' => $unit->id,
            'unit_name' => $unit->name,
            'application_number' => 'SAMAR-SRC-'.uniqid(),
            'application_type' => 'new',
            'sector' => 'manufacturing',
            'enterprise_name' => 'Acme Defense',
            'contact_person_name' => 'Jane Doe',
            'contact_person_email' => 'jane@example.com',
            'gst_certificate_file' => 'applications/1/certs/gst.pdf',
            'mfg_products' => [['product_name' => 'Widget']],
            'customers' => [['customer_name' => 'DRDO']],
            'status' => 'certified',
            'certified_at' => now()->subDays(1),
            'certificate_expiry_at' => now()->addDays(30),
            'payment_status' => 'success',
            'payment_amount' => 25000,
        ], $overrides));
    }

    public function test_enterprise_admin_can_renew_certified_application(): void
    {
        $org = Organization::factory()->create();
        $unit = $this->makeUnit($org);
        $ea = User::factory()->create(['organization_id' => $org->id]);
        $this->assignRole($ea, Role::ENTERPRISE_ADMIN, $org->id, null);

        $source = $this->makeCertifiedApplication($org, $unit);

        $response = $this->withToken($this->tokenFor($ea))
            ->postJson("/api/v1/applications/{$source->id}/renew");

        $response->assertStatus(201);
        $newId = $response->json('data.id');
        $this->assertNotSame($source->id, $newId);

        $this->assertDatabaseHas('applications', [
            'id' => $newId,
            'application_type' => 'renewal',
            'status' => 'draft',
            'previous_application_id' => $source->id,
            'unit_id' => $unit->id,
        ]);

        $new = Application::find($newId);
        // Prefilled business fields + copied document path carry over.
        $this->assertSame('Acme Defense', $new->enterprise_name);
        $this->assertSame('applications/1/certs/gst.pdf', $new->gst_certificate_file);
        // Lifecycle fields are reset.
        $this->assertSame('pending', $new->payment_status);
        $this->assertNull($new->certified_at);
        $this->assertNull($new->certificate_expiry_at);
        $this->assertNotSame($source->application_number, $new->application_number);
    }

    public function test_renew_is_idempotent_and_returns_existing_draft(): void
    {
        $org = Organization::factory()->create();
        $unit = $this->makeUnit($org);
        $ea = User::factory()->create(['organization_id' => $org->id]);
        $this->assignRole($ea, Role::ENTERPRISE_ADMIN, $org->id, null);
        $source = $this->makeCertifiedApplication($org, $unit);

        $token = $this->tokenFor($ea);
        $first = $this->withToken($token)->postJson("/api/v1/applications/{$source->id}/renew");
        $first->assertStatus(201);

        $second = $this->withToken($token)->postJson("/api/v1/applications/{$source->id}/renew");
        $second->assertStatus(200);

        $this->assertSame($first->json('data.id'), $second->json('data.id'));
        $this->assertSame(1, Application::where('previous_application_id', $source->id)->count());
    }

    public function test_renew_rejects_non_certified_application(): void
    {
        $org = Organization::factory()->create();
        $unit = $this->makeUnit($org);
        $ea = User::factory()->create(['organization_id' => $org->id]);
        $this->assignRole($ea, Role::ENTERPRISE_ADMIN, $org->id, null);
        $source = $this->makeCertifiedApplication($org, $unit, [
            'status' => 'draft',
            'certified_at' => null,
            'certificate_expiry_at' => null,
        ]);

        $response = $this->withToken($this->tokenFor($ea))
            ->postJson("/api/v1/applications/{$source->id}/renew");

        $response->assertStatus(403);
    }

    public function test_renew_is_scoped_to_owning_organization(): void
    {
        $orgA = Organization::factory()->create();
        $orgB = Organization::factory()->create();
        $unitA = $this->makeUnit($orgA);
        $source = $this->makeCertifiedApplication($orgA, $unitA);

        $intruder = User::factory()->create(['organization_id' => $orgB->id]);
        $this->assignRole($intruder, Role::ENTERPRISE_ADMIN, $orgB->id, null);

        $response = $this->withToken($this->tokenFor($intruder))
            ->postJson("/api/v1/applications/{$source->id}/renew");

        $response->assertStatus(403);
        $this->assertDatabaseMissing('applications', ['previous_application_id' => $source->id]);
    }

    public function test_unit_admin_cannot_initiate_renewal(): void
    {
        $org = Organization::factory()->create();
        $unit = $this->makeUnit($org);
        $source = $this->makeCertifiedApplication($org, $unit);

        $ua = User::factory()->create(['organization_id' => $org->id]);
        $this->assignRole($ua, Role::UNIT_ADMIN, $org->id, $unit->id);

        $response = $this->withToken($this->tokenFor($ua))
            ->postJson("/api/v1/applications/{$source->id}/renew");

        // Blocked by the role:enterprise_admin route middleware.
        $response->assertStatus(403);
    }

    public function test_renew_blocked_outside_recertification_window(): void
    {
        $org = Organization::factory()->create();
        $unit = $this->makeUnit($org);
        $ea = User::factory()->create(['organization_id' => $org->id]);
        $this->assignRole($ea, Role::ENTERPRISE_ADMIN, $org->id, null);
        // Expiry far out -> outside the renewal window.
        $source = $this->makeCertifiedApplication($org, $unit, [
            'certificate_expiry_at' => now()->addDays(200),
        ]);

        $response = $this->withToken($this->tokenFor($ea))
            ->postJson("/api/v1/applications/{$source->id}/renew");

        $response->assertStatus(422);
        $this->assertDatabaseMissing('applications', ['previous_application_id' => $source->id]);
    }
}
