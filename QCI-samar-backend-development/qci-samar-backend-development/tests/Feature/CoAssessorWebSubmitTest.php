<?php

namespace Tests\Feature;

use App\Exceptions\BusinessException;
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
 * TASK-04614 — per-co-assessor web-submit gate. A co-assessor signs off on the
 * web once the assessment is mobile_complete; the lead's "Submit for QC" stays
 * blocked until every co-assessor has web-submitted.
 */
class CoAssessorWebSubmitTest extends TestCase
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

    private function assignAssessor(User $user): void
    {
        $role = Role::where('slug', Role::ASSESSOR)->firstOrFail();
        $user->roles()->attach($role->id, [
            'organization_id' => null,
            'unit_id' => null,
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

    private function makeApplication(Organization $org, Unit $unit): Application
    {
        return Application::create([
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
            'payment_status' => 'success',
            'payment_amount' => 25000,
        ]);
    }

    /**
     * Build a mobile_complete assessment with one lead + one co-assessor, both
     * marked mobile-complete. Returns [assessment, lead, coMember, coUser].
     *
     * @return array{0: Assessment, 1: AssessmentTeamMember, 2: AssessmentTeamMember, 3: User}
     */
    private function makeMobileCompleteAssessment(string $status = Assessment::STATUS_MOBILE_COMPLETE): array
    {
        $org = Organization::factory()->create();
        $unit = $this->makeUnit($org);
        $application = $this->makeApplication($org, $unit);

        $assessment = new Assessment;
        $assessment->forceFill([
            'application_id' => $application->id,
            'organization_id' => $org->id,
            'unit_id' => $unit->id,
            'status' => $status,
        ])->save();

        $leadUser = User::factory()->create();
        $coUser = User::factory()->create();
        $this->assignAssessor($leadUser);
        $this->assignAssessor($coUser);

        $lead = $assessment->teamMembers()->create([
            'user_id' => $leadUser->id,
            'role' => AssessmentTeamMember::ROLE_LEAD_ASSESSOR,
            'mobile_completed_at' => now(),
        ]);
        $coMember = $assessment->teamMembers()->create([
            'user_id' => $coUser->id,
            'role' => AssessmentTeamMember::ROLE_CO_ASSESSOR,
            'mobile_completed_at' => now(),
        ]);

        return [$assessment->fresh(), $lead, $coMember, $coUser];
    }

    public function test_co_assessor_can_submit_after_mobile_complete(): void
    {
        [$assessment, , , $coUser] = $this->makeMobileCompleteAssessment();

        $response = $this->withToken($this->tokenFor($coUser))
            ->postJson("/api/v1/assessments/{$assessment->id}/co-assessor-submit");

        $response->assertStatus(200);
        $this->assertDatabaseHas('application_assessment_team_members', [
            'assessment_id' => $assessment->id,
            'user_id' => $coUser->id,
            'role' => AssessmentTeamMember::ROLE_CO_ASSESSOR,
        ]);
        $this->assertNotNull($assessment->fresh()->areAllCoAssessorsWebSubmitted());
        $this->assertTrue($assessment->fresh()->areAllCoAssessorsWebSubmitted());
    }

    public function test_lead_assessor_cannot_web_submit(): void
    {
        [$assessment, $lead] = $this->makeMobileCompleteAssessment();

        $response = $this->withToken($this->tokenFor($lead->user))
            ->postJson("/api/v1/assessments/{$assessment->id}/co-assessor-submit");

        $response->assertStatus(403);
    }

    public function test_non_team_member_gets_403(): void
    {
        [$assessment] = $this->makeMobileCompleteAssessment();

        $stranger = User::factory()->create();
        $this->assignAssessor($stranger);

        $response = $this->withToken($this->tokenFor($stranger))
            ->postJson("/api/v1/assessments/{$assessment->id}/co-assessor-submit");

        $response->assertStatus(403);
    }

    public function test_submit_before_mobile_complete_is_400(): void
    {
        [$assessment, , , $coUser] = $this->makeMobileCompleteAssessment(Assessment::STATUS_IN_PROGRESS);

        $response = $this->withToken($this->tokenFor($coUser))
            ->postJson("/api/v1/assessments/{$assessment->id}/co-assessor-submit");

        $response->assertStatus(400);
    }

    public function test_double_submit_is_idempotent(): void
    {
        [$assessment, , , $coUser] = $this->makeMobileCompleteAssessment();

        $first = $this->withToken($this->tokenFor($coUser))
            ->postJson("/api/v1/assessments/{$assessment->id}/co-assessor-submit");
        $firstStamp = $assessment->fresh()->teamMembers()
            ->where('user_id', $coUser->id)->first()->web_submitted_at;

        $second = $this->withToken($this->tokenFor($coUser))
            ->postJson("/api/v1/assessments/{$assessment->id}/co-assessor-submit");
        $secondStamp = $assessment->fresh()->teamMembers()
            ->where('user_id', $coUser->id)->first()->web_submitted_at;

        $first->assertStatus(200);
        $second->assertStatus(200);
        $this->assertEquals($firstStamp, $secondStamp);
    }

    public function test_submit_for_qc_blocked_until_all_co_assessors_web_submitted(): void
    {
        [$assessment, , $coMember] = $this->makeMobileCompleteAssessment();

        $this->assertFalse($assessment->fresh()->areAllCoAssessorsWebSubmitted());

        $this->expectException(BusinessException::class);
        $this->expectExceptionMessage('All co-assessors must submit on web');
        $assessment->fresh()->submitForQC();
    }

    public function test_gate_opens_after_co_assessor_web_submits(): void
    {
        [$assessment, , $coMember] = $this->makeMobileCompleteAssessment();

        $assessment->markMemberWebSubmitted($coMember);

        $fresh = $assessment->fresh();
        $this->assertTrue($fresh->areAllCoAssessorsWebSubmitted());
        $webError = collect($fresh->canSubmitForQC()['errors'])
            ->contains(fn ($e) => str_contains($e, 'submit on web'));
        $this->assertFalse($webError);
    }

    public function test_lead_only_assessment_is_not_blocked(): void
    {
        [$assessment, $lead, $coMember, $coUser] = $this->makeMobileCompleteAssessment();
        // Remove the co-assessor so only the lead remains.
        $coMember->delete();

        $this->assertTrue($assessment->fresh()->areAllCoAssessorsWebSubmitted());
    }
}
