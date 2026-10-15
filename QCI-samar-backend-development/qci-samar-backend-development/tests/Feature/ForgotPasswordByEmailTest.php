<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use App\Services\Email\EmailNotificationService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Mockery;
use Tests\TestCase;

/**
 * Forgot password can start from the registered email. One OTP goes to the
 * inbox; only after it is confirmed are the accounts on that email listed, and
 * the chosen one is reset with the usual reset step.
 */
class ForgotPasswordByEmailTest extends TestCase
{
    use RefreshDatabase;

    /** @var array<int, string> OTPs emailed, in order */
    private array $otps = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);

        $mail = Mockery::mock(EmailNotificationService::class);
        $mail->shouldReceive('sendEmail')->andReturnUsing(function ($user, $template, $data) {
            $this->otps[] = $data['otp_code'];

            return [];
        });
        $this->app->instance(EmailNotificationService::class, $mail);
    }

    private function account(string $samarId, string $role, string $email = 'person@example.com'): User
    {
        $user = User::factory()->create(['samar_id' => $samarId, 'email' => $email, 'status' => 'active', 'password' => Hash::make('OldPass1')]);
        $user->roles()->attach(Role::where('slug', $role)->firstOrFail()->id, ['is_active' => true, 'assigned_at' => now()]);

        return $user;
    }

    public function test_email_with_several_accounts_lists_them_after_the_otp_and_resets_the_chosen_one(): void
    {
        $assessor = $this->account('SAMAR-010126-501', Role::ASSESSOR);
        $manager = $this->account('SAMAR-010126-502', Role::OPERATIONS_MANAGER, 'Person@Example.com');

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'person@example.com'])->assertOk();
        $this->assertCount(1, $this->otps, 'one email for the shared inbox');
        $otp = $this->otps[0];

        $accounts = $this->postJson('/api/v1/auth/verify-password-otp', ['email' => 'person@example.com', 'otp' => $otp])
            ->assertOk()->json('data.accounts');
        $this->assertEqualsCanonicalizing(['SAMAR-010126-501', 'SAMAR-010126-502'], array_column($accounts, 'samarId'));

        $this->postJson('/api/v1/auth/reset-password', [
            'samarId' => 'SAMAR-010126-502', 'otp' => $otp,
            'password' => 'NewPass9', 'passwordConfirmation' => 'NewPass9',
        ])->assertOk();

        $this->assertTrue(Hash::check('NewPass9', $manager->fresh()->password));
        $this->assertTrue(Hash::check('OldPass1', $assessor->fresh()->password), 'the other account is untouched');
    }

    public function test_unknown_email_gets_the_same_reply_and_no_email(): void
    {
        $known = $this->postJson('/api/v1/auth/forgot-password', ['email' => 'nobody@example.com'])->assertOk()->json('message');
        $this->account('SAMAR-010126-503', Role::ASSESSOR);
        $this->otps = [];

        $this->assertSame(
            $known,
            $this->postJson('/api/v1/auth/forgot-password', ['email' => 'person@example.com'])->assertOk()->json('message')
        );
        $this->assertSame([], array_slice($this->otps, 1));
    }

    public function test_wrong_otp_lists_nothing_and_counts_towards_the_lock(): void
    {
        $user = $this->account('SAMAR-010126-504', Role::ASSESSOR);
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'person@example.com'])->assertOk();
        $wrong = $this->otps[0] === '000000' ? '111111' : '000000';

        $this->postJson('/api/v1/auth/verify-password-otp', ['email' => 'person@example.com', 'otp' => $wrong])
            ->assertStatus(400)
            ->assertJsonMissingPath('data.accounts');
        $this->assertSame(1, $user->fresh()->otp_attempts);
    }

    public function test_samar_id_flow_is_unchanged(): void
    {
        $this->account('SAMAR-010126-505', Role::ASSESSOR);

        $this->postJson('/api/v1/auth/forgot-password', ['samarId' => 'SAMAR-010126-505'])->assertOk();
        $this->assertCount(1, $this->otps);
        $this->postJson('/api/v1/auth/forgot-password', [])->assertStatus(400);
    }
}
