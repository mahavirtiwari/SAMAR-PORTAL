<?php

namespace Tests\Feature;

use App\Models\AssessorOffTime;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * The scheduling screen needs every eligible assessor's off-time at once. Asking
 * per assessor cost one request each and exhausted the caller's per-minute
 * allowance, which then refused their unrelated requests too. [BUG-08860]
 */
class AssessorOffTimeBatchTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function assignRole(User $user, string $slug): void
    {
        $role = Role::where('slug', $slug)->firstOrFail();
        $user->roles()->attach($role->id, [
            'is_active' => true,
            'assigned_at' => now(),
        ]);
    }

    private function operationsManagerToken(): string
    {
        $manager = User::factory()->create();
        $this->assignRole($manager, Role::OPERATIONS_MANAGER);

        return JWTAuth::fromUser($manager);
    }

    private function makeAssessorWithOffTime(string $from, string $to): User
    {
        $assessor = User::factory()->create();
        $this->assignRole($assessor, Role::ASSESSOR);

        AssessorOffTime::create([
            'user_id' => $assessor->id,
            'from_date' => $from,
            'to_date' => $to,
        ]);

        return $assessor;
    }

    private function fetchOffTimes(string $query, ?string $token = null): TestResponse
    {
        return $this->getJson(
            '/api/v1/users/off-times?'.$query,
            ['Authorization' => 'Bearer '.($token ?? $this->operationsManagerToken())],
        );
    }

    public function test_one_call_returns_the_off_time_of_every_assessor_asked_for(): void
    {
        $first = $this->makeAssessorWithOffTime('2026-09-10', '2026-09-12');
        $second = $this->makeAssessorWithOffTime('2026-09-20', '2026-09-21');

        $response = $this->fetchOffTimes("userIds[]={$first->id}&userIds[]={$second->id}");

        $response->assertOk();
        $rows = $response->json('data.offTimes');

        $this->assertCount(2, $rows);
        $this->assertEqualsCanonicalizing(
            [$first->id, $second->id],
            array_column($rows, 'userId'),
        );
    }

    public function test_every_row_says_which_assessor_it_belongs_to(): void
    {
        $assessor = $this->makeAssessorWithOffTime('2026-09-10', '2026-09-12');

        $row = $this->fetchOffTimes("userIds[]={$assessor->id}")->json('data.offTimes.0');

        $this->assertSame($assessor->id, $row['userId']);
        $this->assertSame('2026-09-10', $row['fromDate']);
        $this->assertSame('2026-09-12', $row['toDate']);
    }

    public function test_an_assessor_with_no_off_time_simply_contributes_no_rows(): void
    {
        $withOffTime = $this->makeAssessorWithOffTime('2026-09-10', '2026-09-12');
        $free = User::factory()->create();
        $this->assignRole($free, Role::ASSESSOR);

        $rows = $this->fetchOffTimes("userIds[]={$withOffTime->id}&userIds[]={$free->id}")
            ->json('data.offTimes');

        $this->assertCount(1, $rows);
        $this->assertSame($withOffTime->id, $rows[0]['userId']);
    }

    public function test_a_comma_separated_list_is_accepted_too(): void
    {
        $first = $this->makeAssessorWithOffTime('2026-09-10', '2026-09-12');
        $second = $this->makeAssessorWithOffTime('2026-09-20', '2026-09-21');

        $rows = $this->fetchOffTimes("userIds={$first->id},{$second->id}")->json('data.offTimes');

        $this->assertCount(2, $rows);
    }

    public function test_the_request_is_refused_without_any_assessor_ids(): void
    {
        $this->fetchOffTimes('userIds[]=')->assertStatus(422);
    }

    public function test_an_assessor_cannot_read_everyones_off_time(): void
    {
        $assessor = $this->makeAssessorWithOffTime('2026-09-10', '2026-09-12');

        $this->fetchOffTimes("userIds[]={$assessor->id}", JWTAuth::fromUser($assessor))
            ->assertForbidden();
    }
}
