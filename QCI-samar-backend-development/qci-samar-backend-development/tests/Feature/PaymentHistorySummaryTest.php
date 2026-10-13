<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * Payment History returns successful and failed totals for the whole filtered set, and
 * a From/To date range narrows both the list and those totals together. [TASK-08026]
 */
class PaymentHistorySummaryTest extends TestCase
{
    use RefreshDatabase;

    private Application $application;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);

        $org = Organization::factory()->create();
        $unit = Unit::create([
            'organization_id' => $org->id,
            'name' => 'Pune Plant',
            'address' => 'Plot 1, Industrial Area',
            'state' => 'Maharashtra',
            'district' => 'Pune',
            'pincode' => '411001',
            'unit_type' => 'manufacturing',
            'status' => 'active',
        ]);

        $this->application = Application::create([
            'organization_id' => $org->id,
            'organization_name' => $org->name,
            'unit_id' => $unit->id,
            'unit_name' => $unit->name,
            'unit_state' => 'Maharashtra',
            'application_number' => 'SAMAR-APP-'.uniqid(),
            'application_type' => 'new',
            'sector' => 'manufacturing',
            'enterprise_name' => 'Acme Defence',
            'contact_person_name' => 'Jane Doe',
            'contact_person_email' => 'jane@example.com',
            'gst_certificate_file' => 'applications/1/certs/gst.pdf',
            'status' => 'in_progress',
            'payment_status' => 'success',
            'payment_amount' => 25000,
        ]);
    }

    private function makePayment(string $status, string $createdAt): Payment
    {
        $payment = Payment::create([
            'payment_type' => 'application_fee',
            'application_id' => $this->application->id,
            'organization_id' => $this->application->organization_id,
            'payment_id' => 'PAY-'.uniqid(),
            'order_id' => 'ORD-'.uniqid(),
            'gateway' => 'icici',
            'amount' => 25000,
            'net_amount' => 25000,
            'currency' => 'INR',
            'status' => $status,
        ]);

        // created_at is what the range filters and the list orders by, so it has to be
        // set explicitly rather than left at "now".
        $payment->forceFill(['created_at' => $createdAt])->save();

        return $payment;
    }

    private function systemAdminToken(): string
    {
        $admin = User::factory()->create();
        $admin->roles()->attach(
            Role::where('slug', Role::SYSTEM_ADMIN)->firstOrFail()->id,
            ['is_active' => true, 'assigned_at' => now()],
        );

        return JWTAuth::fromUser($admin);
    }

    private function listPayments(string $query = ''): TestResponse
    {
        return $this->getJson(
            '/api/v1/payments'.($query ? '?'.$query : ''),
            ['Authorization' => 'Bearer '.$this->systemAdminToken()],
        );
    }

    public function test_the_totals_count_successful_and_failed_payments(): void
    {
        $this->makePayment('success', '2026-08-10 10:00:00');
        $this->makePayment('success', '2026-08-11 10:00:00');
        $this->makePayment('failed', '2026-08-12 10:00:00');

        $response = $this->listPayments();

        $response->assertOk();
        $response->assertJsonPath('summary.successfulCount', 2);
        $response->assertJsonPath('summary.failedCount', 1);
    }

    public function test_a_date_range_narrows_the_totals_and_the_list_together(): void
    {
        $this->makePayment('success', '2026-07-01 10:00:00');
        $this->makePayment('success', '2026-08-10 10:00:00');
        $this->makePayment('failed', '2026-08-12 10:00:00');

        $response = $this->listPayments('fromDate=2026-08-01&toDate=2026-08-31');

        $response->assertOk();
        $response->assertJsonPath('summary.successfulCount', 1);
        $response->assertJsonPath('summary.failedCount', 1);
        $this->assertCount(2, $response->json('data'), 'The list must be narrowed by the same range.');
    }

    public function test_the_range_includes_payments_made_on_the_boundary_dates(): void
    {
        $this->makePayment('success', '2026-08-01 00:30:00');
        $this->makePayment('success', '2026-08-31 23:30:00');

        $response = $this->listPayments('fromDate=2026-08-01&toDate=2026-08-31');

        $response->assertJsonPath('summary.successfulCount', 2);
    }

    public function test_the_totals_describe_the_whole_set_not_the_current_page(): void
    {
        foreach (range(1, 5) as $day) {
            $this->makePayment('success', sprintf('2026-08-%02d 10:00:00', $day));
        }
        $this->makePayment('failed', '2026-08-06 10:00:00');

        $response = $this->listPayments('perPage=2');

        $this->assertCount(2, $response->json('data'), 'Sanity: the page really is smaller than the set.');
        $response->assertJsonPath('summary.successfulCount', 5);
        $response->assertJsonPath('summary.failedCount', 1);
    }

    public function test_an_unusable_date_is_refused_rather_than_silently_ignored(): void
    {
        $this->listPayments('fromDate=not-a-date')->assertStatus(422);
        $this->listPayments('fromDate=2026-08-31&toDate=2026-08-01')->assertStatus(422);
    }

    public function test_an_assessor_still_cannot_read_payments(): void
    {
        $assessor = User::factory()->create();
        $assessor->roles()->attach(
            Role::where('slug', Role::ASSESSOR)->firstOrFail()->id,
            ['is_active' => true, 'assigned_at' => now()],
        );

        $this->getJson('/api/v1/payments', ['Authorization' => 'Bearer '.JWTAuth::fromUser($assessor)])
            ->assertForbidden();
    }
}
