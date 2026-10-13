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
 * BUG-09215: rotating the refresh token must not end the access token the
 * client is still using. Requests already on the wire carry the previous access
 * token; ending its row answered them with SESSION_TERMINATED and the mobile app
 * logged the assessor out mid-assessment. Only refresh rows rotate; the previous
 * access row runs to its own expiry, and a login from another device still
 * displaces it.
 */
class TokenRefreshKeepsAccessRowTest extends TestCase
{
    use RefreshDatabase;

    private AuthService $auth;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->auth = app(AuthService::class);
    }

    private function makeAssessor(): User
    {
        $user = User::factory()->create([
            'organization_id' => null,
            'status' => 'active',
            'is_two_factor_enabled' => false,
        ]);

        $role = Role::where('slug', Role::ASSESSOR)->firstOrFail();
        $user->roles()->attach($role->id, [
            'organization_id' => null,
            'unit_id' => null,
            'is_active' => true,
            'assigned_at' => now(),
        ]);

        return $user;
    }

    private function loginOnAndroid(User $user, string $deviceId): array
    {
        return $this->auth->login($user->samar_id, 'password', [
            'device_type' => 'android',
            'device_name' => 'Test phone',
            'device_id' => $deviceId,
        ]);
    }

    public function test_refresh_rotates_the_refresh_row_but_leaves_the_access_row_usable(): void
    {
        $user = $this->makeAssessor();
        $login = $this->loginOnAndroid($user, 'device-a');

        $rotated = $this->auth->refreshToken($login['refresh_token']);

        $oldRefresh = Session::where('token', $login['refresh_token'])->firstOrFail();
        $this->assertFalse((bool) $oldRefresh->is_active, 'the presented refresh token must be retired');

        $oldAccess = Session::where('token', $login['access_token'])->firstOrFail();
        $this->assertTrue((bool) $oldAccess->is_active, 'the previous access row must stay active until it expires');

        foreach ([$rotated['access_token'], $rotated['refresh_token']] as $token) {
            $row = Session::where('token', $token)->firstOrFail();
            $this->assertTrue((bool) $row->is_active);
            $this->assertSame('device-a', $row->device_id, 'rotated rows must keep the device id');
        }

        $this->withHeader('Authorization', 'Bearer '.$login['access_token'])
            ->getJson('/api/v1/auth/me')
            ->assertOk();

        $this->withHeader('Authorization', 'Bearer '.$rotated['access_token'])
            ->getJson('/api/v1/auth/me')
            ->assertOk();
    }

    public function test_a_rotated_refresh_token_cannot_be_replayed(): void
    {
        $user = $this->makeAssessor();
        $login = $this->loginOnAndroid($user, 'device-a');

        $this->auth->refreshToken($login['refresh_token']);

        $this->expectExceptionMessage('Invalid or expired refresh token.');
        $this->auth->refreshToken($login['refresh_token']);
    }

    public function test_a_login_from_another_device_still_ends_the_previous_access_row(): void
    {
        $user = $this->makeAssessor();
        $login = $this->loginOnAndroid($user, 'device-a');
        $rotated = $this->auth->refreshToken($login['refresh_token']);

        $this->loginOnAndroid($user, 'device-b');

        foreach ([$login['access_token'], $rotated['access_token']] as $token) {
            $row = Session::where('token', $token)->firstOrFail();
            $this->assertFalse((bool) $row->is_active);
            $this->assertSame('new_session', $row->termination_reason);
        }

        $response = $this->withHeader('Authorization', 'Bearer '.$rotated['access_token'])
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);
        // The response middleware camel-cases keys, so the code arrives as errorCode.
        $this->assertSame('SESSION_TERMINATED', $response->json('errorCode') ?? $response->json('error_code'));
    }
}
