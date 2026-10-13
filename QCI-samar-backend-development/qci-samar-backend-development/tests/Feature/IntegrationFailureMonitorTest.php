<?php

namespace Tests\Feature;

use App\Exceptions\ErrorReporter;
use App\Models\ErrorLog;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * TASK-05863 — Integration Failures monitor. A read-only System-Admin feed of
 * the third-party API and system-job failures already captured to error_logs,
 * grouped under friendly categories. Internal HTTP page errors are excluded and
 * the developer-only fields (exception class, stack trace, severity, status)
 * are never surfaced.
 */
class IntegrationFailureMonitorTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        config(['error_logging.enabled' => true, 'error_logging.min_severity' => 'error']);
    }

    private function systemAdmin(): User
    {
        $user = User::factory()->create(['organization_id' => null, 'status' => 'active']);
        $role = Role::where('slug', Role::SYSTEM_ADMIN)->firstOrFail();
        $user->roles()->attach($role->id, [
            'organization_id' => null,
            'unit_id' => null,
            'is_active' => true,
            'assigned_at' => now(),
        ]);

        return $user;
    }

    private function capture(string $source, string $message = 'something failed'): void
    {
        app(ErrorReporter::class)->captureException(
            new \RuntimeException($message),
            $source,
            [],
            ErrorLog::SEVERITY_ERROR
        );
    }

    public function test_lists_only_integration_and_system_job_sources_excluding_internal_errors(): void
    {
        $this->capture('payment');
        $this->capture('business_central');
        $this->capture('email');
        $this->capture('scheduler');
        $this->capture('queue');
        // Internal failures that must NOT surface on this ops screen.
        $this->capture('http');
        $this->capture('database');

        $token = JWTAuth::fromUser($this->systemAdmin());

        $response = $this->withToken($token)
            ->getJson('/api/v1/admin/integration-failures')
            ->assertOk();

        $categories = collect($response->json('data'))->pluck('category')->all();

        $this->assertCount(5, $categories);
        $this->assertEqualsCanonicalizing(
            ['Payment Gateway', 'ERP', 'Email Delivery', 'System Job', 'System Job'],
            $categories
        );
    }

    public function test_category_filter_narrows_to_the_mapped_sources(): void
    {
        $this->capture('scheduler');
        $this->capture('queue');
        $this->capture('payment');

        $token = JWTAuth::fromUser($this->systemAdmin());

        $rows = $this->withToken($token)
            ->getJson('/api/v1/admin/integration-failures?category=system_job')
            ->assertOk()
            ->json('data');

        $this->assertCount(2, $rows);
        $this->assertSame(['System Job', 'System Job'], collect($rows)->pluck('category')->all());
    }

    public function test_per_page_query_param_limits_the_page_size(): void
    {
        foreach (range(1, 12) as $i) {
            $this->capture('payment', "failure {$i}");
        }

        $token = JWTAuth::fromUser($this->systemAdmin());

        // Frontend sends camelCase ?perPage; the snake_case middleware rewrites it
        // to per_page before the controller runs. Guards BUG-06571 — the page size
        // must follow the request, not silently fall back to the default 15.
        $response = $this->withToken($token)
            ->getJson('/api/v1/admin/integration-failures?perPage=5')
            ->assertOk();

        $this->assertCount(5, $response->json('data'));
        $this->assertSame(5, $response->json('pagination.perPage'));
        $this->assertSame(12, $response->json('pagination.total'));
        $this->assertSame(3, $response->json('pagination.lastPage'));
    }

    public function test_per_page_above_the_max_is_rejected(): void
    {
        $token = JWTAuth::fromUser($this->systemAdmin());

        $this->withToken($token)
            ->getJson('/api/v1/admin/integration-failures?perPage=500')
            ->assertStatus(422);
    }

    public function test_row_exposes_only_the_four_operations_columns(): void
    {
        $this->capture('payment', 'cURL error 28: Operation timed out');

        $token = JWTAuth::fromUser($this->systemAdmin());

        $row = $this->withToken($token)
            ->getJson('/api/v1/admin/integration-failures')
            ->assertOk()
            ->json('data.0');

        $this->assertSame('Payment Gateway', $row['category']);
        $this->assertSame('cURL error 28: Operation timed out', $row['details']);
        $this->assertStringStartsWith('ERR-', $row['referenceId']);
        $this->assertArrayHasKey('occurredAt', $row);

        // Developer-only fields are never leaked to ops.
        $this->assertArrayNotHasKey('exceptionClass', $row);
        $this->assertArrayNotHasKey('severity', $row);
        $this->assertArrayNotHasKey('status', $row);
        $this->assertArrayNotHasKey('stackTrace', $row);
    }

    public function test_categories_endpoint_returns_the_four_friendly_categories(): void
    {
        $token = JWTAuth::fromUser($this->systemAdmin());

        $categories = $this->withToken($token)
            ->getJson('/api/v1/admin/integration-failures/categories')
            ->assertOk()
            ->json('data');

        $this->assertSame(
            [
                ['key' => 'payment', 'label' => 'Payment Gateway'],
                ['key' => 'erp', 'label' => 'ERP'],
                ['key' => 'email', 'label' => 'Email Delivery'],
                ['key' => 'system_job', 'label' => 'System Job'],
            ],
            $categories
        );
    }

    public function test_unknown_category_is_rejected(): void
    {
        $token = JWTAuth::fromUser($this->systemAdmin());

        $this->withToken($token)
            ->getJson('/api/v1/admin/integration-failures?category=nope')
            ->assertStatus(422);
    }

    public function test_endpoints_are_forbidden_for_non_system_admin(): void
    {
        $user = User::factory()->create(['status' => 'active']);
        $role = Role::where('slug', Role::OPERATIONS_MANAGER)->firstOrFail();
        $user->roles()->attach($role->id, [
            'organization_id' => null,
            'unit_id' => null,
            'is_active' => true,
            'assigned_at' => now(),
        ]);
        $token = JWTAuth::fromUser($user);

        $this->withToken($token)
            ->getJson('/api/v1/admin/integration-failures')
            ->assertForbidden();

        $this->withToken($token)
            ->getJson('/api/v1/admin/integration-failures/categories')
            ->assertForbidden();
    }
}
