<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Auth\AuthService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccountLockoutTest extends TestCase
{
    use RefreshDatabase;

    private AuthService $auth;

    private int $maxAttempts;

    protected function setUp(): void
    {
        parent::setUp();
        $this->auth = app(AuthService::class);
        $this->maxAttempts = (int) config('auth.lockout.max_attempts');
    }

    private function attemptWrongPassword(User $user): void
    {
        try {
            $this->auth->login($user->samar_id, 'wrong-password');
            $this->fail('Login should have rejected the wrong password.');
        } catch (\Exception $e) {
            // expected
        }
    }

    public function test_account_locks_after_max_failed_password_attempts(): void
    {
        $user = User::factory()->create();

        for ($i = 0; $i < $this->maxAttempts; $i++) {
            $this->attemptWrongPassword($user);
        }

        $user->refresh();

        $this->assertSame($this->maxAttempts, $user->failed_login_attempts);
        $this->assertTrue($user->isLocked(), 'Account should be locked after max attempts.');
    }

    public function test_locked_account_rejects_even_the_correct_password(): void
    {
        $user = User::factory()->create();

        for ($i = 0; $i < $this->maxAttempts; $i++) {
            $this->attemptWrongPassword($user);
        }

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Account is locked');

        $this->auth->login($user->samar_id, 'password');
    }

    public function test_account_does_not_lock_before_threshold(): void
    {
        $user = User::factory()->create();

        for ($i = 0; $i < $this->maxAttempts - 1; $i++) {
            $this->attemptWrongPassword($user);
        }

        $user->refresh();

        $this->assertSame($this->maxAttempts - 1, $user->failed_login_attempts);
        $this->assertFalse($user->isLocked(), 'Account must not lock before the threshold.');
    }

    public function test_account_never_locks_when_lockout_disabled(): void
    {
        config(['auth.lockout.enabled' => false]);

        $user = User::factory()->create();

        for ($i = 0; $i < $this->maxAttempts + 2; $i++) {
            $this->attemptWrongPassword($user);
        }

        $user->refresh();

        $this->assertFalse($user->isLocked(), 'Account must not lock while lockout is disabled.');
        $this->assertNull($user->locked_until, 'locked_until must never be set while lockout is disabled.');
    }

    public function test_disabling_lockout_releases_an_already_locked_account(): void
    {
        config(['auth.lockout.enabled' => false]);

        $user = User::factory()->create(['locked_until' => now()->addMinutes(30)]);

        $this->assertFalse($user->isLocked(), 'A pre-existing lock must be ignored while lockout is disabled.');
    }

    public function test_check_active_session_feeds_the_same_lockout_counter(): void
    {
        $user = User::factory()->create();

        for ($i = 0; $i < $this->maxAttempts; $i++) {
            try {
                $this->auth->checkActiveSession($user->samar_id, 'wrong-password');
                $this->fail('checkActiveSession should have rejected the wrong password.');
            } catch (\Exception $e) {
                // expected
            }
        }

        $user->refresh();

        $this->assertSame($this->maxAttempts, $user->failed_login_attempts);
        $this->assertTrue($user->isLocked(), 'Failures on check-active-session must arm the same lock.');
    }
}
