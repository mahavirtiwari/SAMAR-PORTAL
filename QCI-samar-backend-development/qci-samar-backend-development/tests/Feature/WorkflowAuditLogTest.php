<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Assessment;
use App\Models\AuditLog;
use App\Models\Organization;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use App\Services\StateMachine\ApplicationStateMachine;
use App\Services\StateMachine\AssessmentStateMachine;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * TASK-05769: Application/Assessment status transitions emit a semantic workflow
 * audit entry at the state-machine choke point, without duplicating it as a
 * generic "updated" row, and surface under the activity-log "workflow" category.
 */
class WorkflowAuditLogTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function makeUser(string $roleSlug, ?Organization $org = null): User
    {
        $user = User::factory()->create(['organization_id' => $org?->id]);
        $role = Role::where('slug', $roleSlug)->firstOrFail();
        $user->roles()->attach($role->id, [
            'organization_id' => $org?->id,
            'unit_id' => null,
            'is_active' => true,
            'assigned_at' => now(),
        ]);

        return $user;
    }

    private function makeUnit(Organization $org): Unit
    {
        return Unit::create([
            'organization_id' => $org->id,
            'name' => 'Unit',
            'address' => 'Addr',
            'state' => 'State',
            'district' => 'District',
            'pincode' => '110011',
            'unit_type' => 'manufacturing',
            'status' => 'active',
        ]);
    }

    private function makeApplication(Organization $org, Unit $unit, User $creator, string $status): Application
    {
        return Application::create([
            'organization_id' => $org->id,
            'unit_id' => $unit->id,
            'application_number' => 'SAMAR-'.strtoupper(uniqid()),
            'application_type' => 'new',
            'sector' => 'manufacturing',
            'status' => $status,
            'created_by' => $creator->id,
        ]);
    }

    private function statusOnlyUpdatedRows(string $type, int $id)
    {
        return AuditLog::where('auditable_type', $type)
            ->where('auditable_id', $id)
            ->where('event', 'updated')
            ->get()
            ->filter(fn (AuditLog $log) => $log->changed_fields === ['status']);
    }

    public function test_whitelisted_transition_logs_semantic_entry_and_suppresses_generic_status_row(): void
    {
        $org = Organization::factory()->create();
        $unit = $this->makeUnit($org);
        $opsManager = $this->makeUser(Role::OPERATIONS_MANAGER);
        $applicant = User::factory()->create(['organization_id' => $org->id]);

        $application = $this->makeApplication($org, $unit, $applicant, 'payment_completed');

        (new ApplicationStateMachine($application->fresh(), $opsManager))->transition('allocate');

        // Exactly one semantic workflow entry, carrying actor and from -> to status.
        $semantic = AuditLog::where('auditable_type', Application::class)
            ->where('auditable_id', $application->id)
            ->where('event', 'custom')
            ->where('custom_event', 'application_in_progress')
            ->get();

        $this->assertCount(1, $semantic);
        $this->assertSame($opsManager->id, $semantic->first()->user_id);
        $this->assertSame('payment_completed', $semantic->first()->old_values['status']);
        $this->assertSame('in_progress', $semantic->first()->new_values['status']);
        $this->assertSame(['status'], $semantic->first()->changed_fields);

        // The duplicate generic status-only "updated" row must be suppressed.
        $this->assertCount(0, $this->statusOnlyUpdatedRows(Application::class, $application->id),
            'status-only generic updated row must be suppressed for a whitelisted transition');

        // Suppression is surgical — the allocated_at write still audits normally.
        $otherUpdated = AuditLog::where('auditable_type', Application::class)
            ->where('auditable_id', $application->id)
            ->where('event', 'updated')
            ->get()
            ->filter(fn (AuditLog $log) => in_array('allocated_at', $log->changed_fields ?? [], true));

        $this->assertTrue($otherUpdated->isNotEmpty(), 'non-status field changes must still be audited');
    }

    public function test_direct_status_write_outside_state_machine_still_logs_generic_row(): void
    {
        $org = Organization::factory()->create();
        $unit = $this->makeUnit($org);
        $applicant = User::factory()->create(['organization_id' => $org->id]);

        $application = $this->makeApplication($org, $unit, $applicant, 'draft');

        // Not a whitelisted transition — the generic row must NOT be suppressed.
        $application->update(['status' => 'payment_pending']);

        $this->assertTrue($this->statusOnlyUpdatedRows(Application::class, $application->id)->isNotEmpty());
    }

    public function test_assessment_certification_cascades_and_logs_both_workflow_entries(): void
    {
        $org = Organization::factory()->create();
        $unit = $this->makeUnit($org);
        $opsAdmin = $this->makeUser(Role::OPERATIONS_ADMIN);
        $applicant = User::factory()->create(['organization_id' => $org->id]);

        $application = $this->makeApplication($org, $unit, $applicant, 'in_progress');

        $assessment = Assessment::create([
            'application_id' => $application->id,
            'organization_id' => $org->id,
            'unit_id' => $unit->id,
            'status' => Assessment::STATUS_COMMITTEE_REVIEW,
            'total_score' => 3.5,
        ]);

        (new AssessmentStateMachine($assessment->fresh(), $opsAdmin))->transition('certify');

        $this->assertTrue(
            AuditLog::where('auditable_type', Assessment::class)
                ->where('auditable_id', $assessment->id)
                ->where('custom_event', 'assessment_certified')
                ->exists(),
            'the directly-actioned assessment certification is logged'
        );

        // Decision: the cascaded Application certification IS logged — once.
        $applicationCertified = AuditLog::where('auditable_type', Application::class)
            ->where('auditable_id', $application->id)
            ->where('custom_event', 'application_certified')
            ->get();

        $this->assertCount(1, $applicationCertified, 'cascaded application certification logs exactly one entry');
        $this->assertTrue((bool) ($applicationCertified->first()->metadata['automated'] ?? false),
            'cascaded entry is flagged automated');
    }

    public function test_assessment_generic_field_edits_are_not_audited_only_transitions_are(): void
    {
        $org = Organization::factory()->create();
        $unit = $this->makeUnit($org);
        $opsAdmin = $this->makeUser(Role::OPERATIONS_ADMIN);
        $applicant = User::factory()->create(['organization_id' => $org->id]);

        $application = $this->makeApplication($org, $unit, $applicant, 'in_progress');

        $assessment = Assessment::create([
            'application_id' => $application->id,
            'organization_id' => $org->id,
            'unit_id' => $unit->id,
            'status' => Assessment::STATUS_COMMITTEE_REVIEW,
            'total_score' => 3.5,
        ]);

        // A plain data-field edit must produce no audit row at all.
        $assessment->update(['total_score' => 4.2]);

        // TASK-05816: Assessment opts out of all generic created/updated/deleted rows.
        $this->assertCount(0,
            AuditLog::where('auditable_type', Assessment::class)
                ->where('auditable_id', $assessment->id)
                ->whereIn('event', ['created', 'updated', 'deleted'])
                ->get(),
            'generic assessment field edits must not be audited');

        // But a whitelisted workflow transition still records exactly one semantic entry.
        (new AssessmentStateMachine($assessment->fresh(), $opsAdmin))->transition('certify');

        $this->assertCount(1,
            AuditLog::where('auditable_type', Assessment::class)
                ->where('auditable_id', $assessment->id)
                ->where('event', 'custom')
                ->where('custom_event', 'assessment_certified')
                ->get(),
            'whitelisted transition still logs exactly one semantic entry');
    }

    public function test_reschedule_transition_logs_semantic_entry_and_preserves_allocated_at(): void
    {
        $org = Organization::factory()->create();
        $unit = $this->makeUnit($org);
        $opsManager = $this->makeUser(Role::OPERATIONS_MANAGER);
        $applicant = User::factory()->create(['organization_id' => $org->id]);

        $application = $this->makeApplication($org, $unit, $applicant, 'in_progress');

        $allocatedAt = now()->subDays(3);
        $assessment = Assessment::create([
            'application_id' => $application->id,
            'organization_id' => $org->id,
            'unit_id' => $unit->id,
            'status' => Assessment::STATUS_SCHEDULED,
            'scheduled_start_date' => now()->addDays(5)->toDateString(),
            'scheduled_end_date' => now()->addDays(6)->toDateString(),
            'allocated_at' => $allocatedAt,
        ]);

        (new AssessmentStateMachine($assessment->fresh(), $opsManager))->transition('reschedule');

        // BUG-06530: the reschedule records exactly one 'assessment_rescheduled' entry.
        $semantic = AuditLog::where('auditable_type', Assessment::class)
            ->where('auditable_id', $assessment->id)
            ->where('event', 'custom')
            ->where('custom_event', 'assessment_rescheduled')
            ->get();

        $this->assertCount(1, $semantic);
        $this->assertSame($opsManager->id, $semantic->first()->user_id);

        // A reschedule keeps the original allocation timestamp — it is a self-loop
        // on 'scheduled', not a fresh allocation.
        $this->assertSame(
            $allocatedAt->toDateTimeString(),
            $assessment->fresh()->allocated_at->toDateTimeString(),
            'reschedule must not reset allocated_at'
        );
    }

    public function test_activity_log_workflow_category_returns_only_workflow_events(): void
    {
        $org = Organization::factory()->create();
        $unit = $this->makeUnit($org);
        $opsManager = $this->makeUser(Role::OPERATIONS_MANAGER);
        $applicant = User::factory()->create(['organization_id' => $org->id]);
        $admin = $this->makeUser(Role::SYSTEM_ADMIN);

        $application = $this->makeApplication($org, $unit, $applicant, 'payment_completed');
        (new ApplicationStateMachine($application->fresh(), $opsManager))->transition('allocate');

        $res = $this->withToken(JWTAuth::fromUser($admin))
            ->getJson('/api/v1/admin/activity-logs?category=workflow');

        $res->assertOk();
        $data = $res->json('data');

        $this->assertNotEmpty($data);
        foreach ($data as $row) {
            $this->assertSame('workflow', $row['category']);
        }
        $this->assertContains('application_in_progress', array_column($data, 'event'));
        $this->assertContains('Application in progress', array_column($data, 'action'));
    }
}
