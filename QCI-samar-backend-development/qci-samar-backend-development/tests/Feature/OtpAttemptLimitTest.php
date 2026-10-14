<?php

namespace Tests\Feature;

use App\Models\PendingLoginSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Requesting a fresh OTP must not hand out a fresh set of guesses: the
 * 5-attempt lock has to hold across resends, or a 6-digit code can be
 * brute-forced 4 guesses at a time.
 */
class OtpAttemptLimitTest extends TestCase
{
    use RefreshDatabase;

    private function wrongCode(string $otp): string
    {
        return $otp === '000000' ? '111111' : '000000';
    }

    public function test_resending_a_user_otp_does_not_reset_the_attempt_count(): void
    {
        $user = User::factory()->create();
        $otp = $user->generateOtp();

        for ($i = 0; $i < 4; $i++) {
            $this->assertFalse($user->verifyOtp($this->wrongCode($otp)));
        }

        $otp = $user->generateOtp();
        $this->assertFalse($user->verifyOtp($this->wrongCode($otp)));

        $user->refresh();
        $this->assertSame(5, $user->otp_attempts);
        $this->assertNotNull($user->otp_locked_until, 'The fifth wrong guess must lock, resend or not.');
        $this->assertFalse($user->verifyOtp($otp), 'A locked account rejects even the right code.');
    }

    public function test_a_user_gets_a_new_round_of_attempts_once_the_lock_expires(): void
    {
        $user = User::factory()->create();
        $otp = $user->generateOtp();
        for ($i = 0; $i < 5; $i++) {
            $user->verifyOtp($this->wrongCode($otp));
        }

        $this->travel(31)->minutes();
        $otp = $user->refresh()->generateOtp();

        $this->assertTrue($user->verifyOtp($otp));
        $user->refresh();
        $this->assertSame(0, $user->otp_attempts);
        $this->assertNull($user->otp_locked_until);
    }

    public function test_resending_a_login_otp_neither_resets_attempts_nor_lifts_a_lock(): void
    {
        $session = PendingLoginSession::create([
            'user_id' => User::factory()->create()->id,
            'session_token' => Str::random(64),
            'otp_code' => '',
            'otp_expires_at' => now()->addMinutes(10),
            'otp_attempts' => 0,
            'resend_count' => 0,
            'expires_at' => now()->addMinutes(30),
        ]);
        $otp = $session->generateOtp();
        for ($i = 0; $i < 5; $i++) {
            $session->verifyOtp($this->wrongCode($otp));
        }
        $this->assertTrue($session->refresh()->isLocked());

        $otp = $session->generateOtp();

        $this->assertTrue($session->refresh()->isLocked(), 'A resend must not lift the lock.');
        $this->assertFalse($session->verifyOtp($otp));
    }
}
