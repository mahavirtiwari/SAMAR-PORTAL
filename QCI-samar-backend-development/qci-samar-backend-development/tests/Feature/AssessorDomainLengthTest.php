<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/** Assessor domain names may be up to 1000 characters long. */
class AssessorDomainLengthTest extends TestCase
{
    use RefreshDatabase;

    private function adminToken(): string
    {
        $this->seed(RoleSeeder::class);
        $admin = User::factory()->create();
        $admin->roles()->attach(
            Role::where('slug', Role::SYSTEM_ADMIN)->firstOrFail()->id,
            ['is_active' => true, 'assigned_at' => now()],
        );

        return JWTAuth::fromUser($admin);
    }

    public function test_a_1000_character_domain_is_saved_and_a_longer_one_refused(): void
    {
        $token = $this->adminToken();
        $url = '/api/v1/master-data/assessor-domains';

        $long = str_repeat('Solid Propulsion Technologies, ', 40);
        $this->withToken($token)->postJson($url, ['domainName' => substr($long, 0, 1000)])->assertCreated();
        $this->assertDatabaseHas('assessor_domains', ['domain_name' => substr($long, 0, 1000)]);

        $this->withToken($token)->postJson($url, ['domainName' => str_repeat('x', 1001)])->assertStatus(400);
    }
}
