<?php

namespace Tests\Feature;

use App\Models\Discipline;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * Replays the two probes left Open in the ITQCR round 3 audit of 21-Sep-2026:
 * a user named with script tags (finding 3) and a discipline named with a
 * spreadsheet formula that the CSV export then hands to Excel (finding 5).
 */
class SecurityAuditRound3Test extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function tokenForRole(string $slug): string
    {
        $user = User::factory()->create();
        $role = Role::where('slug', $slug)->firstOrFail();
        $user->roles()->attach($role->id, ['is_active' => true, 'assigned_at' => now()]);

        return JWTAuth::fromUser($user);
    }

    private function csvRows($response): array
    {
        $content = ltrim($response->streamedContent(), "\xEF\xBB\xBF");
        $lines = array_filter(explode("\n", str_replace("\r", '', trim($content))), fn ($l) => $l !== '');

        return array_map(fn ($l) => str_getcsv($l, ',', '"', ''), array_values($lines));
    }

    public function test_user_creation_rejects_markup_in_names(): void
    {
        $response = $this->withToken($this->tokenForRole(Role::SYSTEM_ADMIN))
            ->postJson('/api/v1/users', [
                'firstName' => 'Test<script>alert(1)</script>Testy',
                'lastName' => 'Test<script>alert(1)</script>Testy',
                'email' => 'probe@example.com',
                'mobileNumber' => '9876543210',
                'roles' => [['slug' => Role::DRDO_LAB]],
            ]);

        $response->assertStatus(422);
        $this->assertArrayHasKey('firstName', $response->json('errors'));
        $this->assertArrayHasKey('lastName', $response->json('errors'));
        $this->assertDatabaseMissing('users', ['email' => 'probe@example.com']);
    }

    public function test_user_update_rejects_markup_in_names(): void
    {
        $target = User::factory()->create();

        $response = $this->withToken($this->tokenForRole(Role::SYSTEM_ADMIN))
            ->putJson("/api/v1/users/{$target->id}", [
                'firstName' => '<img src=x onerror=alert(1)>',
            ]);

        $response->assertStatus(422);
        $this->assertArrayHasKey('firstName', $response->json('errors'));
    }

    public function test_discipline_creation_rejects_formula_names(): void
    {
        $token = $this->tokenForRole(Role::SYSTEM_ADMIN);

        foreach (['=SUM(1+1)', '+SUM(1+1)', '-1+1', '@SUM(A1)'] as $probe) {
            $response = $this->withToken($token)
                ->postJson('/api/v1/disciplines', ['name' => $probe, 'sector' => 'manufacturing']);

            $response->assertStatus(422);
            $this->assertArrayHasKey('name', $response->json('errors'), "Accepted '{$probe}'");
        }

        $this->assertSame(0, Discipline::count());
    }

    public function test_discipline_export_neutralizes_formula_names_already_stored(): void
    {
        Discipline::create(['name' => '=SUM(1+1)', 'sector' => 'manufacturing', 'is_active' => true]);
        Discipline::create(['name' => 'Customer Experience', 'sector' => 'manufacturing', 'is_active' => true]);

        $response = $this->withToken($this->tokenForRole(Role::SYSTEM_ADMIN))
            ->get('/api/v1/disciplines/export');

        $response->assertOk();
        $names = array_map(fn ($row) => $row[1], array_slice($this->csvRows($response), 1));

        $this->assertContains("'=SUM(1+1)", $names);
        $this->assertContains('Customer Experience', $names);
        $this->assertNotContains('=SUM(1+1)', $names);
    }
}
