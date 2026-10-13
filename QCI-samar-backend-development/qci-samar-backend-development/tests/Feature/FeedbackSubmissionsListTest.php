<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\ApplicationFeedback;
use App\Models\Organization;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * Covers GET /api/v1/applications/feedback-submissions — the admin listing of
 * applications with submitted applicant feedback, for Operations Manager /
 * Operations Admin / System Admin. [TASK-05774]
 */
class FeedbackSubmissionsListTest extends TestCase
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

    private function assignRole(User $user, string $slug): void
    {
        $role = Role::where('slug', $slug)->firstOrFail();
        $user->roles()->attach($role->id, [
            'is_active' => true,
            'assigned_at' => now(),
        ]);
    }

    private function adminToken(string $slug): string
    {
        $admin = User::factory()->create();
        $this->assignRole($admin, $slug);

        return $this->tokenFor($admin);
    }

    private function makeApplication(array $overrides = []): Application
    {
        $org = Organization::factory()->create();
        $unit = Unit::create([
            'organization_id' => $org->id,
            'name' => 'Test Unit',
            'address' => 'Plot 1, Industrial Area',
            'state' => 'Haryana',
            'district' => 'Gurugram',
            'pincode' => '122016',
            'unit_type' => 'manufacturing',
            'status' => 'active',
        ]);

        return Application::create(array_merge([
            'organization_id' => $org->id,
            'organization_name' => $org->name ?? 'Org',
            'unit_id' => $unit->id,
            'unit_name' => $unit->name,
            'application_number' => 'SAMAR-APP-'.uniqid(),
            'application_type' => 'new',
            'sector' => 'manufacturing',
            'enterprise_name' => 'Acme Defense',
            'contact_person_name' => 'Jane Doe',
            'contact_person_email' => 'jane@example.com',
            'gst_certificate_file' => 'applications/1/certs/gst.pdf',
            'status' => 'certified',
            'payment_status' => 'success',
            'payment_amount' => 25000,
        ], $overrides));
    }

    /** Attach a submitted feedback answer authored by $submitter to $application. */
    private function submitFeedback(Application $application, User $submitter): void
    {
        ApplicationFeedback::create([
            'application_id' => $application->id,
            'feedback_question_id' => 1,
            'question_text' => 'How satisfied are you with the assessment?',
            'question_type' => ApplicationFeedback::TYPE_RATING,
            'rating' => 4,
            'created_by' => $submitter->id,
        ]);
    }

    /**
     * Pull the application numbers out of the listing response.
     * Response keys are camelCase — ConvertResponseToCamelCase rewrites every response.
     */
    private function applicationNumbers($response): array
    {
        return array_map(
            fn ($row) => $row['applicationNumber'] ?? null,
            $response->json('data')
        );
    }

    public function test_system_admin_sees_applications_with_submitted_feedback(): void
    {
        $submitter = User::factory()->create(['samar_id' => 'SAMAR-SUB-001']);
        $application = $this->makeApplication(['application_number' => 'SAMAR-APP-001']);
        $this->submitFeedback($application, $submitter);

        $response = $this->withToken($this->adminToken(Role::SYSTEM_ADMIN))
            ->getJson('/api/v1/applications/feedback-submissions');

        $response->assertOk();
        $response->assertJsonPath('data.0.applicationNumber', 'SAMAR-APP-001');
        $response->assertJsonPath('data.0.userSamarId', 'SAMAR-SUB-001');
        $response->assertJsonPath('data.0.feedbackDate', now()->format('Y-m-d'));
    }

    public function test_operations_manager_and_operations_admin_are_allowed(): void
    {
        $submitter = User::factory()->create(['samar_id' => 'SAMAR-SUB-002']);
        $application = $this->makeApplication();
        $this->submitFeedback($application, $submitter);

        foreach ([Role::OPERATIONS_MANAGER, Role::OPERATIONS_ADMIN] as $slug) {
            $response = $this->withToken($this->adminToken($slug))
                ->getJson('/api/v1/applications/feedback-submissions');
            $response->assertOk();
            $this->assertCount(1, $response->json('data'));
        }
    }

    public function test_applications_without_feedback_are_excluded(): void
    {
        $submitter = User::factory()->create(['samar_id' => 'SAMAR-SUB-003']);
        $withFeedback = $this->makeApplication(['application_number' => 'SAMAR-HAS-FB']);
        $this->submitFeedback($withFeedback, $submitter);
        $this->makeApplication(['application_number' => 'SAMAR-NO-FB']);

        $response = $this->withToken($this->adminToken(Role::SYSTEM_ADMIN))
            ->getJson('/api/v1/applications/feedback-submissions');

        $response->assertOk();
        $this->assertSame(['SAMAR-HAS-FB'], $this->applicationNumbers($response));
    }

    public function test_application_number_filter_is_a_partial_match(): void
    {
        $submitter = User::factory()->create(['samar_id' => 'SAMAR-SUB-004']);
        $this->submitFeedback($this->makeApplication(['application_number' => 'SAMAR-ALPHA-1']), $submitter);
        $this->submitFeedback($this->makeApplication(['application_number' => 'SAMAR-BETA-2']), $submitter);

        $response = $this->withToken($this->adminToken(Role::SYSTEM_ADMIN))
            ->getJson('/api/v1/applications/feedback-submissions?q=ALPHA');

        $response->assertOk();
        $this->assertSame(['SAMAR-ALPHA-1'], $this->applicationNumbers($response));
    }

    public function test_samar_id_filter_matches_the_submitter(): void
    {
        $alice = User::factory()->create(['samar_id' => 'SAMAR-ALICE-1']);
        $bob = User::factory()->create(['samar_id' => 'SAMAR-BOB-2']);
        $this->submitFeedback($this->makeApplication(['application_number' => 'SAMAR-BY-ALICE']), $alice);
        $this->submitFeedback($this->makeApplication(['application_number' => 'SAMAR-BY-BOB']), $bob);

        $response = $this->withToken($this->adminToken(Role::SYSTEM_ADMIN))
            ->getJson('/api/v1/applications/feedback-submissions?samarId=ALICE');

        $response->assertOk();
        $this->assertSame(['SAMAR-BY-ALICE'], $this->applicationNumbers($response));
    }

    public function test_enterprise_admin_is_forbidden(): void
    {
        $response = $this->withToken($this->adminToken(Role::ENTERPRISE_ADMIN))
            ->getJson('/api/v1/applications/feedback-submissions');

        $response->assertStatus(403);
    }
}
