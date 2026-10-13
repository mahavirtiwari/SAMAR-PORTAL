<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Assessment;
use App\Models\Organization;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use App\Services\StateFilterService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * An application with no unit state counts as unassigned and stays visible to every
 * state-restricted Operations Manager. A plain whereIn drops NULL, which made such an
 * application vanish from the manager's list and dashboard while still counting in the
 * System Admin's unfiltered total. [BUG-08934]
 */
class UnassignedStateVisibilityTest extends TestCase
{
    use RefreshDatabase;

    private const ASSIGNED_STATE = 'Maharashtra';

    private const OTHER_STATE = 'Kerala';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function makeApplication(?string $unitState): Application
    {
        $org = Organization::factory()->create();
        $unit = Unit::create([
            'organization_id' => $org->id,
            'name' => 'Plant '.uniqid(),
            'address' => 'Plot 1, Industrial Area',
            'state' => $unitState ?? self::OTHER_STATE,
            'district' => 'Pune',
            'pincode' => '411001',
            'unit_type' => 'manufacturing',
            'status' => 'active',
        ]);

        return Application::create([
            'organization_id' => $org->id,
            'organization_name' => $org->name,
            'unit_id' => $unit->id,
            'unit_name' => $unit->name,
            'unit_state' => $unitState,
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
    }

    private function makeAssessment(?string $unitState): Assessment
    {
        $application = $this->makeApplication($unitState);

        return Assessment::create([
            'application_id' => $application->id,
            'organization_id' => $application->organization_id,
            'unit_id' => $application->unit_id,
            'status' => Assessment::STATUS_SUBMITTED_FOR_QC,
        ]);
    }

    private function restrictedManager(): User
    {
        $manager = User::factory()->create(['assigned_states' => [self::ASSIGNED_STATE]]);
        $manager->roles()->attach(
            Role::where('slug', Role::OPERATIONS_MANAGER)->firstOrFail()->id,
            ['is_active' => true, 'assigned_at' => now()],
        );

        return $manager->fresh();
    }

    public function test_an_application_with_no_state_stays_visible_to_a_restricted_manager(): void
    {
        $unassigned = $this->makeApplication(null);
        $inState = $this->makeApplication(self::ASSIGNED_STATE);
        $elsewhere = $this->makeApplication(self::OTHER_STATE);

        $visible = Application::query()->forStates([self::ASSIGNED_STATE])->pluck('id');

        $this->assertTrue($visible->contains($unassigned->id), 'An unassigned application must not disappear.');
        $this->assertTrue($visible->contains($inState->id));
        $this->assertFalse($visible->contains($elsewhere->id), 'Another state must still be filtered out.');
    }

    public function test_an_assessment_on_an_unassigned_application_stays_visible(): void
    {
        $unassigned = $this->makeAssessment(null);
        $elsewhere = $this->makeAssessment(self::OTHER_STATE);

        $visible = Assessment::query()->forStates([self::ASSIGNED_STATE])->pluck('id');

        $this->assertTrue($visible->contains($unassigned->id));
        $this->assertFalse($visible->contains($elsewhere->id));
    }

    public function test_the_state_filter_still_excludes_another_state(): void
    {
        $elsewhere = $this->makeApplication(self::OTHER_STATE);

        $visible = Application::query()->forStates([self::ASSIGNED_STATE])->pluck('id');

        $this->assertFalse(
            $visible->contains($elsewhere->id),
            'Including unassigned rows must not widen the filter to everything.',
        );
    }

    public function test_the_single_record_check_agrees_with_the_list(): void
    {
        $service = app(StateFilterService::class);
        $manager = $this->restrictedManager();

        $unassigned = $this->makeAssessment(null);
        $inState = $this->makeAssessment(self::ASSIGNED_STATE);
        $elsewhere = $this->makeAssessment(self::OTHER_STATE);

        // The list and the record must not disagree: a manager who can see an assessment
        // in the list has to be able to open it.
        $this->assertTrue(
            $service->assessmentInStates($manager, $unassigned->fresh(['application'])),
            'An unassigned assessment shown in the list must also open.',
        );
        $this->assertTrue($service->assessmentInStates($manager, $inState->fresh(['application'])));
        $this->assertFalse($service->assessmentInStates($manager, $elsewhere->fresh(['application'])));
    }
}
