<?php

namespace Tests\Feature;

use App\Listeners\AssessmentStatusChangedListener;
use App\Models\Application;
use App\Models\Assessment;
use App\Models\Organization;
use App\Models\Unit;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\View;
use Tests\TestCase;

/**
 * The QC review required email must name the unit as well as the organization,
 * so a reviewer can tell which unit an assessment belongs to. [TASK-07971]
 */
class QcReviewEmailUnitNameTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function makeAssessment(?string $unitName): Assessment
    {
        $org = Organization::factory()->create(['name' => 'Acme Defense Pvt Ltd']);
        $unit = Unit::create([
            'organization_id' => $org->id,
            'name' => 'Pune Plant',
            'address' => 'Plot 1, Industrial Area',
            'state' => 'Maharashtra',
            'district' => 'Pune',
            'pincode' => '411001',
            'unit_type' => 'manufacturing',
            'status' => 'active',
        ]);

        $application = Application::create([
            'organization_id' => $org->id,
            'organization_name' => $org->name,
            'unit_id' => $unit->id,
            'unit_name' => $unitName,
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
        ]);

        return Assessment::create([
            'application_id' => $application->id,
            'organization_id' => $org->id,
            'unit_id' => $unit->id,
            'status' => Assessment::STATUS_SUBMITTED_FOR_QC,
        ]);
    }

    private function emailDataFor(Assessment $assessment): array
    {
        $listener = app(AssessmentStatusChangedListener::class);
        $method = new \ReflectionMethod($listener, 'prepareEmailData');
        $method->setAccessible(true);

        return $method->invoke($listener, $assessment, null);
    }

    public function test_email_data_carries_the_unit_name(): void
    {
        $data = $this->emailDataFor($this->makeAssessment('Pune Plant'));

        $this->assertSame('Pune Plant', $data['unit_name']);
        $this->assertSame('Acme Defense Pvt Ltd', $data['organization_name']);
    }

    public function test_email_data_falls_back_when_the_unit_name_is_missing(): void
    {
        $data = $this->emailDataFor($this->makeAssessment(null));

        $this->assertSame('N/A', $data['unit_name']);
    }

    public function test_qc_review_email_renders_the_unit_name(): void
    {
        $data = $this->emailDataFor($this->makeAssessment('Pune Plant'));

        $html = View::make('emails.assessment.qc-feedback-required', $data)->render();

        $this->assertStringContainsString('Unit Name', $html);
        $this->assertStringContainsString('Pune Plant', $html);
        $this->assertStringContainsString('Acme Defense Pvt Ltd', $html);
    }
}
