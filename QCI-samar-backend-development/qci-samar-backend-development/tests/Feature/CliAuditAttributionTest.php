<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Organization;
use App\Models\User;
use App\Support\AuditContext;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * BUG-06320: audit entries written by server-side processes recorded no actor,
 * because the trait resolved one only from the authenticated session.
 */
class CliAuditAttributionTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        AuditContext::clear();
        parent::tearDown();
    }

    private function auditFor(Organization $organization): AuditLog
    {
        return AuditLog::where('auditable_type', Organization::class)
            ->where('auditable_id', $organization->id)
            ->where('event', 'created')
            ->firstOrFail();
    }

    public function test_a_declared_script_is_recorded_as_the_audit_actor(): void
    {
        AuditContext::system('scripts/manual-payment-complete.php', 'Navneet Singh <navneet@webority.com>');

        $organization = Organization::factory()->create();

        $audit = $this->auditFor($organization);

        $this->assertSame('System (CLI)', $audit->user_name);
        $this->assertNull($audit->user_id);
        $this->assertSame('cli', $audit->metadata['actor']['channel']);
        $this->assertSame('scripts/manual-payment-complete.php', $audit->metadata['actor']['script']);
        $this->assertSame('Navneet Singh <navneet@webority.com>', $audit->metadata['actor']['operator']);
    }

    public function test_console_runs_without_a_declared_script_still_get_an_actor(): void
    {
        $organization = Organization::factory()->create();

        $audit = $this->auditFor($organization);

        $this->assertSame('System (Console)', $audit->user_name);
        $this->assertSame('console', $audit->metadata['actor']['channel']);
    }

    public function test_an_authenticated_actor_still_wins_over_the_system_fallback(): void
    {
        AuditContext::system('scripts/manual-payment-complete.php');

        $user = User::factory()->create();
        $this->actingAs($user);

        $organization = Organization::factory()->create();

        $audit = $this->auditFor($organization);

        $this->assertSame($user->id, $audit->user_id);
        $this->assertSame($user->full_name, $audit->user_name);
        $this->assertArrayNotHasKey('actor', $audit->metadata ?? []);
    }
}
