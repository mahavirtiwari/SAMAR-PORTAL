<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\Session;
use App\Models\User;
use App\Services\Auth\AuthService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * BUG-06042: single-session enforcement must key on a stable device_id, so a device
 * re-authenticating (or a concurrent double login from the same install) never
 * terminates its own just-issued token as 'new_session' — while a genuinely
 * different device still displaces the session.
 */
class SessionDeviceBindingTest extends TestCase
{
    use RefreshDatabase;

    private AuthService $auth;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->auth = app(AuthService::class);
    }

    private function makeSingleSessionUser(): User
    {
        // No organization → hasActiveOrganization() short-circuits true; status active
        // + 2FA off means login() takes the direct token path.
        $user = User::factory()->create([
            'organization_id' => null,
            'status' => 'active',
            'is_two_factor_enabled' => false,
        ]);

        $role = Role::where('enforce_single_session', true)->firstOrFail();
        $user->roles()->attach($role->id, [
            'organization_id' => null,
            'unit_id' => null,
            'is_active' => true,
            'assigned_at' => now(),
        ]);

        return $user;
    }

    private function mobileDevice(string $deviceId): array
    {
        return ['device_type' => 'android', 'device_name' => 'Test Phone', 'device_id' => $deviceId];
    }

    public function test_relogin_from_same_device_does_not_terminate_its_own_session(): void
    {
        $user = $this->makeSingleSessionUser();

        $first = $this->auth->login($user->samar_id, 'password', $this->mobileDevice('device-A'));
        $this->auth->login($user->samar_id, 'password', $this->mobileDevice('device-A'));

        $firstSession = Session::where('token', $first['access_token'])->where('token_type', 'access')->first();

        $this->assertNotNull($firstSession);
        $this->assertTrue($firstSession->is_active, 'Same-device re-login must not terminate its own prior session.');
        $this->assertNull($firstSession->termination_reason);
    }

    public function test_login_from_a_different_device_terminates_the_other_session(): void
    {
        $user = $this->makeSingleSessionUser();

        $first = $this->auth->login($user->samar_id, 'password', $this->mobileDevice('device-A'));
        $this->auth->login($user->samar_id, 'password', $this->mobileDevice('device-B'));

        $firstSession = Session::where('token', $first['access_token'])->where('token_type', 'access')->first();

        $this->assertNotNull($firstSession);
        $this->assertFalse($firstSession->is_active, 'A genuinely different device must displace the first session.');
        $this->assertSame('new_session', $firstSession->termination_reason);
    }

    public function test_device_id_is_persisted_on_the_session(): void
    {
        $user = $this->makeSingleSessionUser();

        $res = $this->auth->login($user->samar_id, 'password', $this->mobileDevice('device-XYZ'));

        $session = Session::where('token', $res['access_token'])->where('token_type', 'access')->first();

        $this->assertSame('device-XYZ', $session->device_id);
    }
}
