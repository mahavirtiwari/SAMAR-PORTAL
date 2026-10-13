<?php

namespace Tests\Feature;

use App\Exceptions\ErrorReporter;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use App\Services\Auth\AuthService;
use App\Services\UserService;
use Database\Seeders\RoleSeeder;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * FEATURE-01033 — Log Management System (spec §3.13):
 * error logging is actually wired, security events are captured, and the full
 * audit/activity trail is served to System Admin.
 */
class LogManagementTest extends TestCase
{
    use RefreshDatabase;

    private AuthService $auth;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->auth = app(AuthService::class);
    }

    private function makeUser(string $roleSlug = Role::ASSESSOR, bool $twoFactor = false): User
    {
        $user = User::factory()->create([
            'organization_id' => null,
            'status' => 'active',
            'is_two_factor_enabled' => $twoFactor,
        ]);

        $role = Role::where('slug', $roleSlug)->firstOrFail();
        $user->roles()->attach($role->id, [
            'organization_id' => null,
            'unit_id' => null,
            'is_active' => true,
            'assigned_at' => now(),
        ]);

        return $user;
    }

    /** Events the given user performed — logAudit() records the actor in user_id. */
    private function events(User $user, string $event)
    {
        return AuditLog::where('event', 'custom')
            ->where('custom_event', $event)
            ->where('user_id', $user->id)
            ->get();
    }

    /** Events recorded *about* the given user — the subject is the auditable. */
    private function eventsAbout(User $subject, string $event)
    {
        return AuditLog::where('event', 'custom')
            ->where('custom_event', $event)
            ->where('auditable_type', User::class)
            ->where('auditable_id', $subject->id)
            ->get();
    }

    // TASK-05497 — exception handler wiring

    public function test_server_error_is_written_to_the_error_log_database(): void
    {
        $request = Request::create('http://localhost/api/v1/boom', 'POST', ['foo' => 'bar']);
        $this->app->instance('request', $request);

        app(ErrorReporter::class)->report(new \RuntimeException('kaboom'));

        $this->assertDatabaseHas('error_logs', [
            'exception_class' => \RuntimeException::class,
            'http_status_code' => 500,
        ]);
    }

    public function test_client_errors_are_not_written_to_the_error_log_database(): void
    {
        $request = Request::create('http://localhost/api/v1/nope', 'GET');
        $this->app->instance('request', $request);

        app(ErrorReporter::class)->report(new ModelNotFoundException);

        $this->assertDatabaseCount('error_logs', 0);
    }

    // TASK-05499 — security event logging

    public function test_failed_login_records_a_login_failed_event(): void
    {
        config(['auth.lockout.enabled' => true, 'auth.lockout.max_attempts' => 5]);
        $user = $this->makeUser();

        try {
            $this->auth->login($user->samar_id, 'wrong-password');
        } catch (\Throwable) {
            // expected
        }

        $this->assertCount(1, $this->events($user, 'login_failed'));
        $this->assertCount(0, $this->events($user, 'account_locked'));
    }

    public function test_repeated_failed_logins_record_an_account_locked_event(): void
    {
        config(['auth.lockout.enabled' => true, 'auth.lockout.max_attempts' => 2, 'auth.lockout.duration_minutes' => 30]);
        $user = $this->makeUser();

        foreach (range(1, 2) as $_) {
            try {
                $this->auth->login($user->samar_id, 'wrong-password');
            } catch (\Throwable) {
                // expected
            }
        }

        $this->assertCount(2, $this->events($user, 'login_failed'));
        $this->assertCount(1, $this->events($user, 'account_locked'));
    }

    public function test_logout_records_a_logout_event(): void
    {
        $user = $this->makeUser();

        $this->auth->logout($user);

        $this->assertCount(1, $this->events($user, 'logout'));
    }

    public function test_role_assignment_records_a_role_assigned_event(): void
    {
        $admin = $this->makeUser(Role::SYSTEM_ADMIN);
        $target = User::factory()->create(['organization_id' => null, 'status' => 'active']);

        app(UserService::class)->assignRolesToUser($target, [Role::ASSESSOR], $admin);

        // The admin is the actor; the target is the subject.
        $logs = $this->eventsAbout($target, 'role_assigned');
        $this->assertCount(1, $logs);
        $this->assertSame(Role::ASSESSOR, $logs->first()->metadata['role_slug']);
        $this->assertSame($admin->id, $logs->first()->metadata['assigned_by']);
    }

    // TASK-05498 — full activity-trail read API

    public function test_activity_endpoint_is_forbidden_for_non_system_admin(): void
    {
        $user = $this->makeUser();

        $this->withToken(JWTAuth::fromUser($user))
            ->getJson('/api/v1/admin/activity-logs')
            ->assertForbidden();
    }

    public function test_system_admin_lists_the_full_trail_including_data_and_security(): void
    {
        $admin = $this->makeUser(Role::SYSTEM_ADMIN);
        $admin->update(['designation' => 'Administrator']); // data event: updated
        $admin->logAudit('login_failed', description: 'Failed login attempt.', actor: $admin); // security event

        $res = $this->withToken(JWTAuth::fromUser($admin))
            ->getJson('/api/v1/admin/activity-logs?perPage=100');
        $res->assertOk();

        $events = collect($res->json('data'))->pluck('event');
        $this->assertTrue($events->contains('updated'));
        $this->assertTrue($events->contains('login_failed'));
        $this->assertTrue($events->contains('created')); // factory create fired an audit
    }

    public function test_activity_endpoint_filters_by_category(): void
    {
        $admin = $this->makeUser(Role::SYSTEM_ADMIN);
        $admin->update(['designation' => 'Administrator']);
        $admin->logAudit('login_failed', description: 'Failed login attempt.', actor: $admin);

        $res = $this->withToken(JWTAuth::fromUser($admin))
            ->getJson('/api/v1/admin/activity-logs?category=security&perPage=100');
        $res->assertOk();

        $categories = collect($res->json('data'))->pluck('category')->unique()->values()->all();
        $this->assertSame(['security'], $categories);
    }

    public function test_activity_endpoint_filters_by_entity_type(): void
    {
        $admin = $this->makeUser(Role::SYSTEM_ADMIN);
        $admin->update(['designation' => 'Administrator']);

        $res = $this->withToken(JWTAuth::fromUser($admin))
            ->getJson('/api/v1/admin/activity-logs?entityType=User&perPage=100');
        $res->assertOk();

        $this->assertNotEmpty($res->json('data'));
        $this->assertTrue(collect($res->json('data'))->every(fn ($r) => $r['entityType'] === 'User'));
    }
}
