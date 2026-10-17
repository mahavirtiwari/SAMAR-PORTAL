<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Assessment;
use App\Models\AssessmentTeamMember;
use App\Models\AssessorOffTime;
use App\Models\Organization;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * The Schedule Assessment dropdown shows assessors who are on leave or already
 * booked as unavailable, with the reason; scheduling refuses them too.
 */
class AssessorAvailabilityTest extends TestCase
{
    use RefreshDatabase;

    private const STATE = 'Maharashtra';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function user(string $role, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $user->roles()->attach(Role::where('slug', $role)->firstOrFail()->id, ['is_active' => true, 'assigned_at' => now()]);

        return $user;
    }

    private function assessment(string $status, ?string $start = null, ?string $end = null): Assessment
    {
        $org = Organization::factory()->create();
        $unit = Unit::create([
            'organization_id' => $org->id,
            'name' => 'Plant '.uniqid(),
            'address' => 'Plot 1',
            'state' => self::STATE,
            'district' => 'Pune',
            'pincode' => '411001',
            'unit_type' => 'manufacturing',
            'status' => 'active',
        ]);
        $application = Application::create([
            'organization_id' => $org->id,
            'organization_name' => $org->name,
            'unit_id' => $unit->id,
            'unit_name' => $unit->name,
            'unit_state' => self::STATE,
            'application_number' => 'SAMAR-'.random_int(100, 999).'-1026',
            'application_type' => 'new',
            'sector' => 'manufacturing',
            'enterprise_name' => 'Acme Defence',
            'contact_person_name' => 'Jane Doe',
            'contact_person_email' => 'jane@example.com',
            'gst_certificate_file' => 'applications/1/certs/gst.pdf',
            'status' => 'payment_completed',
            'payment_status' => 'success',
        ]);

        return Assessment::create([
            'application_id' => $application->id,
            'organization_id' => $org->id,
            'unit_id' => $unit->id,
            'status' => $status,
            'scheduled_start_date' => $start,
            'scheduled_end_date' => $end,
        ]);
    }

    public function test_assessors_on_leave_or_already_booked_are_reported_with_a_reason(): void
    {
        $manager = $this->user(Role::OPERATIONS_MANAGER);
        $free = $this->user(Role::ASSESSOR);
        $onLeave = $this->user(Role::ASSESSOR);
        $booked = $this->user(Role::ASSESSOR);

        AssessorOffTime::create(['user_id' => $onLeave->id, 'from_date' => now()->addDays(10)->toDateString(), 'to_date' => now()->addDays(12)->toDateString()]);
        $other = $this->assessment(Assessment::STATUS_SCHEDULED, now()->addDays(11)->toDateString(), now()->addDays(13)->toDateString());
        AssessmentTeamMember::create(['assessment_id' => $other->id, 'user_id' => $booked->id, 'role' => 'lead_assessor']);

        $target = $this->assessment(Assessment::STATUS_ALLOCATION_PENDING);
        $query = http_build_query([
            'startDate' => now()->addDays(11)->toDateString(),
            'endDate' => now()->addDays(11)->toDateString(),
            'userIds' => [$free->id, $onLeave->id, $booked->id],
        ]);

        $response = $this->withToken(JWTAuth::fromUser($manager))
            ->getJson("/api/v1/assessments/{$target->id}/assessor-availability?{$query}")
            ->assertOk();

        $byUser = collect($response->json('data.availability'))->keyBy('userId');
        $this->assertTrue($byUser[$free->id]['isAvailable']);
        $this->assertFalse($byUser[$onLeave->id]['isAvailable']);
        $this->assertStringStartsWith('On leave', $byUser[$onLeave->id]['unavailableReason']);
        $this->assertFalse($byUser[$booked->id]['isAvailable']);
        $this->assertStringContainsString('(Lead)', $byUser[$booked->id]['unavailableReason']);
    }

    public function test_dates_outside_the_leave_are_free(): void
    {
        $manager = $this->user(Role::OPERATIONS_MANAGER);
        $assessor = $this->user(Role::ASSESSOR);
        AssessorOffTime::create(['user_id' => $assessor->id, 'from_date' => now()->addDays(10)->toDateString(), 'to_date' => now()->addDays(12)->toDateString()]);
        $target = $this->assessment(Assessment::STATUS_ALLOCATION_PENDING);

        $query = http_build_query(['startDate' => now()->addDays(13)->toDateString(), 'endDate' => now()->addDays(14)->toDateString(), 'userIds' => [$assessor->id]]);
        $this->withToken(JWTAuth::fromUser($manager))
            ->getJson("/api/v1/assessments/{$target->id}/assessor-availability?{$query}")
            ->assertOk()
            ->assertJsonPath('data.availability.0.isAvailable', true);
    }

    public function test_scheduling_an_assessor_on_leave_is_refused(): void
    {
        $manager = $this->user(Role::OPERATIONS_MANAGER, ['assigned_states' => [self::STATE]]);
        $assessor = $this->user(Role::ASSESSOR, ['assigned_states' => [self::STATE]]);
        AssessorOffTime::create(['user_id' => $assessor->id, 'from_date' => now()->addDays(10)->toDateString(), 'to_date' => now()->addDays(12)->toDateString()]);
        $target = $this->assessment(Assessment::STATUS_ALLOCATION_PENDING);

        $this->withToken(JWTAuth::fromUser($manager))
            ->postJson("/api/v1/assessments/{$target->id}/schedule", [
                'leadAssessorId' => $assessor->id,
                'scheduledStartDate' => now()->addDays(11)->toDateString(),
                'scheduledEndDate' => now()->addDays(11)->toDateString(),
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'One or more assessors are unavailable on these dates.');
    }
}
