<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Assessment;
use App\Models\AssessmentTeamMember;
use App\Models\Organization;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * Covers the assessment CSV export: it now serves every Manage Assessments stage
 * rather than certified only, shares the list's filters, and is restricted to the
 * five operations/admin roles. [TASK-07970]
 */
class AssessmentExportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function assignRole(User $user, string $slug): void
    {
        $role = Role::where('slug', $slug)->firstOrFail();
        $user->roles()->attach($role->id, ['is_active' => true, 'assigned_at' => now()]);
    }

    private function tokenForRole(string $slug): string
    {
        $user = User::factory()->create();
        $this->assignRole($user, $slug);

        return JWTAuth::fromUser($user);
    }

    private function makeAssessment(string $status, array $applicationOverrides = []): Assessment
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

        $application = Application::create(array_merge([
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
            'status' => 'in_progress',
            'payment_status' => 'success',
            'payment_amount' => 25000,
        ], $applicationOverrides));

        return Assessment::create([
            'application_id' => $application->id,
            'organization_id' => $org->id,
            'unit_id' => $unit->id,
            'status' => $status,
        ]);
    }

    /** Parse streamed CSV content into a matrix, stripping the UTF-8 BOM. */
    private function csvRows($response): array
    {
        $content = ltrim($response->streamedContent(), "\xEF\xBB\xBF");
        $lines = array_filter(explode("\n", str_replace("\r", '', trim($content))), fn ($l) => $l !== '');

        return array_map(fn ($l) => str_getcsv($l, ',', '"', ''), array_values($lines));
    }

    private function applicationNumbersIn($response): array
    {
        $rows = $this->csvRows($response);

        return array_map(fn ($row) => $row[0], array_slice($rows, 1));
    }

    // --- Shape ---------------------------------------------------------------

    public function test_export_returns_csv_with_status_column(): void
    {
        $this->makeAssessment(Assessment::STATUS_IN_PROGRESS, ['application_number' => 'SAMAR-APP-SHAPE']);

        $response = $this->withToken($this->tokenForRole(Role::SYSTEM_ADMIN))
            ->get('/api/v1/assessments/export');

        $response->assertOk();
        $this->assertStringContainsString('text/csv', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('assessments_export_', $response->headers->get('Content-Disposition'));

        $rows = $this->csvRows($response);
        $this->assertSame('Application Number', $rows[0][0]);
        $this->assertSame('Status', $rows[0][1]);
        $this->assertContains('Unit Name', $rows[0]);
        $this->assertSame('SAMAR-APP-SHAPE', $rows[1][0]);
        $this->assertSame(Assessment::STATUS_IN_PROGRESS, $rows[1][1]);
    }

    // --- Stage coverage ------------------------------------------------------

    public function test_export_without_status_covers_every_stage(): void
    {
        $this->makeAssessment(Assessment::STATUS_SCHEDULED, ['application_number' => 'SAMAR-APP-SCHED']);
        $this->makeAssessment(Assessment::STATUS_CERTIFIED, ['application_number' => 'SAMAR-APP-CERT']);

        $response = $this->withToken($this->tokenForRole(Role::SYSTEM_ADMIN))
            ->get('/api/v1/assessments/export');

        $response->assertOk();
        $numbers = $this->applicationNumbersIn($response);
        $this->assertContains('SAMAR-APP-SCHED', $numbers);
        $this->assertContains('SAMAR-APP-CERT', $numbers);
    }

    public function test_export_honours_the_status_filter(): void
    {
        $this->makeAssessment(Assessment::STATUS_SCHEDULED, ['application_number' => 'SAMAR-APP-ONLY-SCHED']);
        $this->makeAssessment(Assessment::STATUS_CERTIFIED, ['application_number' => 'SAMAR-APP-ONLY-CERT']);

        $response = $this->withToken($this->tokenForRole(Role::SYSTEM_ADMIN))
            ->get('/api/v1/assessments/export?status='.Assessment::STATUS_SCHEDULED);

        $response->assertOk();
        $numbers = $this->applicationNumbersIn($response);
        $this->assertSame(['SAMAR-APP-ONLY-SCHED'], $numbers);
    }

    public function test_export_honours_the_search_filter(): void
    {
        $this->makeAssessment(Assessment::STATUS_SCHEDULED, ['application_number' => 'SAMAR-APP-FINDME']);
        $this->makeAssessment(Assessment::STATUS_SCHEDULED, ['application_number' => 'SAMAR-APP-OTHER']);

        $response = $this->withToken($this->tokenForRole(Role::SYSTEM_ADMIN))
            ->get('/api/v1/assessments/export?search=FINDME');

        $response->assertOk();
        $this->assertSame(['SAMAR-APP-FINDME'], $this->applicationNumbersIn($response));
    }

    // --- Assessor filters ----------------------------------------------------

    /**
     * Lead and co-assessor used to share one query parameter, so narrowing by both
     * silently dropped the lead. They are separate filters and must combine. [TASK-07970]
     */
    public function test_lead_and_co_assessor_filters_combine(): void
    {
        $lead = User::factory()->create();
        $co = User::factory()->create();
        $otherLead = User::factory()->create();

        $match = $this->makeAssessment(Assessment::STATUS_SCHEDULED, ['application_number' => 'SAMAR-APP-PAIR']);
        $match->addTeamMember($lead->id, AssessmentTeamMember::ROLE_LEAD_ASSESSOR);
        $match->addTeamMember($co->id, AssessmentTeamMember::ROLE_CO_ASSESSOR);

        // Same co-assessor, different lead — must be excluded when both filters are set.
        $wrongLead = $this->makeAssessment(Assessment::STATUS_SCHEDULED, ['application_number' => 'SAMAR-APP-WRONG-LEAD']);
        $wrongLead->addTeamMember($otherLead->id, AssessmentTeamMember::ROLE_LEAD_ASSESSOR);
        $wrongLead->addTeamMember($co->id, AssessmentTeamMember::ROLE_CO_ASSESSOR);

        $response = $this->withToken($this->tokenForRole(Role::SYSTEM_ADMIN))
            ->get("/api/v1/assessments/export?leadAssessorId={$lead->id}&coAssessorId={$co->id}");

        $response->assertOk();
        $this->assertSame(['SAMAR-APP-PAIR'], $this->applicationNumbersIn($response));
    }

    public function test_lead_assessor_filter_ignores_co_assessor_membership(): void
    {
        $person = User::factory()->create();

        $leads = $this->makeAssessment(Assessment::STATUS_SCHEDULED, ['application_number' => 'SAMAR-APP-LEADS']);
        $leads->addTeamMember($person->id, AssessmentTeamMember::ROLE_LEAD_ASSESSOR);

        $assists = $this->makeAssessment(Assessment::STATUS_SCHEDULED, ['application_number' => 'SAMAR-APP-ASSISTS']);
        $assists->addTeamMember($person->id, AssessmentTeamMember::ROLE_CO_ASSESSOR);

        $response = $this->withToken($this->tokenForRole(Role::SYSTEM_ADMIN))
            ->get("/api/v1/assessments/export?leadAssessorId={$person->id}");

        $response->assertOk();
        $this->assertSame(['SAMAR-APP-LEADS'], $this->applicationNumbersIn($response));
    }

    // --- Role scoping --------------------------------------------------------

    // One request per test: the JWT api guard caches the resolved user for the app
    // instance, so mixing two identities in one method leaks the first into the second.

    public function test_export_is_allowed_for_operations_manager(): void
    {
        $this->withToken($this->tokenForRole(Role::OPERATIONS_MANAGER))
            ->get('/api/v1/assessments/export')
            ->assertOk();
    }

    public function test_export_is_allowed_for_operations_admin(): void
    {
        $this->withToken($this->tokenForRole(Role::OPERATIONS_ADMIN))
            ->get('/api/v1/assessments/export')
            ->assertOk();
    }

    public function test_export_is_allowed_for_drdo_admin(): void
    {
        $this->withToken($this->tokenForRole(Role::DRDO_ADMIN))
            ->get('/api/v1/assessments/export')
            ->assertOk();
    }

    public function test_export_is_forbidden_for_assessor(): void
    {
        $this->withToken($this->tokenForRole(Role::ASSESSOR))
            ->get('/api/v1/assessments/export')
            ->assertStatus(403);
    }

    public function test_export_is_forbidden_for_enterprise_admin(): void
    {
        $this->withToken($this->tokenForRole(Role::ENTERPRISE_ADMIN))
            ->get('/api/v1/assessments/export')
            ->assertStatus(403);
    }

    public function test_export_is_forbidden_for_unit_admin(): void
    {
        $this->withToken($this->tokenForRole(Role::UNIT_ADMIN))
            ->get('/api/v1/assessments/export')
            ->assertStatus(403);
    }

    /**
     * DRDO Lab may reach the endpoint but only ever sees certified rows. Before the
     * shared query builder its scoping relied on a hard-coded certified filter, so
     * asking for another stage must still return nothing.
     */
    public function test_drdo_lab_cannot_export_non_certified_stages(): void
    {
        $this->makeAssessment(Assessment::STATUS_IN_PROGRESS, ['application_number' => 'SAMAR-APP-LAB-WIP']);
        $this->makeAssessment(Assessment::STATUS_CERTIFIED, ['application_number' => 'SAMAR-APP-LAB-CERT']);

        $response = $this->withToken($this->tokenForRole(Role::DRDO_LAB))
            ->get('/api/v1/assessments/export?status='.Assessment::STATUS_IN_PROGRESS);

        $response->assertOk();
        $this->assertSame([], $this->applicationNumbersIn($response));
    }

    public function test_export_requires_authentication(): void
    {
        $this->get('/api/v1/assessments/export')->assertStatus(401);
    }
}
