<?php

namespace Tests\Feature;

use App\Providers\AppServiceProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Auth limits are per account + IP: one person retrying is throttled, while
 * colleagues behind the same office IP (NAT) keep their own budget.
 */
class RateLimitKeyingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // A developer's local .env may switch rate limiting off; register the real
        // limiters regardless.
        config(['app.rate_limits.enabled' => true]);
        $configure = new \ReflectionMethod(AppServiceProvider::class, 'configureRateLimiting');
        $configure->invoke(new AppServiceProvider($this->app));
    }

    private function login(string $samarId)
    {
        return $this->postJson('/api/v1/auth/login', ['samarId' => $samarId, 'password' => 'wrong-password']);
    }

    public function test_one_account_is_throttled_without_blocking_others_on_the_same_ip(): void
    {
        config(['app.rate_limits.login' => 2]);

        $this->assertNotSame(429, $this->login('SAMAR-010126-101')->status());
        $this->assertNotSame(429, $this->login('SAMAR-010126-101')->status());
        $this->login('SAMAR-010126-101')->assertStatus(429);

        // A colleague on the same IP is unaffected.
        $this->assertNotSame(429, $this->login('SAMAR-010126-102')->status());
    }

    public function test_the_per_ip_ceiling_still_stops_flooding(): void
    {
        config(['app.rate_limits.login' => 100, 'app.rate_limits.login_ip_ceiling' => 3]);

        foreach (['SAMAR-010126-201', 'SAMAR-010126-202', 'SAMAR-010126-203'] as $id) {
            $this->assertNotSame(429, $this->login($id)->status());
        }
        $this->login('SAMAR-010126-204')->assertStatus(429);
    }
}
