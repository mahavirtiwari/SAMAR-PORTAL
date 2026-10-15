<?php

namespace Tests\Feature;

use App\Models\AccountStatusHistory;
use App\Models\Application;
use App\Models\Organization;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * Deactivating an enterprise or a user needs a reason, which is kept permanently
 * and shown, with every other step, in the enterprise journey.
 */
class EnterpriseJourneyTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);

        $this->admin = $this->userWithRole(Role::SYSTEM_ADMIN);
    }

    private function userWithRole(string $slug, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $user->roles()->attach(Role::where('slug', $slug)->firstOrFail()->id, ['is_active' => true, 'assigned_at' => now()]);

        return $user;
    }

    private function headers(?User $user = null): array
    {
        return ['Authorization' => 'Bearer '.JWTAuth::fromUser($user ?? $this->admin)];
    }

    public function test_enterprise_deactivation_requires_a_reason_and_records_it(): void
    {
        $org = Organization::factory()->create(['status' => 'active']);

        $this->postJson("/api/v1/organizations/{$org->id}/deactivate", [], $this->headers())
            ->assertStatus(422)
            ->assertJsonValidationErrors('reason');
        $this->assertSame('active', $org->fresh()->status);

        $this->postJson("/api/v1/organizations/{$org->id}/deactivate", ['reason' => 'Duplicate registration of BrahMos unit'], $this->headers())
            ->assertOk();

        $this->assertSame('inactive', $org->fresh()->status);
        $history = AccountStatusHistory::where('subject_type', Organization::class)->where('subject_id', $org->id)->sole();
        $this->assertSame('active', $history->from_status);
        $this->assertSame('inactive', $history->to_status);
        $this->assertSame('Duplicate registration of BrahMos unit', $history->remarks);
        $this->assertSame($this->admin->id, $history->changed_by);

        $this->postJson("/api/v1/organizations/{$org->id}/activate", [], $this->headers())->assertOk();
        $this->assertSame(2, AccountStatusHistory::where('subject_id', $org->id)->where('subject_type', Organization::class)->count());
    }

    public function test_user_deactivation_requires_a_reason_and_records_it(): void
    {
        $assessor = $this->userWithRole(Role::ASSESSOR, ['status' => 'active']);

        $this->postJson("/api/v1/users/{$assessor->id}/deactivate", ['reason' => ''], $this->headers())
            ->assertStatus(422)
            ->assertJsonValidationErrors('reason');

        $this->postJson("/api/v1/users/{$assessor->id}/deactivate", ['reason' => 'Left the empanelment'], $this->headers())
            ->assertOk();

        $this->assertSame('inactive', $assessor->fresh()->status);
        $history = $assessor->statusHistories()->first();
        $this->assertSame('inactive', $history->to_status);
        $this->assertSame('Left the empanelment', $history->remarks);
    }

    public function test_journey_lists_every_step_oldest_first_with_reasons(): void
    {
        $org = Organization::factory()->create(['status' => 'active', 'created_at' => now()->subDays(10)]);
        $unit = Unit::create([
            'organization_id' => $org->id, 'name' => 'Plant', 'address' => 'Plot 1', 'state' => 'Maharashtra',
            'district' => 'Pune', 'pincode' => '411001', 'unit_type' => 'manufacturing', 'status' => 'active',
        ]);
        $application = Application::create([
            'organization_id' => $org->id, 'organization_name' => $org->name, 'unit_id' => $unit->id, 'unit_name' => 'Plant',
            'unit_state' => 'Maharashtra', 'application_number' => 'SAMAR-APP-J1', 'application_type' => 'new',
            'sector' => 'manufacturing', 'enterprise_classification' => 'micro', 'enterprise_name' => $org->name,
            'contact_person_name' => 'Jane Doe', 'contact_person_email' => 'jane@example.com',
            'gst_certificate_file' => 'applications/1/certs/gst.pdf', 'status' => 'payment_pending',
        ]);
        DB::table('applications')->where('id', $application->id)->update(['created_at' => now()->subDays(9)]);
        DB::table('application_status_histories')->insert([
            'application_id' => $application->id, 'from_status' => 'draft', 'to_status' => 'payment_pending',
            'changed_by' => $this->admin->id, 'changed_by_role' => Role::SYSTEM_ADMIN, 'remarks' => 'Documents verified',
            'changed_at' => now()->subDays(8),
        ]);
        $this->postJson("/api/v1/organizations/{$org->id}/deactivate", ['reason' => 'GST registration cancelled'], $this->headers())->assertOk();

        $response = $this->getJson("/api/v1/organizations/{$org->id}/journey", $this->headers())->assertOk();
        $events = collect($response->json('data.events'));

        $this->assertSame(
            ['enterprise_registered', 'application_started', 'application_status', 'enterprise_status'],
            $events->pluck('type')->reject(fn ($t) => $t === 'user_created')->values()->all(),
        );
        $status = $events->firstWhere('type', 'application_status');
        $this->assertSame('Documents verified', $status['reason']);
        $this->assertSame('SAMAR-APP-J1', $status['application']['applicationNumber']);
        $this->assertSame($this->admin->full_name, $status['actor']['name']);
        $this->assertSame('GST registration cancelled', $events->firstWhere('type', 'enterprise_status')['reason']);
        $this->assertSame('SAMAR-APP-J1', $response->json('data.applications.0.applicationNumber'));

        // Filtered to one application: only that application's steps.
        $filtered = $this->getJson("/api/v1/organizations/{$org->id}/journey?applicationId={$application->id}", $this->headers())
            ->assertOk()->json('data.events');
        $this->assertSame(['application_started', 'application_status'], array_column($filtered, 'type'));
    }

    public function test_enterprise_users_cannot_read_the_journey(): void
    {
        $org = Organization::factory()->create();
        $enterpriseAdmin = $this->userWithRole(Role::ENTERPRISE_ADMIN, ['organization_id' => $org->id]);

        $this->getJson("/api/v1/organizations/{$org->id}/journey", $this->headers($enterpriseAdmin))->assertForbidden();
    }
}
