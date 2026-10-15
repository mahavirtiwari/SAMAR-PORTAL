<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\ApplicationFeedback;
use App\Models\FeedbackQuestion;
use App\Models\Organization;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * Covers the feedback CSV exports (bulk wide-pivot + individual) and the 3-role
 * gating on the Feedback Application View + exports — Operations Manager /
 * Operations Admin / System Admin only, 403 for everyone else. [TASK-05938]
 */
class ApplicationFeedbackExportTest extends TestCase
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
        $user->roles()->attach($role->id, ['is_active' => true, 'assigned_at' => now()]);
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

    private function makeQuestion(string $text, int $order, string $type = ApplicationFeedback::TYPE_RATING): FeedbackQuestion
    {
        return FeedbackQuestion::create([
            'question_text' => $text,
            'type' => $type,
            'display_order' => $order,
            'is_active' => true,
        ]);
    }

    private function answer(Application $application, User $submitter, FeedbackQuestion $question, array $values = []): ApplicationFeedback
    {
        return ApplicationFeedback::create(array_merge([
            'application_id' => $application->id,
            'feedback_question_id' => $question->id,
            'question_text' => $question->question_text,
            'question_type' => $question->type,
            'rating' => null,
            'yes_no_answer' => null,
            'remarks' => null,
            'created_by' => $submitter->id,
        ], $values));
    }

    /** Parse streamed CSV content into a matrix, stripping the UTF-8 BOM. */
    private function csvRows($response): array
    {
        $content = ltrim($response->streamedContent(), "\xEF\xBB\xBF");
        $lines = array_filter(explode("\n", str_replace("\r", '', trim($content))), fn ($l) => $l !== '');

        return array_map(fn ($l) => str_getcsv($l, ',', '"', ''), array_values($lines));
    }

    // --- Bulk "all feedback" export -----------------------------------------

    public function test_bulk_export_returns_csv_for_system_admin(): void
    {
        $submitter = User::factory()->create(['samar_id' => 'SAMAR-SUB-001']);
        $app = $this->makeApplication(['application_number' => 'SAMAR-APP-001']);
        $this->answer($app, $submitter, $this->makeQuestion('Quality?', 1), ['rating' => 4]);

        $response = $this->withToken($this->adminToken(Role::SYSTEM_ADMIN))
            ->get('/api/v1/applications/feedback-submissions/export');

        $response->assertOk();
        $this->assertStringContainsString('text/csv', $response->headers->get('Content-Type'));

        $rows = $this->csvRows($response);
        $this->assertSame(['Application Number', 'Enterprise Name', 'Unit Name', 'SAMAR ID', 'Feedback Date', 'Quality?'], $rows[0]);
        $this->assertSame('SAMAR-APP-001', $rows[1][0]);
        $this->assertSame('SAMAR-SUB-001', $rows[1][3]);
        $this->assertSame('4/5', $rows[1][5]);
    }

    public function test_bulk_export_uses_dynamic_per_question_columns_with_blanks(): void
    {
        $submitter = User::factory()->create(['samar_id' => 'SAMAR-SUB-002']);
        $q1 = $this->makeQuestion('Quality?', 1);
        $q2 = $this->makeQuestion('Timeliness?', 2, ApplicationFeedback::TYPE_YES_NO);

        $appA = $this->makeApplication(['application_number' => 'SAMAR-APP-A']);
        $this->answer($appA, $submitter, $q1, ['rating' => 5]);

        $appB = $this->makeApplication(['application_number' => 'SAMAR-APP-B']);
        $this->answer($appB, $submitter, $q2, ['yes_no_answer' => true]);

        $response = $this->withToken($this->adminToken(Role::SYSTEM_ADMIN))
            ->get('/api/v1/applications/feedback-submissions/export');

        $response->assertOk();
        $rows = $this->csvRows($response);

        // Columns ordered by display_order: Quality? then Timeliness?
        $this->assertSame(['Application Number', 'Enterprise Name', 'Unit Name', 'SAMAR ID', 'Feedback Date', 'Quality?', 'Timeliness?'], $rows[0]);

        $byApp = [];
        foreach (array_slice($rows, 1) as $row) {
            $byApp[$row[0]] = $row;
        }

        // App A answered Quality only → Timeliness blank
        $this->assertSame('5/5', $byApp['SAMAR-APP-A'][5]);
        $this->assertSame('', $byApp['SAMAR-APP-A'][6]);

        // App B answered Timeliness only → Quality blank
        $this->assertSame('', $byApp['SAMAR-APP-B'][5]);
        $this->assertSame('Yes', $byApp['SAMAR-APP-B'][6]);
    }

    public function test_bulk_export_is_allowed_for_operations_manager(): void
    {
        $this->withToken($this->adminToken(Role::OPERATIONS_MANAGER))
            ->get('/api/v1/applications/feedback-submissions/export')
            ->assertOk();
    }

    public function test_bulk_export_is_allowed_for_operations_admin(): void
    {
        $this->withToken($this->adminToken(Role::OPERATIONS_ADMIN))
            ->get('/api/v1/applications/feedback-submissions/export')
            ->assertOk();
    }

    public function test_bulk_export_is_forbidden_for_enterprise_admin(): void
    {
        $this->withToken($this->adminToken(Role::ENTERPRISE_ADMIN))
            ->get('/api/v1/applications/feedback-submissions/export')
            ->assertStatus(403);
    }

    // --- Individual application export ---------------------------------------

    public function test_individual_export_returns_fixed_columns(): void
    {
        $submitter = User::factory()->create(['samar_id' => 'SAMAR-SUB-004']);
        $app = $this->makeApplication(['application_number' => 'SAMAR-APP-IND']);
        $this->answer($app, $submitter, $this->makeQuestion('Quality?', 1), ['rating' => 4, 'remarks' => 'Solid work']);
        $this->answer($app, $submitter, $this->makeQuestion('Recommend?', 2, ApplicationFeedback::TYPE_YES_NO), ['yes_no_answer' => false]);

        $response = $this->withToken($this->adminToken(Role::SYSTEM_ADMIN))
            ->get("/api/v1/applications/{$app->id}/feedbacks/export");

        $response->assertOk();
        $this->assertStringContainsString('text/csv', $response->headers->get('Content-Type'));

        $rows = $this->csvRows($response);
        $this->assertSame(['Question', 'Type', 'Answer', 'Remarks', 'Date'], $rows[0]);
        $this->assertSame(['Quality?', 'Rating', '4/5', 'Solid work'], array_slice($rows[1], 0, 4));
        $this->assertSame(['Recommend?', 'Yes/No', 'No', ''], array_slice($rows[2], 0, 4));
    }

    public function test_individual_export_is_forbidden_for_other_roles(): void
    {
        $app = $this->makeApplication();

        $this->withToken($this->adminToken(Role::ENTERPRISE_ADMIN))
            ->get("/api/v1/applications/{$app->id}/feedbacks/export")
            ->assertStatus(403);
    }

    public function test_individual_export_returns_404_for_missing_application(): void
    {
        $this->withToken($this->adminToken(Role::SYSTEM_ADMIN))
            ->get('/api/v1/applications/999999/feedbacks/export')
            ->assertStatus(404);
    }

    // --- Feedback Application View (index) gating ----------------------------

    // Kept as isolated single-request methods on purpose: the JWT api guard caches the
    // resolved user for the app instance, so mixing an allowed and a forbidden request in
    // one test method would leak the first user into later requests. One request per test.

    public function test_feedback_view_is_allowed_for_system_admin(): void
    {
        $app = $this->makeApplication();

        $this->withToken($this->adminToken(Role::SYSTEM_ADMIN))
            ->getJson("/api/v1/applications/{$app->id}/feedbacks")
            ->assertOk();
    }

    public function test_feedback_view_is_forbidden_for_enterprise_admin(): void
    {
        $app = $this->makeApplication();

        $this->withToken($this->adminToken(Role::ENTERPRISE_ADMIN))
            ->getJson("/api/v1/applications/{$app->id}/feedbacks")
            ->assertStatus(403);
    }

    public function test_feedback_view_is_forbidden_for_unit_admin(): void
    {
        $app = $this->makeApplication();

        $this->withToken($this->adminToken(Role::UNIT_ADMIN))
            ->getJson("/api/v1/applications/{$app->id}/feedbacks")
            ->assertStatus(403);
    }
}
