<?php

namespace Tests\Feature;

use App\Contracts\BusinessCentralClientInterface;
use App\Jobs\PushCustomerToBc;
use App\Models\Customer;
use App\Models\ErrorLog;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * BUG-06546 — an exhausted Business Central push must raise CRITICAL once, at the
 * moment it crosses the attempt ceiling, and never be re-alerted afterwards.
 * Previously bc:retry-failed re-logged a CRITICAL for every stuck row on every
 * 30-minute run, so two bad-data rows produced ~48 CRITICALs/day indefinitely.
 */
class BcRetryExhaustionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'error_logging.enabled' => true,
            'error_logging.min_severity' => 'error',
            'services.business_central.max_attempts' => 5,
        ]);
    }

    /**
     * A customer whose payload cannot build (unmapped state) — the same class of
     * data-consistency rejection as the bug, and deterministic without a live BC.
     */
    private function failingCustomer(int $attempts): Customer
    {
        $organization = Organization::factory()->create(['registered_state' => 'Atlantis']);
        $user = User::factory()->create(['organization_id' => $organization->id, 'status' => 'active']);

        return Customer::create([
            'organization_id' => $organization->id,
            'user_id' => $user->id,
            'reference_no' => 'SAMAR-TEST-'.$attempts,
            'bc_sync_status' => 'failed',
            'bc_attempts' => $attempts,
        ]);
    }

    private function runPush(Customer $customer): void
    {
        // isEnabled() must be true to reach the push; the push then fails while
        // building the payload, which is the failure path we exercise.
        $this->mock(BusinessCentralClientInterface::class)
            ->shouldReceive('isEnabled')->andReturn(true);

        (new PushCustomerToBc($customer->id))->handle(app(BusinessCentralClientInterface::class));
    }

    private function criticalCount(): int
    {
        return ErrorLog::where('source', 'business_central')
            ->where('severity', ErrorLog::SEVERITY_CRITICAL)
            ->count();
    }

    public function test_crossing_the_attempt_ceiling_logs_exactly_one_critical(): void
    {
        $customer = $this->failingCustomer(4); // the next attempt is the 5th -> exhausted

        $this->runPush($customer);

        $customer->refresh();
        $this->assertSame('failed', $customer->bc_sync_status);
        $this->assertSame(5, $customer->bc_attempts);

        $critical = ErrorLog::where('source', 'business_central')
            ->where('severity', ErrorLog::SEVERITY_CRITICAL)
            ->get();

        $this->assertCount(1, $critical);
        $this->assertTrue((bool) data_get($critical->first()->context, 'exhausted'));
        $this->assertSame(5, (int) data_get($critical->first()->context, 'attempts'));
    }

    public function test_a_failure_below_the_ceiling_is_error_not_critical(): void
    {
        $customer = $this->failingCustomer(1); // the next attempt is the 2nd -> not exhausted

        $this->runPush($customer);

        $customer->refresh();
        $this->assertSame(2, $customer->bc_attempts);
        $this->assertSame(0, $this->criticalCount());

        $error = ErrorLog::where('source', 'business_central')
            ->where('severity', ErrorLog::SEVERITY_ERROR)
            ->first();
        $this->assertNotNull($error);
        $this->assertFalse((bool) data_get($error->context, 'exhausted'));
    }

    public function test_the_sweep_neither_redispatches_nor_realerts_an_exhausted_row(): void
    {
        $exhausted = $this->failingCustomer(5);  // already at the ceiling
        $retryable = $this->failingCustomer(2);  // below the ceiling

        Queue::fake();
        $this->artisan('bc:retry-failed')->assertSuccessful();

        // Only the below-ceiling row is re-dispatched.
        Queue::assertPushed(PushCustomerToBc::class, 1);
        Queue::assertPushed(
            PushCustomerToBc::class,
            fn (PushCustomerToBc $job) => $job->recordId === $retryable->id
        );

        // The sweep raises no CRITICAL of its own — exhausted rows are surfaced
        // once by the job at the transition, never re-alerted here.
        $this->assertSame(0, $this->criticalCount());
    }
}
