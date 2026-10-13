<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use App\Services\Auth\AuthService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * TASK-05247: login, password change and password reset must each produce an
 * explicit audit entry, and the listing endpoint must be System Admin only.
 */
class AuthAuditLogTest extends TestCase
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

    private function authEvents(User $user, string $event)
    {
        return AuditLog::where('event', 'custom')
            ->where('custom_event', $event)
            ->where('user_id', $user->id)
            ->get();
    }

    public function test_direct_login_records_a_login_audit_event(): void
    {
        $user = $this->makeUser();

        $this->auth->login($user->samar_id, 'password', [
            'device_type' => 'web',
            'device_name' => 'Chrome on Windows',
            'device_id' => 'device-1',
        ]);

        $logs = $this->authEvents($user, 'login');
        $this->assertCount(1, $logs);
        $this->assertSame($user->email, $logs->first()->user_email);
        $this->assertSame('web', $logs->first()->metadata['device_type']);
    }

    public function test_otp_login_records_a_login_audit_event(): void
    {
        $user = $this->makeUser(Role::ASSESSOR, twoFactor: true);

        $result = $this->auth->login($user->samar_id, 'password', ['device_type' => 'android']);
        $otp = $result['pending_session']->generateOtp();

        $this->auth->verifyLoginOtp($result['pending_session']->session_token, $otp, [
            'device_type' => 'android',
            'device_id' => 'device-2',
        ]);

        $logs = $this->authEvents($user, 'login');
        $this->assertCount(1, $logs);
        $this->assertSame('android', $logs->first()->metadata['device_type']);
    }

    public function test_password_change_records_an_audit_event(): void
    {
        $user = $this->makeUser();

        $this->auth->changePassword($user, 'password', 'NewPassw0rd!');

        $this->assertCount(1, $this->authEvents($user, 'password_change'));
    }

    public function test_password_reset_records_an_audit_event(): void
    {
        $user = $this->makeUser();
        $otp = $user->generateOtp(6);

        $this->auth->resetPassword($user->samar_id, $otp, 'NewPassw0rd!');

        $logs = $this->authEvents($user, 'password_reset');
        $this->assertCount(1, $logs);
        $this->assertSame($user->email, $logs->first()->user_email);
    }

    public function test_audit_endpoint_is_forbidden_for_non_system_admin(): void
    {
        $user = $this->makeUser();

        $this->withToken(JWTAuth::fromUser($user))
            ->getJson('/api/v1/admin/audit-logs')
            ->assertForbidden();
    }

    public function test_system_admin_can_list_and_filter_auth_audit_events(): void
    {
        $admin = $this->makeUser(Role::SYSTEM_ADMIN);
        $other = $this->makeUser();

        $other->logAudit('login', description: 'User logged in.', actor: $other);
        $other->logAudit('password_change', description: 'User changed their password.', actor: $other);

        $all = $this->withToken(JWTAuth::fromUser($admin))->getJson('/api/v1/admin/audit-logs');
        $all->assertOk();
        $this->assertSame(2, $all->json('pagination.total'));

        $filtered = $this->withToken(JWTAuth::fromUser($admin))
            ->getJson('/api/v1/admin/audit-logs?event=login');
        $filtered->assertOk();
        $this->assertSame(1, $filtered->json('pagination.total'));
        $this->assertSame('login', $filtered->json('data.0.event'));
        $this->assertSame($other->email, $filtered->json('data.0.userEmail'));
    }

    public function test_generic_model_audits_are_not_exposed_by_the_endpoint(): void
    {
        $admin = $this->makeUser(Role::SYSTEM_ADMIN);

        // The model-updated hook writes event='updated' rows; the endpoint must not serve them.
        $admin->update(['designation' => 'Administrator']);
        $this->assertTrue(AuditLog::where('event', 'updated')->exists());

        $res = $this->withToken(JWTAuth::fromUser($admin))->getJson('/api/v1/admin/audit-logs');
        $res->assertOk();
        $this->assertSame(0, $res->json('pagination.total'));
    }
}
