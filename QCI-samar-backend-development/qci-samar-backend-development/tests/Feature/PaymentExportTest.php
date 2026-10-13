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
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * Covers the Payment History CSV export: it downloads the same rows the list is
 * showing, honours the list's filters, and keeps the list's role scoping so an
 * organisation can never export another organisation's payments. [TASK-05937]
 */
class PaymentExportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function tokenForRole(string $slug, ?User $user = null): string
    {
        $user ??= User::factory()->create();
        $user->roles()->attach(
            Role::where('slug', $slug)->firstOrFail()->id,
            ['is_active' => true, 'assigned_at' => now()],
        );

        return JWTAuth::fromUser($user);
    }

    private function makePayment(string $status, array $applicationOverrides = [], ?Organization $organization = null): Payment
    {
        $org = $organization ?? Organization::factory()->create();
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

        $application = Application::create(array_merge([
            'organization_id' => $org->id,
            'organization_name' => $org->name,
            'unit_id' => $unit->id,
            'unit_name' => $unit->name,
            'unit_state' => 'Maharashtra',
            'application_number' => 'SAMAR-APP-'.uniqid(),
            'application_type' => 'new',
            'sector' => 'manufacturing',
            'enterprise_classification' => 'micro',
            'enterprise_name' => 'Acme Defence',
            'contact_person_name' => 'Jane Doe',
            'contact_person_email' => 'jane@example.com',
            'gst_certificate_file' => 'applications/1/certs/gst.pdf',
            'status' => 'in_progress',
            'payment_status' => $status,
        ], $applicationOverrides));

        return Payment::create([
            'payment_type' => 'application_fee',
            'application_id' => $application->id,
            'organization_id' => $org->id,
            'payment_id' => 'PAY-'.uniqid(),
            'order_id' => 'ORD-'.uniqid(),
            'gateway' => 'icici_eazypay',
            'amount' => 25000,
            'net_amount' => 25000,
            'currency' => 'INR',
            'status' => $status,
        ]);
    }

    private function export(string $token, string $query = ''): string
    {
        $response = $this->get(
            '/api/v1/payments/export'.($query ? '?'.$query : ''),
            ['Authorization' => 'Bearer '.$token],
        );

        $response->assertOk();
        $response->assertHeader('Content-Type', 'text/csv; charset=utf-8');

        return $response->streamedContent();
    }

    public function test_the_export_downloads_a_csv_excel_can_open(): void
    {
        $payment = $this->makePayment('success');

        $response = $this->get('/api/v1/payments/export', [
            'Authorization' => 'Bearer '.$this->tokenForRole(Role::SYSTEM_ADMIN),
        ]);

        $response->assertOk();
        $response->assertHeader('Content-Disposition');
        $this->assertStringContainsString('payments_export_', $response->headers->get('Content-Disposition'));

        $csv = $response->streamedContent();
        $this->assertStringStartsWith(chr(0xEF).chr(0xBB).chr(0xBF), $csv, 'The BOM is what makes Excel read it as UTF-8.');
        $this->assertStringContainsString('Application Number', $csv);
        $this->assertStringContainsString($payment->payment_id, $csv);
    }

    public function test_the_export_covers_the_same_rows_as_the_list(): void
    {
        $this->makePayment('success');
        $this->makePayment('failed');
        // Pending payments are not on the list screen, so they are not in the file either.
        $pending = $this->makePayment('pending');

        $csv = $this->export($this->tokenForRole(Role::SYSTEM_ADMIN));

        $this->assertStringNotContainsString($pending->payment_id, $csv);
        $this->assertSame(3, substr_count(trim($csv), "\n") + 1, 'Header plus the two listed payments.');
    }

    public function test_a_filter_narrows_the_exported_rows(): void
    {
        $manufacturing = $this->makePayment('success');
        $service = $this->makePayment('success', ['sector' => 'service']);

        $csv = $this->export($this->tokenForRole(Role::SYSTEM_ADMIN), 'sector=manufacturing');

        $this->assertStringContainsString($manufacturing->payment_id, $csv);
        $this->assertStringNotContainsString($service->payment_id, $csv);
    }

    public function test_an_organisation_only_exports_its_own_payments(): void
    {
        $ownOrg = Organization::factory()->create();
        $mine = $this->makePayment('success', [], $ownOrg);
        $theirs = $this->makePayment('success');

        $enterpriseAdmin = User::factory()->create(['organization_id' => $ownOrg->id]);
        $token = $this->tokenForRole(Role::ENTERPRISE_ADMIN, $enterpriseAdmin);

        $csv = $this->export($token);

        $this->assertStringContainsString($mine->payment_id, $csv);
        $this->assertStringNotContainsString($theirs->payment_id, $csv, 'Cross-organisation rows must never reach the file.');
    }

    public function test_roles_without_payment_access_cannot_export(): void
    {
        $this->makePayment('success');

        foreach ([Role::ASSESSOR, Role::DRDO_LAB] as $slug) {
            $this->get('/api/v1/payments/export', ['Authorization' => 'Bearer '.$this->tokenForRole($slug)])
                ->assertForbidden();
        }
    }

    public function test_an_unusable_date_range_is_refused(): void
    {
        $token = $this->tokenForRole(Role::SYSTEM_ADMIN);

        $this->getJson('/api/v1/payments/export?fromDate=not-a-date', ['Authorization' => 'Bearer '.$token])
            ->assertStatus(422);
        $this->getJson('/api/v1/payments/export?fromDate=2026-08-31&toDate=2026-08-01', ['Authorization' => 'Bearer '.$token])
            ->assertStatus(422);
    }
}
