<?php

namespace Tests\Feature;

use App\Exceptions\BusinessException;
use App\Models\Application;
use App\Models\ApplicationAssessmentParameter;
use App\Models\ApplicationAssessmentQuestion;
use App\Models\Assessment;
use App\Models\AssessmentTeamMember;
use App\Models\Organization;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * A parameter that is mandatory, assigned, or started must be fully answered before the
 * assessment can move on, and a parameter's score is a number only once it is fully
 * answered. [BUG-09133]
 */
class IncompleteParameterSubmissionTest extends TestCase
{
    use RefreshDatabase;

    private Assessment $assessment;

    private User $lead;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);

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
        $application = Application::create([
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
            'status' => 'in_progress',
            'payment_status' => 'success',
            'payment_amount' => 25000,
        ]);

        $assessment = new Assessment;
        $assessment->forceFill([
            'application_id' => $application->id,
            'organization_id' => $org->id,
            'unit_id' => $unit->id,
            'status' => Assessment::STATUS_MOBILE_COMPLETE,
        ])->save();
        $this->assessment = $assessment;

        $this->lead = User::factory()->create();
        $role = Role::where('slug', Role::ASSESSOR)->firstOrFail();
        $this->lead->roles()->attach($role->id, ['is_active' => true, 'assigned_at' => now()]);

        $assessment->teamMembers()->create([
            'user_id' => $this->lead->id,
            'role' => AssessmentTeamMember::ROLE_LEAD_ASSESSOR,
            'mobile_completed_at' => now(),
        ]);

        // submitForQC() binds the state machine to the signed-in user for its guards.
        Auth::login($this->lead);
    }

    /**
     * @return array{0: ApplicationAssessmentParameter, 1: array<int, ApplicationAssessmentQuestion>}
     */
    private function makeParameter(string $code, bool $mandatory, array $weightages): array
    {
        $parameter = ApplicationAssessmentParameter::create([
            'assessment_id' => $this->assessment->id,
            'discipline_name' => 'Safety & Security',
            'code' => $code,
            'name' => 'Information Security',
            'is_mandatory' => $mandatory,
        ]);

        $questions = [];
        foreach ($weightages as $index => $weightage) {
            $questions[] = ApplicationAssessmentQuestion::create([
                'assessment_id' => $this->assessment->id,
                'parameter_id' => $parameter->id,
                'code' => "{$code}-Q0".($index + 1),
                'question_text' => "Question {$index}?",
                'category' => 'planning',
                'weightage' => $weightage,
                'option_1_text' => 'A', 'option_1_score' => 1,
                'option_2_text' => 'B', 'option_2_score' => 2,
                'option_3_text' => 'C', 'option_3_score' => 3,
                'option_4_text' => 'D', 'option_4_score' => 4,
                'option_5_text' => 'E', 'option_5_score' => 5,
            ]);
        }

        return [$parameter, $questions];
    }

    private function answer(ApplicationAssessmentQuestion $question, int $option): void
    {
        $this->assessment->responses()->create([
            'question_id' => $question->id,
            'selected_option' => $option,
            'selected_score' => $option,
            'weighted_score' => $option * ($question->weightage / 100),
            'assessed_by' => $this->lead->id,
            'assessed_at' => now(),
        ]);
    }

    public function test_a_started_unassigned_optional_parameter_blocks_submission_and_is_named(): void
    {
        [, $mandatory] = $this->makeParameter('MFG-001', true, [100]);
        [, $optional] = $this->makeParameter('MFG-002', false, [50, 50]);
        $this->answer($mandatory[0], 5);
        $this->answer($optional[0], 5);

        $incomplete = $this->assessment->incompleteParameters();
        $this->assertCount(1, $incomplete);
        $this->assertSame(['code' => 'MFG-002', 'name' => 'Information Security', 'answered' => 1, 'total' => 2], $incomplete->first());

        $this->assertFalse($this->assessment->canSubmitForQC()['can_submit']);

        $this->expectException(BusinessException::class);
        $this->expectExceptionMessage('MFG-002 Information Security has 1 of 2 questions answered');
        $this->assessment->submitForQC();
    }

    public function test_an_untouched_optional_parameter_does_not_block_submission(): void
    {
        [, $mandatory] = $this->makeParameter('MFG-001', true, [100]);
        $this->makeParameter('MFG-002', false, [50, 50]);
        $this->answer($mandatory[0], 5);

        $this->assertTrue($this->assessment->incompleteParameters()->isEmpty());
        $this->assertTrue($this->assessment->canSubmitForQC()['can_submit'], json_encode($this->assessment->canSubmitForQC()));
        $this->assertTrue($this->assessment->submitForQC());
        $this->assertSame(Assessment::STATUS_SUBMITTED_FOR_QC, $this->assessment->fresh()->status);
    }

    public function test_the_state_machine_guard_names_the_incomplete_parameter(): void
    {
        [, $mandatory] = $this->makeParameter('MFG-001', true, [60, 40]);
        $this->answer($mandatory[0], 3);

        $reason = $this->assessment->stateMachine($this->lead)->getTransitionBlockedReason('submit_for_qc');

        $this->assertStringContainsString('MFG-001 Information Security has 1 of 2 questions answered', (string) $reason);
    }

    public function test_parameter_scores_are_null_until_every_question_is_answered(): void
    {
        [, $complete] = $this->makeParameter('MFG-001', true, [60, 40]);
        [, $partial] = $this->makeParameter('MFG-002', false, [50, 50]);
        $this->makeParameter('MFG-003', false, [100]);
        $this->answer($complete[0], 5);
        $this->answer($complete[1], 5);
        $this->answer($partial[0], 5);

        $response = $this->withHeader('Authorization', 'Bearer '.JWTAuth::fromUser($this->lead))
            ->getJson("/api/v1/application-assessments/{$this->assessment->id}/responses");

        $response->assertOk();
        $parameters = collect($response->json('data.parameters'))->keyBy('code');

        $this->assertSame(5.0, (float) $parameters['MFG-001']['score']);
        $this->assertSame(5.0, (float) $parameters['MFG-001']['rcScore']);
        $this->assertSame(2, $parameters['MFG-001']['completedQuestions']);

        $this->assertNull($parameters['MFG-002']['score'], 'a half-answered parameter must not show a deflated score');
        $this->assertNull($parameters['MFG-002']['rcScore']);
        $this->assertSame(1, $parameters['MFG-002']['completedQuestions']);

        $this->assertNull($parameters['MFG-003']['score'], 'an untouched parameter must not show 0.00');
        $this->assertNull($parameters['MFG-003']['rcScore']);
    }
}
