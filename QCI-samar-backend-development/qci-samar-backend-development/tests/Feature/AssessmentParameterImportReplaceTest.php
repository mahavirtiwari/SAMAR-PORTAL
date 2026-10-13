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
use Tests\TestCase;

/**
 * Covers the questionnaire import after the duplication fix: a re-import replaces a
 * parameter's questions instead of adding to them, comparison signs survive, and a
 * category cell carrying an invisible space is still accepted. [BUG-08638] [BUG-08639]
 * [BUG-08641]
 */
class AssessmentParameterImportReplaceTest extends TestCase
{
    use RefreshDatabase;

    private const HEADERS = [
        'Discipline', 'Parameter Name', 'Parameter Type', 'Question Category', 'Question Text',
        'Weightage (%)', 'Option 1 Text', 'Option 2 Text', 'Option 3 Text', 'Option 4 Text', 'Option 5 Text',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);

        $user = User::factory()->create();
        $role = Role::where('slug', 'system_admin')->firstOrFail();
        $user->roles()->attach($role->id, ['is_active' => true, 'assigned_at' => now()]);
        Auth::login($user);
    }

    /**
     * Build a CSV upload from rows of [category, questionText, weightage].
     */
    private function sheet(array $questions, string $parameterName = 'Information Security'): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'import').'.csv';
        $handle = fopen($path, 'w');
        fputcsv($handle, self::HEADERS);

        foreach ($questions as $index => [$category, $questionText, $weightage]) {
            fputcsv($handle, [
                'Safety & Security', $parameterName, 'Mandatory', $category, $questionText, $weightage,
                "Option A {$index}", "Option B {$index}", "Option C {$index}", "Option D {$index}", "Option E {$index}",
            ]);
        }

        fclose($handle);

        return new UploadedFile($path, 'questionnaire.csv', 'text/csv', null, true);
    }

    private function import(UploadedFile $file): array
    {
        return app(AssessmentParameterImportService::class)
            ->import($file, 'manufacturing', ['large'], null, [1]);
    }

    public function test_reimporting_an_edited_sheet_replaces_questions_instead_of_duplicating(): void
    {
        $first = $this->import($this->sheet([
            ['Deployment', 'Which statement describes the classification practice?', 50],
            ['Monitoring', 'Which statement describes the audit practice?', 50],
        ]));
        $this->assertTrue($first['success'], json_encode($first));

        // The same sheet with one question reworded — the case that used to duplicate.
        $second = $this->import($this->sheet([
            ['Deployment', 'Which statement describes the organisation classification practice?', 50],
            ['Monitoring', 'Which statement describes the audit practice?', 50],
        ]));
        $this->assertTrue($second['success'], json_encode($second));

        $parameter = AssessmentParameter::where('name', 'Information Security')->firstOrFail();
        $questions = AssessmentQuestion::where('parameter_id', $parameter->id)->get();

        $this->assertCount(2, $questions, 'the edited sheet must replace the question set, not add to it');
        $this->assertSame(100, (int) $questions->sum('weightage'), 'total weightage must stay at 100%');
        $this->assertEqualsCanonicalizing(
            [
                'Which statement describes the organisation classification practice?',
                'Which statement describes the audit practice?',
            ],
            $questions->pluck('question_text')->all()
        );
    }

    public function test_text_containing_comparison_signs_is_stored_intact(): void
    {
        $result = $this->import($this->sheet([
            ['Deployment', 'Is the score >= 90 and <95 for all units?', 100],
        ]));
        $this->assertTrue($result['success'], json_encode($result));

        $question = AssessmentQuestion::firstOrFail();

        $this->assertSame('Is the score >= 90 and <95 for all units?', $question->question_text);
    }

    public function test_a_category_cell_with_a_non_breaking_space_is_accepted(): void
    {
        // Excel and pasted content routinely carry this; PHP's trim() does not remove it.
        $result = $this->import($this->sheet([
            ["Monitoring\u{00A0}", 'Which statement describes the audit practice?', 100],
        ]));

        $this->assertTrue($result['success'], json_encode($result));
        $this->assertSame('monitoring', AssessmentQuestion::firstOrFail()->category);
    }

    public function test_an_unrecognised_category_names_the_offending_value(): void
    {
        $result = $this->import($this->sheet([
            ['Verification', 'Which statement describes the audit practice?', 100],
        ]));

        $this->assertFalse($result['success']);
        $this->assertStringContainsString("'Verification'", json_encode($result['data']['errors']));
    }

    public function test_a_question_longer_than_the_column_is_rejected_not_truncated(): void
    {
        // The storage columns are varchar(1000); the importer used to allow more than the
        // column and let the database silently cut the rest off.
        $result = $this->import($this->sheet([
            ['Deployment', str_repeat('a', 1001), 100],
        ]));

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('1001 characters', json_encode($result['data']['errors']));
        $this->assertSame(0, AssessmentQuestion::count());
    }

    public function test_every_imported_question_receives_a_question_code(): void
    {
        $this->import($this->sheet([
            ['Deployment', 'First question?', 60],
            ['Monitoring', 'Second question?', 40],
        ]));

        $parameter = AssessmentParameter::where('name', 'Information Security')->firstOrFail();
        $codes = AssessmentQuestion::where('parameter_id', $parameter->id)->pluck('code')->all();

        $this->assertEqualsCanonicalizing([$parameter->code.'-Q01', $parameter->code.'-Q02'], $codes);
    }
}
