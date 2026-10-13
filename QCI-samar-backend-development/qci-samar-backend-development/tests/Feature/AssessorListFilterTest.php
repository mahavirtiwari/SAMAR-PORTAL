<?php

namespace Tests\Feature;

use App\Models\AssessorDomain;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * Covers the SAMAR ID and assessor-domain filters on GET /api/v1/users
 * (System Admin -> User Management -> Assessors). [TASK-05714]
 */
class AssessorListFilterTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function tokenFor(User $user): string
    {
        return JWTAuth::fromUser($user);
    }

    private function assignRole(User $user, string $slug): void
    {
        $role = Role::where('slug', $slug)->firstOrFail();
        $user->roles()->attach($role->id, [
            'is_active' => true,
            'assigned_at' => now(),
        ]);
    }

    private function makeAssessor(string $samarId, ?AssessorDomain $domain = null): User
    {
        $user = User::factory()->create(['samar_id' => $samarId]);
        $this->assignRole($user, Role::ASSESSOR);
        if ($domain) {
            $user->assessorDomains()->attach($domain->id);
        }

        return $user;
    }

    /** Pull the samarId values out of the listing response. */
    private function samarIds($response): array
    {
        return array_map(
            fn ($row) => $row['samarId'] ?? null,
            $response->json('data')
        );
    }

    private function systemAdminToken(): string
    {
        $admin = User::factory()->create();
        $this->assignRole($admin, Role::SYSTEM_ADMIN);

        return $this->tokenFor($admin);
    }

    public function test_domain_filter_returns_only_assessors_in_that_domain(): void
    {
        $manufacturing = AssessorDomain::create(['domain_name' => 'Manufacturing', 'is_active' => true]);
        $service = AssessorDomain::create(['domain_name' => 'Service', 'is_active' => true]);

        $this->makeAssessor('SAMAR-MFG-001', $manufacturing);
        $this->makeAssessor('SAMAR-SVC-002', $service);
        $this->makeAssessor('SAMAR-NON-003', null);

        $response = $this->withToken($this->systemAdminToken())
            ->getJson("/api/v1/users?role=assessor&domainId={$manufacturing->id}");

        $response->assertOk();
        $this->assertSame(['SAMAR-MFG-001'], $this->samarIds($response));
    }

    public function test_samar_id_filter_is_a_partial_match(): void
    {
        $this->makeAssessor('SAMAR-MFG-001');
        $this->makeAssessor('SAMAR-SVC-002');

        $response = $this->withToken($this->systemAdminToken())
            ->getJson('/api/v1/users?role=assessor&samarId=MFG');

        $response->assertOk();
        $this->assertSame(['SAMAR-MFG-001'], $this->samarIds($response));
    }

    public function test_samar_id_and_domain_filters_combine(): void
    {
        $manufacturing = AssessorDomain::create(['domain_name' => 'Manufacturing', 'is_active' => true]);
        $service = AssessorDomain::create(['domain_name' => 'Service', 'is_active' => true]);

        $this->makeAssessor('SAMAR-MFG-001', $manufacturing);
        $this->makeAssessor('SAMAR-SVC-002', $service);

        $token = $this->systemAdminToken();

        // Matching combination -> the one assessor.
        $match = $this->withToken($token)
            ->getJson("/api/v1/users?role=assessor&samarId=MFG&domainId={$manufacturing->id}");
        $match->assertOk();
        $this->assertSame(['SAMAR-MFG-001'], $this->samarIds($match));

        // SAMAR ID and domain point at different assessors -> no rows.
        $none = $this->withToken($token)
            ->getJson("/api/v1/users?role=assessor&samarId=SVC&domainId={$manufacturing->id}");
        $none->assertOk();
        $this->assertSame([], $this->samarIds($none));
    }

    public function test_no_filters_returns_all_assessors(): void
    {
        $this->makeAssessor('SAMAR-MFG-001');
        $this->makeAssessor('SAMAR-SVC-002');
        $this->makeAssessor('SAMAR-NON-003');

        $response = $this->withToken($this->systemAdminToken())
            ->getJson('/api/v1/users?role=assessor');

        $response->assertOk();
        $this->assertEqualsCanonicalizing(
            ['SAMAR-MFG-001', 'SAMAR-SVC-002', 'SAMAR-NON-003'],
            $this->samarIds($response)
        );
    }
}
