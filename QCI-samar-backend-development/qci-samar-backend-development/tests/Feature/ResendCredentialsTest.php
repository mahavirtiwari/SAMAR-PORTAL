<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use App\Services\Notification\NotificationService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Mockery;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * "Resend password" issues a new temporary password and emails it with the
 * user's role invitation; the old password stops working.
 */
class ResendCredentialsTest extends TestCase
{
    use RefreshDatabase;

    /** @var array<int, array{template: string, data: array<string, mixed>}> */
    private array $sent = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);

        $notifications = Mockery::mock(NotificationService::class);
        $notifications->shouldReceive('send')->andReturnUsing(function ($to, $template, $data) {
            $this->sent[] = ['template' => $template, 'data' => $data];

            return [];
        });
        $this->app->instance(NotificationService::class, $notifications);
    }

    private function userWithRole(string $slug, array $attributes = []): User
    {
        $user = User::factory()->create($attributes + ['password' => Hash::make('OldPass1')]);
        $user->roles()->attach(Role::where('slug', $slug)->firstOrFail()->id, ['is_active' => true, 'assigned_at' => now()]);

        return $user;
    }

    public function test_system_admin_resends_a_new_password_by_email(): void
    {
        $admin = $this->userWithRole(Role::SYSTEM_ADMIN);
        $manager = $this->userWithRole(Role::OPERATIONS_MANAGER, ['status' => 'active']);

        $this->postJson("/api/v1/users/{$manager->id}/resend-credentials", [], ['Authorization' => 'Bearer '.JWTAuth::fromUser($admin)])
            ->assertOk();

        $this->assertCount(1, $this->sent);
        $this->assertSame('operations-manager-invitation', $this->sent[0]['template']);
        $newPassword = $this->sent[0]['data']['password'];
        $this->assertTrue(Hash::check($newPassword, $manager->fresh()->password));
        $this->assertFalse(Hash::check('OldPass1', $manager->fresh()->password));
    }

    public function test_deactivated_accounts_are_refused(): void
    {
        $admin = $this->userWithRole(Role::SYSTEM_ADMIN);
        $assessor = $this->userWithRole(Role::ASSESSOR, ['status' => 'inactive']);

        $this->postJson("/api/v1/users/{$assessor->id}/resend-credentials", [], ['Authorization' => 'Bearer '.JWTAuth::fromUser($admin)])
            ->assertStatus(422);
        $this->assertSame([], $this->sent);
    }

    public function test_operations_staff_may_resend_only_to_assessors(): void
    {
        $opsAdmin = $this->userWithRole(Role::OPERATIONS_ADMIN);
        $assessor = $this->userWithRole(Role::ASSESSOR, ['status' => 'active']);
        $drdoAdmin = $this->userWithRole(Role::DRDO_ADMIN, ['status' => 'active']);
        $headers = ['Authorization' => 'Bearer '.JWTAuth::fromUser($opsAdmin)];

        $this->postJson("/api/v1/users/{$assessor->id}/resend-credentials", [], $headers)->assertOk();
        $this->postJson("/api/v1/users/{$drdoAdmin->id}/resend-credentials", [], $headers)->assertForbidden();
        $this->postJson("/api/v1/users/{$opsAdmin->id}/resend-credentials", [], $headers)->assertForbidden();
    }
}
