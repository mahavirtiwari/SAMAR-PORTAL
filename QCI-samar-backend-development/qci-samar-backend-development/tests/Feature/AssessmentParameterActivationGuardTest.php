<?php

namespace Tests\Feature;

use App\Models\AssessmentParameter;
use App\Models\AssessmentQuestion;
use App\Models\Role;
use App\Models\User;
use App\Services\AssessmentParameterImportService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * A parameter is active only while its active questions total exactly 100%, on every
 * path: the question observer deactivates it the moment a question change breaks the
 * total, import and bulk update activate from the stored total, and the create endpoint
 * never births an active parameter. [BUG-09134]
 */
class AssessmentParameterActivationGuardTest extends TestCase
{
    use RefreshDatabase;

    private const IMPORT_HEADERS = [
        'Discipline', 'Parameter Name', 'Parameter Type', 'Question Category', 'Question Text',
        'Weightage (%)', 'Option 1 Text', 'Option 2 Text', 'Option 3 Text', 'Option 4 Text', 'Option 5 Text',
    ];

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);

        $this->admin = User::factory()->create();
        $role = Role::where('slug', Role::SYSTEM_ADMIN)->firstOrFail();
        $this->admin->roles()->attach($role->id, ['is_active' => true, 'assigned_at' => now()]);
        Auth::login($this->admin);
    }

    private function makeActiveParameter(array $weightages = [60, 40]): AssessmentParameter
    {
        $parameter = AssessmentParameter::create([
            'code' => 'MFG-T'.AssessmentParameter::count(),
            'name' => 'Information Security',
            'sector' => 'manufacturing',
            'enterprise_size' => 'large',
            'is_mandatory' => true,
            'is_active' => false,
        ]);

        foreach ($weightages as $index => $weightage) {
            AssessmentQuestion::create([
                'parameter_id' => $parameter->id,
                'code' => $parameter->code.'-Q0'.($index + 1),
                'question_text' => "Question {$index}?",
                'category' => 'planning',
                'weightage' => $weightage,
                'is_active' => true,
            ]);
        }

        $parameter->update(['is_active' => true]);

        return $parameter->fresh();
    }

    public function test_deactivating_a_question_deactivates_the_parameter_through_the_observer(): void
    {
        $parameter = $this->makeActiveParameter();

        $parameter->questions()->first()->update(['is_active' => false]);

        $this->assertFalse($parameter->fresh()->is_active);
    }

    public function test_deleting_a_question_deactivates_the_parameter_through_the_observer(): void
    {
        $parameter = $this->makeActiveParameter();

        // forceDelete rather than delete: assessment_questions has no deleted_by column,
        // so a soft delete under an authenticated user fails in TracksUserActions.
        $parameter->questions()->first()->forceDelete();

        $this->assertFalse($parameter->fresh()->is_active);
    }

    public function test_a_question_change_that_keeps_the_total_leaves_the_parameter_active(): void
    {
        $parameter = $this->makeActiveParameter();

        $parameter->questions()->first()->update(['question_text' => 'Reworded question?']);

        $this->assertTrue($parameter->fresh()->is_active);
    }

    public function test_question_deactivate_endpoint_reports_the_parameter_auto_deactivation(): void
    {
        $parameter = $this->makeActiveParameter();
        $question = $parameter->questions()->first();

        $response = $this->withHeader('Authorization', 'Bearer '.JWTAuth::fromUser($this->admin))
            ->postJson("/api/v1/assessment-questions/{$question->id}/deactivate");

        $response->assertOk();
        $this->assertStringContainsString('auto-deactivated', $response->json('message'));
        $this->assertFalse($parameter->fresh()->is_active);
    }

    public function test_a_valid_import_leaves_the_parameter_active(): void
    {
        $result = app(AssessmentParameterImportService::class)->import(
            $this->importSheet([['Deployment', 'First question?', 60], ['Monitoring', 'Second question?', 40]]),
            'manufacturing',
            ['large'],
            null,
            [1]
        );
        $this->assertTrue($result['success'], json_encode($result));
        $this->assertSame([], $result['data']['parameters']['inactive']);

        $parameter = AssessmentParameter::where('name', 'Information Security')->firstOrFail();

        $this->assertTrue($parameter->is_active);
        $this->assertSame(100, $parameter->getActiveQuestionsWeightage());
    }

    public function test_reimporting_over_an_active_parameter_keeps_it_active_with_the_new_questions(): void
    {
        $service = app(AssessmentParameterImportService::class);
        $service->import($this->importSheet([['Deployment', 'First question?', 60], ['Monitoring', 'Second question?', 40]]), 'manufacturing', ['large'], null, [1]);

        $result = $service->import($this->importSheet([['Deployment', 'Only question?', 100]]), 'manufacturing', ['large'], null, [1]);
        $this->assertTrue($result['success'], json_encode($result));

        $parameter = AssessmentParameter::where('name', 'Information Security')->firstOrFail();

        $this->assertTrue($parameter->is_active);
        $this->assertCount(1, $parameter->questions);
    }

    public function test_a_valid_bulk_update_leaves_the_parameter_active(): void
    {
        $parameter = $this->makeActiveParameter([60, 40]);
        [$first, $second] = $parameter->questions()->orderBy('id')->get();

        $result = app(AssessmentParameterImportService::class)->bulkUpdate(
            $this->bulkUpdateSheet($parameter, [
                [$first->code, 'First question reworded?', 70],
                [$second->code, 'Second question?', 30],
            ]),
            'manufacturing'
        );
        $this->assertTrue($result['success'], json_encode($result));
        $this->assertSame([], $result['data']['parameters']['inactive']);

        $parameter->refresh();
        $this->assertTrue($parameter->is_active);
        $this->assertSame(100, $parameter->getActiveQuestionsWeightage());
    }

    public function test_the_create_endpoint_never_creates_an_active_parameter(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer '.JWTAuth::fromUser($this->admin))
            ->postJson('/api/v1/assessment-parameters', [
                'name' => 'Born active',
                'sector' => 'manufacturing',
                'enterpriseSize' => 'large',
                'isMandatory' => true,
                'isActive' => true,
            ]);

        $response->assertCreated();
        $this->assertFalse(AssessmentParameter::where('name', 'Born active')->firstOrFail()->is_active);
    }

    /**
     * @param  array<int, array{0: string, 1: string, 2: int}>  $questions  [category, text, weightage]
     */
    private function importSheet(array $questions): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'import').'.csv';
        $handle = fopen($path, 'w');
        fputcsv($handle, self::IMPORT_HEADERS);

        foreach ($questions as $index => [$category, $questionText, $weightage]) {
            fputcsv($handle, [
                'Safety & Security', 'Information Security', 'Mandatory', $category, $questionText, $weightage,
                "Option A {$index}", "Option B {$index}", "Option C {$index}", "Option D {$index}", "Option E {$index}",
            ]);
        }

        fclose($handle);

        return new UploadedFile($path, 'questionnaire.csv', 'text/csv', null, true);
    }

    /**
     * @param  array<int, array{0: string, 1: string, 2: int}>  $questions  [question code, text, weightage]
     */
    private function bulkUpdateSheet(AssessmentParameter $parameter, array $questions): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'update').'.csv';
        $handle = fopen($path, 'w');
        fputcsv($handle, array_merge(['Parameter ID', 'Question ID'], self::IMPORT_HEADERS));

        foreach ($questions as $index => [$questionCode, $questionText, $weightage]) {
            fputcsv($handle, [
                $parameter->code, $questionCode,
                'Safety & Security', $parameter->name, 'Mandatory', 'Planning', $questionText, $weightage,
                "Option A {$index}", "Option B {$index}", "Option C {$index}", "Option D {$index}", "Option E {$index}",
            ]);
        }

        fclose($handle);

        return new UploadedFile($path, 'bulk-update.csv', 'text/csv', null, true);
    }
}
