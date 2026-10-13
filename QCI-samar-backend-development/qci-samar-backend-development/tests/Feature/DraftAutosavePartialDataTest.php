<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Organization;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * The per-field autosave sends whatever the applicant has typed so far. A draft save
 * must therefore accept an unanswered NOT NULL question and a half-typed contact
 * block instead of failing with a database error. [BUG-09788]
 */
class DraftAutosavePartialDataTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function applicantFor(Organization $org): string
    {
        $user = User::factory()->create(['organization_id' => $org->id, 'status' => 'active']);
        $role = Role::where('slug', Role::ENTERPRISE_ADMIN)->firstOrFail();
        $user->roles()->attach($role->id, [
            'organization_id' => $org->id,
            'unit_id' => null,
            'is_active' => true,
            'assigned_at' => now(),
        ]);

        return JWTAuth::fromUser($user);
    }

    private function saveDraft(string $token, array $overrides = []): TestResponse
    {
        return $this->withToken($token)->postJson('/api/v1/applications/manufacturing/draft', array_merge([
            'unitName' => 'Autosave Unit',
            'unitAddress' => 'Plot 9, Industrial Area',
            'unitState' => 'Haryana',
            'unitDistrict' => 'Gurugram',
            'unitPincode' => '122016',
        ], $overrides));
    }

    public function test_unanswered_boolean_saves_with_the_default(): void
    {
        $token = $this->applicantFor(Organization::factory()->create());

        $response = $this->saveDraft($token, ['isExistingDrdoVendor' => '']);

        $response->assertCreated();
        $this->assertFalse(Application::firstOrFail()->is_existing_drdo_vendor);
    }

    public function test_unanswered_boolean_on_update_keeps_the_stored_answer(): void
    {
        $token = $this->applicantFor(Organization::factory()->create());
        $created = $this->saveDraft($token, ['isExistingDrdoVendor' => true]);
        $created->assertCreated();
        $id = Application::firstOrFail()->id;

        $this->saveDraft($token, ['applicationId' => $id, 'isExistingDrdoVendor' => ''])->assertOk();

        $this->assertTrue(Application::findOrFail($id)->is_existing_drdo_vendor);
    }

    public function test_contact_email_without_mobile_saves_and_defers_the_login(): void
    {
        $token = $this->applicantFor(Organization::factory()->create());

        $response = $this->saveDraft($token, [
            'contactPersonName' => 'Ravi Kumar',
            'contactPersonEmail' => 'ravi@example.com',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('applications', ['contact_person_email' => 'ravi@example.com']);
        $this->assertDatabaseMissing('users', ['email' => 'ravi@example.com']);
    }

    public function test_contact_block_completed_on_a_later_save_creates_the_login(): void
    {
        $token = $this->applicantFor(Organization::factory()->create());
        $this->saveDraft($token, ['contactPersonEmail' => 'ravi@example.com'])->assertCreated();
        $id = Application::firstOrFail()->id;

        $this->saveDraft($token, [
            'applicationId' => $id,
            'contactPersonName' => 'Ravi Kumar',
            'contactPersonEmail' => 'ravi@example.com',
            'contactPersonMobile' => '9876543210',
        ])->assertOk();

        $this->assertDatabaseHas('users', ['email' => 'ravi@example.com', 'mobile_number' => '9876543210']);
    }
}
