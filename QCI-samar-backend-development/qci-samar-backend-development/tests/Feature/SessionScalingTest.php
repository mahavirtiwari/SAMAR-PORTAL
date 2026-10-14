<?php

namespace Tests\Feature;

use App\Models\EmailNotificationEvent;
use App\Models\Session;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Session lookups go through an indexed token hash, activity writes are
 * throttled, and ended sessions / old email records are pruned.
 */
class SessionScalingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function makeSession(User $user, array $overrides = []): Session
    {
        return Session::create($overrides + [
            'session_id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'token' => 'token-'.Str::random(40),
            'token_type' => 'access',
            'expires_at' => now()->addHour(),
            'is_active' => true,
        ]);
    }

    public function test_the_token_hash_is_stored_and_used_for_lookups(): void
    {
        $user = User::factory()->create();
        $session = $this->makeSession($user, ['token' => 'abc.def.ghi']);

        $this->assertSame(hash('sha256', 'abc.def.ghi'), $session->token_hash);
        $this->assertTrue(Session::forToken('abc.def.ghi')->whereKey($session->id)->exists());
        $this->assertFalse(Session::forToken('abc.def.ghx')->exists());
    }

    public function test_activity_is_written_at_most_once_a_minute(): void
    {
        $user = User::factory()->create();
        $session = $this->makeSession($user, ['last_activity_at' => now()->subSeconds(10)]);
        $before = $session->last_activity_at->toDateTimeString();

        $session->updateActivity();
        $this->assertSame($before, $session->fresh()->last_activity_at->toDateTimeString());

        $this->travel(2)->minutes();
        $session->updateActivity();
        $this->assertTrue($session->fresh()->last_activity_at->gt(now()->subSeconds(5)));
    }

    public function test_prune_deletes_old_ended_sessions_and_email_records_only(): void
    {
        $user = User::factory()->create();
        $live = $this->makeSession($user);
        $ended = $this->makeSession($user, ['is_active' => false]);
        $recentlyEnded = $this->makeSession($user, ['is_active' => false]);
        Session::whereKey($ended->id)->update(['updated_at' => now()->subDays(10)]);

        $oldEmail = EmailNotificationEvent::forceCreate($this->emailRow());
        $newEmail = EmailNotificationEvent::forceCreate($this->emailRow());
        EmailNotificationEvent::whereKey($oldEmail->id)->update(['created_at' => now()->subDays(200)]);

        $this->artisan('records:prune-stale')->assertSuccessful();

        $this->assertModelExists($live);
        $this->assertModelExists($recentlyEnded);
        $this->assertModelMissing($ended);
        $this->assertModelExists($newEmail);
        $this->assertModelMissing($oldEmail);
    }

    private function emailRow(): array
    {
        return ['event' => 'application.submitted', 'recipient_email' => 'ops@example.org', 'status' => 'sent'];
    }
}
