<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Certificate;
use App\Models\Organization;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use App\Services\DashboardService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Nothing ever writes "expired" to certificates.status, so a lapsed certificate must be
 * derived from its validity date wherever it is shown or counted. [BUG-09793]
 */
class CertificateLapsedStatusTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function certificate(Organization $org, string $number, string $validUntil, string $status = 'active'): Certificate
    {
        $unit = Unit::create([
            'organization_id' => $org->id,
            'name' => 'Unit '.$number,
            'address' => 'Plot 1, Industrial Area',
            'state' => 'Haryana',
            'district' => 'Gurugram',
            'pincode' => '122016',
            'unit_type' => 'manufacturing',
            'status' => 'active',
        ]);
        $application = Application::create([
            'organization_id' => $org->id,
            'organization_name' => $org->name ?? 'Org',
            'unit_id' => $unit->id,
            'unit_name' => $unit->name,
            'application_number' => 'SAMAR-APP-'.$number,
            'application_type' => 'new',
            'sector' => 'manufacturing',
            'enterprise_name' => 'Acme Defense',
            'contact_person_name' => 'Jane Doe',
            'contact_person_email' => 'jane@example.com',
            'gst_certificate_file' => 'applications/1/certs/gst.pdf',
            'status' => 'certified',
            'payment_status' => 'success',
            'payment_amount' => 25000,
        ]);

        return Certificate::create([
            'application_id' => $application->id,
            'organization_id' => $org->id,
            'unit_id' => $unit->id,
            'certificate_number' => $number,
            'issue_date' => now()->subYear(),
            'valid_from' => now()->subYear(),
            'valid_until' => $validUntil,
            'status' => $status,
        ]);
    }

    public function test_public_verify_reports_a_lapsed_certificate_as_expired(): void
    {
        $org = Organization::factory()->create();
        $this->certificate($org, 'CERT-LAPSED', now()->subMonth()->toDateString());
        $this->certificate($org, 'CERT-LIVE', now()->addYear()->toDateString());

        $this->getJson('/api/v1/verify-certificate?certificateNumber=CERT-LAPSED')
            ->assertOk()
            ->assertJsonPath('data.valid', false)
            ->assertJsonPath('data.status', 'expired');

        $this->getJson('/api/v1/verify-certificate?certificateNumber=CERT-LIVE')
            ->assertOk()
            ->assertJsonPath('data.valid', true)
            ->assertJsonPath('data.status', 'active');
    }

    public function test_enterprise_dashboard_does_not_count_a_lapsed_certificate(): void
    {
        $org = Organization::factory()->create();
        $this->certificate($org, 'CERT-LAPSED', now()->subMonth()->toDateString());
        $this->certificate($org, 'CERT-LIVE', now()->addYear()->toDateString());

        $admin = User::factory()->create(['organization_id' => $org->id, 'status' => 'active']);
        $role = Role::where('slug', Role::ENTERPRISE_ADMIN)->firstOrFail();
        $admin->roles()->attach($role->id, ['organization_id' => $org->id, 'unit_id' => null, 'is_active' => true, 'assigned_at' => now()]);

        $cards = app(DashboardService::class)->getEnterpriseAdminDashboard($admin)['summary_cards'];
        $tile = collect($cards)->firstWhere('key', 'current_certifications');

        $this->assertSame(1, $tile['value']);
    }

    public function test_last_valid_day_still_counts_as_valid(): void
    {
        $org = Organization::factory()->create();
        $this->certificate($org, 'CERT-LASTDAY', today()->toDateString());

        $this->getJson('/api/v1/verify-certificate?certificateNumber=CERT-LASTDAY')
            ->assertOk()
            ->assertJsonPath('data.valid', true)
            ->assertJsonPath('data.status', 'active');

        $this->assertSame(1, Certificate::active()->count());
        $this->assertSame(0, Certificate::expired()->count());
    }

    public function test_a_renewed_predecessor_is_not_expired(): void
    {
        $org = Organization::factory()->create();
        $this->certificate($org, 'CERT-OLD', today()->subDay()->toDateString(), 'renewed');
        $this->certificate($org, 'CERT-NEW', today()->addYear()->toDateString());

        $this->assertSame(0, Certificate::expired()->count());
        $this->assertSame(1, Certificate::active()->count());
        $this->assertSame('renewed', Certificate::where('certificate_number', 'CERT-OLD')->firstOrFail()->effective_status);
    }
}
