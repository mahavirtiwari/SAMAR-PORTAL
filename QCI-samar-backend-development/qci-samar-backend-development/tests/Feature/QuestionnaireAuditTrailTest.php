<?php

namespace Tests\Feature;

use App\Models\AssessmentParameter;
use App\Models\AssessmentQuestion;
use App\Models\AuditLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Questionnaires decide certification outcomes, so a change to one has to leave a record
 * of who made it and when. Neither assessment questions nor their parameters were
 * audited, which is why the deletion behind BUG-08963 had to be inferred from gaps in the
 * question numbering rather than read from a log. [BUG-08975]
 */
class QuestionnaireAuditTrailTest extends TestCase
{
    use RefreshDatabase;

    private int $sequence = 0;

    private function makeParameter(): AssessmentParameter
    {
        // The code column holds 20 characters, so keep the fixture short.
        $this->sequence++;

        return AssessmentParameter::create([
            'code' => 'MFG-T'.$this->sequence,
            'name' => 'Organisation and leadership mindset',
            'sector' => 'manufacturing',
            'enterprise_size' => 'large',
            'is_active' => true,
            'is_mandatory' => true,
        ]);
    }

    private function makeQuestion(AssessmentParameter $parameter): AssessmentQuestion
    {
        return AssessmentQuestion::create([
            'parameter_id' => $parameter->id,
            'code' => $parameter->code.'-Q01',
            'question_text' => 'Which statement best describes the organisation?',
            'category' => 'Planning',
            'weightage' => 100,
            'is_active' => true,
        ]);
    }

    private function auditRowsFor(string $class, int $id)
    {
        return AuditLog::where('auditable_type', $class)->where('auditable_id', $id)->get();
    }

    public function test_creating_a_question_is_recorded(): void
    {
        $question = $this->makeQuestion($this->makeParameter());

        $events = $this->auditRowsFor(AssessmentQuestion::class, $question->id)->pluck('event');

        $this->assertTrue($events->contains('created'));
    }

    public function test_editing_a_question_records_what_changed(): void
    {
        $question = $this->makeQuestion($this->makeParameter());

        $question->update(['weightage' => 50]);

        $updated = $this->auditRowsFor(AssessmentQuestion::class, $question->id)
            ->firstWhere('event', 'updated');

        $this->assertNotNull($updated, 'An edit to a scoring rule must be recorded.');
        $this->assertContains('weightage', $updated->changed_fields);
    }

    public function test_deleting_a_question_is_recorded(): void
    {
        $question = $this->makeQuestion($this->makeParameter());
        $questionId = $question->id;

        $question->delete();

        $events = $this->auditRowsFor(AssessmentQuestion::class, $questionId)->pluck('event');

        $this->assertTrue($events->contains('deleted'));
    }

    public function test_changing_a_parameter_is_recorded(): void
    {
        $parameter = $this->makeParameter();

        $parameter->update(['is_active' => false]);

        $events = $this->auditRowsFor(AssessmentParameter::class, $parameter->id)->pluck('event');

        $this->assertTrue($events->contains('updated'));
    }
}
