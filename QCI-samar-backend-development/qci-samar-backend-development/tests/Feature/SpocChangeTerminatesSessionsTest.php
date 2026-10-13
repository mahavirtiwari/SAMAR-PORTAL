<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\Role;
use App\Models\Session;
use App\Models\Unit;
use App\Models\User;
use App\Services\UserService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * Handing a unit to a new SPOC re-issues the account's credentials, so the previous
 * holder's live sessions must end at the same moment; otherwise they keep acting on
 * the unit until their token expires. [BUG-09743]
 */
class SpocChangeTerminatesSessionsTest extends TestCase
{
    use RefreshDatabase;

    private UserService $users;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->users = app(UserService::class);
    }

    private function unitWithAdmin(): array
    {
        $org = Organization::factory()->create();
        $unit = Unit::create([
            'organization_id' => $org->id,
            'name' => 'Unit',
            'address' => 'Addr',
            'state' => 'State',
            'district' => 'District',
            'pincode' => '110011',
            'unit_type' => 'manufacturing',
            'status' => 'active',
        ]);
        $admin = User::factory()->create(['organization_id' => $org->id, 'status' => 'active']);
        $role = Role::where('slug', Role::UNIT_ADMIN)->firstOrFail();
        $admin->roles()->attach($role->id, [
            'organization_id' => $org->id,
            'unit_id' => $unit->id,
            'is_active' => true,
            'assigned_at' => now(),
        ]);

        $tokens = ['access' => JWTAuth::fromUser($admin), 'refresh' => 'refresh-token'];
        foreach ($tokens as $type => $token) {
            Session::create([
                'session_id' => "sess-{$type}",
                'user_id' => $admin->id,
                'token' => $token,
                'token_type' => $type,
                'expires_at' => now()->addDay(),
                'device_type' => 'web',
                'is_active' => true,
                'started_at' => now(),
            ]);
        }

        return [$unit, $admin, $tokens['access']];
    }

    private function activeSessionCount(User $user): int
    {
        return Session::where('user_id', $user->id)->where('is_active', true)->count();
    }

    public function test_change_spoke_ends_every_live_session_of_the_old_spoc(): void
    {
        [$unit, $admin] = $this->unitWithAdmin();

        $this->users->changeSpoke($unit, ['email' => 'new.spoc@example.com', 'name' => 'New Spoc']);

        $this->assertSame(0, $this->activeSessionCount($admin));
        $this->assertSame(
            ['spoc_changed', 'spoc_changed'],
            Session::where('user_id', $admin->id)->pluck('termination_reason')->all()
        );
    }

    public function test_contact_email_change_ends_the_old_sessions(): void
    {
        [$unit, $admin] = $this->unitWithAdmin();

        $this->users->updateUnitAdminContactPerson($unit->id, $unit->organization_id, ['email' => 'new.contact@example.com']);

        $this->assertSame(0, $this->activeSessionCount($admin));
    }

    public function test_contact_update_without_email_change_keeps_the_sessions(): void
    {
        [$unit, $admin] = $this->unitWithAdmin();

        $this->users->updateUnitAdminContactPerson($unit->id, $unit->organization_id, [
            'name' => 'Same Person',
            'mobile' => '9876543210',
            'email' => $admin->email,
        ]);

        $this->assertSame(2, $this->activeSessionCount($admin));
    }

    public function test_terminated_session_is_rejected_with_the_spoc_message(): void
    {
        [$unit, $admin, $accessToken] = $this->unitWithAdmin();
        $this->users->changeSpoke($unit, ['email' => 'new.spoc@example.com']);

        $response = $this->withToken($accessToken)->getJson('/api/v1/auth/me');

        $response->assertStatus(401)
            ->assertJsonPath('errorCode', 'SESSION_TERMINATED')
            ->assertJsonPath('message', 'Your session was terminated because the contact person for this unit was changed.');
    }
}
