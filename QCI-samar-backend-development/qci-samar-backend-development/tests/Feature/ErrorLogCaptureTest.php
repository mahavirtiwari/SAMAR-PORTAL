<?php

namespace Tests\Feature;

use App\Exceptions\ErrorReporter;
use App\Models\ErrorGroup;
use App\Models\ErrorLog;
use App\Models\Role;
use App\Models\User;
use App\Services\ErrorLogging\ErrorLoggerService;
use Database\Seeders\RoleSeeder;
use Illuminate\Console\Events\ScheduledTaskFailed;
use Illuminate\Console\Scheduling\Event as ScheduleEvent;
use Illuminate\Contracts\Queue\Job;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Queue\Events\JobFailed;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * TASK-05773 — Error Log for System Admin. Non-HTTP failures (queue jobs,
 * scheduled commands, integration/gateway calls) are captured to error_logs
 * with a source tag, gated by the configured minimum severity, with secrets
 * redacted, and surfaced through the System-Admin-only read endpoint.
 */
class ErrorLogCaptureTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        config(['error_logging.enabled' => true, 'error_logging.min_severity' => 'error']);
    }

    private function reporter(): ErrorReporter
    {
        return app(ErrorReporter::class);
    }

    private function systemAdmin(): User
    {
        $user = User::factory()->create(['organization_id' => null, 'status' => 'active']);
        $role = Role::where('slug', Role::SYSTEM_ADMIN)->firstOrFail();
        $user->roles()->attach($role->id, [
            'organization_id' => null,
            'unit_id' => null,
            'is_active' => true,
            'assigned_at' => now(),
        ]);

        return $user;
    }

    public function test_non_http_failure_is_persisted_with_source_and_no_request_context(): void
    {
        $this->reporter()->captureException(
            new \RuntimeException('BC token exchange failed'),
            'business_central',
            ['entity' => 'ProcessCustomer', 'record_id' => 42],
        );

        $this->assertDatabaseHas('error_logs', [
            'exception_class' => \RuntimeException::class,
            'source' => 'business_central',
            'severity' => 'error',
            'http_status_code' => null,
            'request_url' => null,
        ]);

        $log = ErrorLog::first();
        $this->assertSame(42, $log->context['record_id']);
    }

    public function test_failures_below_the_threshold_are_dropped(): void
    {
        $this->reporter()->captureException(
            new \RuntimeException('transient retryable blip'),
            'business_central',
            [],
            ErrorLog::SEVERITY_WARNING,
        );

        $this->assertDatabaseCount('error_logs', 0);
    }

    public function test_secrets_in_context_are_redacted(): void
    {
        $this->reporter()->captureException(
            new \RuntimeException('gateway auth failed'),
            'payment',
            ['password' => 'hunter2', 'access_token' => 'abc.def', 'order' => 'ORD-1'],
        );

        $log = ErrorLog::firstOrFail();
        $this->assertSame('***REDACTED***', $log->context['password']);
        $this->assertSame('***REDACTED***', $log->context['access_token']);
        $this->assertSame('ORD-1', $log->context['order']);
    }

    public function test_repeated_failures_group_and_produce_one_row_each(): void
    {
        // The same failure recurring comes from one throw site — reuse the
        // instance so both captures share the exception's file+line fingerprint.
        $exception = new \RuntimeException('same failure');
        $this->reporter()->captureException($exception, 'queue');
        $this->reporter()->captureException($exception, 'queue');

        $this->assertDatabaseCount('error_logs', 2);
        $this->assertDatabaseCount('error_groups', 1);
        $this->assertSame(2, ErrorGroup::first()->occurrences_count);
    }

    public function test_affected_users_count_counts_each_distinct_user_once(): void
    {
        $user = $this->systemAdmin();
        $service = app(ErrorLoggerService::class);

        $request = Request::create('/api/v1/thing', 'GET');
        $request->setUserResolver(fn () => $user);

        // Same throw site (reused instance) → one group; same user twice → one affected user.
        $exception = new \RuntimeException('http boom');
        $service->logError($exception, $request, 'ERR-A', 500, false);
        $service->logError($exception, $request, 'ERR-B', 500, false);

        $group = ErrorGroup::firstOrFail();
        $this->assertSame(2, $group->occurrences_count);
        $this->assertSame(1, $group->affected_users_count);
    }

    public function test_failed_queue_job_is_captured(): void
    {
        $job = \Mockery::mock(Job::class);
        $job->shouldReceive('resolveName')->andReturn('App\\Jobs\\PushInvoiceToBc');
        $job->shouldReceive('getQueue')->andReturn('default');
        $job->shouldReceive('attempts')->andReturn(1);

        event(new JobFailed('database', $job, new \RuntimeException('job blew up')));

        $this->assertDatabaseHas('error_logs', [
            'source' => 'queue',
            'exception_class' => \RuntimeException::class,
        ]);
        $this->assertSame('App\\Jobs\\PushInvoiceToBc', ErrorLog::first()->context['job']);
    }

    public function test_failed_scheduled_command_is_captured(): void
    {
        $task = \Mockery::mock(ScheduleEvent::class);
        $task->command = 'php artisan certificates:notify-expiring';

        event(new ScheduledTaskFailed($task, new \RuntimeException('cron blew up')));

        $this->assertDatabaseHas('error_logs', [
            'source' => 'scheduler',
            'exception_class' => \RuntimeException::class,
        ]);
    }

    public function test_read_endpoint_filters_by_source_level_and_search(): void
    {
        $this->reporter()->captureException(new \RuntimeException('payment reconciliation mismatch'), 'payment', [], ErrorLog::SEVERITY_CRITICAL);
        $this->reporter()->captureException(new \RuntimeException('queue worker died'), 'queue');

        $admin = $this->systemAdmin();
        $token = JWTAuth::fromUser($admin);

        $this->withToken($token)->getJson('/api/v1/admin/error-logs?source=payment')
            ->assertOk()
            ->assertJsonPath('data.0.source', 'payment')
            ->assertJsonCount(1, 'data');

        $this->withToken($token)->getJson('/api/v1/admin/error-logs?level=critical')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->withToken($token)->getJson('/api/v1/admin/error-logs?search=reconciliation')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_read_endpoint_rejects_invalid_filter_values_with_422(): void
    {
        $token = JWTAuth::fromUser($this->systemAdmin());

        // Invalid severity/level value.
        $this->withToken($token)->getJson('/api/v1/admin/error-logs?level=bogus')
            ->assertStatus(422);

        // Advertised-but-never-written source values are no longer accepted.
        $this->withToken($token)->getJson('/api/v1/admin/error-logs?source=storage')
            ->assertStatus(422);

        // Unknown status value.
        $this->withToken($token)->getJson('/api/v1/admin/error-logs?status=nope')
            ->assertStatus(422);

        // A valid filter still succeeds.
        $this->withToken($token)->getJson('/api/v1/admin/error-logs?level=critical&source=payment')
            ->assertOk();
    }

    public function test_read_endpoint_is_forbidden_for_non_system_admin(): void
    {
        $user = User::factory()->create(['organization_id' => null, 'status' => 'active']);
        $role = Role::where('slug', Role::ASSESSOR)->firstOrFail();
        $user->roles()->attach($role->id, [
            'organization_id' => null, 'unit_id' => null, 'is_active' => true, 'assigned_at' => now(),
        ]);

        $this->withToken(JWTAuth::fromUser($user))
            ->getJson('/api/v1/admin/error-logs')
            ->assertForbidden();
    }

    /**
     * BUG-06525 regression. The read endpoints eager-loaded `users.name`, a column
     * that does not exist (users has first_name/last_name), so any error log or group
     * with a user attached returned 500 (SQLSTATE 42S22). The capture-only tests never
     * exercised it because directly-captured errors carry a null user_id, which makes
     * Eloquent skip the users query entirely.
     */
    public function test_read_endpoints_load_user_relations_without_500(): void
    {
        $admin = $this->systemAdmin();

        $this->reporter()->captureException(
            new \RuntimeException('gateway timeout'),
            'payment',
            [],
            ErrorLog::SEVERITY_CRITICAL
        );

        $log = ErrorLog::query()->latest('id')->firstOrFail();
        $log->update([
            'user_id' => $admin->id,
            'resolved_by' => $admin->id,
            'resolved_at' => now(),
            'status' => ErrorLog::STATUS_RESOLVED,
        ]);

        $group = ErrorGroup::query()->latest('id')->firstOrFail();
        $group->update(['assigned_to' => $admin->id]);

        $token = JWTAuth::fromUser($admin);

        // Responses are camelCased by middleware, so the user relation surfaces
        // as user.firstName / resolvedBy.firstName / assignedUser.firstName.
        // Locate the row by id rather than position — the authenticated request
        // can add its own logs, so ordering isn't fixed.
        $logs = $this->withToken($token)->getJson('/api/v1/admin/error-logs')
            ->assertOk()->json('data');
        $row = collect($logs)->firstWhere('id', $log->id);
        $this->assertNotNull($row, 'seeded error log missing from index response');
        $this->assertSame($admin->first_name, $row['user']['firstName']);
        $this->assertSame($admin->first_name, $row['resolvedBy']['firstName']);

        $this->withToken($token)->getJson("/api/v1/admin/error-logs/{$log->id}")
            ->assertOk()
            ->assertJsonPath('data.user.firstName', $admin->first_name)
            ->assertJsonPath('data.resolvedBy.firstName', $admin->first_name);

        $groups = $this->withToken($token)->getJson('/api/v1/admin/error-groups')
            ->assertOk()->json('data');
        $groupRow = collect($groups)->firstWhere('id', $group->id);
        $this->assertNotNull($groupRow, 'seeded error group missing from index response');
        $this->assertSame($admin->first_name, $groupRow['assignedUser']['firstName']);

        $this->withToken($token)->getJson("/api/v1/admin/error-groups/{$group->id}")
            ->assertOk()
            ->assertJsonPath('data.assignedUser.firstName', $admin->first_name);
    }
}
