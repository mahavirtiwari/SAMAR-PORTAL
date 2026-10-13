<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Assessment;
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
 * The dashboard Certified card must count the same rows the Certified page lists:
 * assessments with status certified, regardless of certificate validity. [BUG-09762]
 */
class DashboardCertifiedCountTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function userWithRole(string $slug): User
    {
        $user = User::factory()->create();
        $role = Role::where('slug', $slug)->firstOrFail();
        $user->roles()->attach($role->id, ['is_active' => true, 'assigned_at' => now()]);

        return $user;
    }

    private function certifiedAssessment(string $validUntil): void
    {
        $org = Organization::factory()->create();
        $unit = Unit::create([
            'organization_id' => $org->id,
            'name' => 'Test Unit',
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
            'application_number' => 'SAMAR-APP-'.uniqid(),
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
        Assessment::create([
            'application_id' => $application->id,
            'organization_id' => $org->id,
            'unit_id' => $unit->id,
            'status' => Assessment::STATUS_CERTIFIED,
        ]);
        Certificate::create([
            'application_id' => $application->id,
            'organization_id' => $org->id,
            'unit_id' => $unit->id,
            'certificate_number' => 'CERT-'.uniqid(),
            'issue_date' => now()->subYear(),
            'valid_from' => now()->subYear(),
            'valid_until' => $validUntil,
            'status' => 'active',
        ]);
    }

    private function certifiedCard(array $dashboard): int
    {
        foreach ($dashboard['summary_cards'] as $card) {
            if ($card['label'] === 'Certified') {
                return $card['value'];
            }
        }
        $this->fail('No Certified card in the dashboard payload.');
    }

    public function test_system_admin_card_counts_lapsed_certificates_too(): void
    {
        $this->certifiedAssessment(now()->addYear()->toDateString());
        $this->certifiedAssessment(now()->subMonth()->toDateString());

        $dashboard = app(DashboardService::class)->getSystemAdminDashboard($this->userWithRole(Role::SYSTEM_ADMIN));

        $this->assertSame(2, $this->certifiedCard($dashboard));
        $this->assertSame(2, Assessment::where('status', Assessment::STATUS_CERTIFIED)->count());
    }

    public function test_drdo_admin_card_counts_lapsed_certificates_too(): void
    {
        $this->certifiedAssessment(now()->addYear()->toDateString());
        $this->certifiedAssessment(now()->subMonth()->toDateString());

        $dashboard = app(DashboardService::class)->getDrdoAdminDashboard($this->userWithRole(Role::DRDO_ADMIN));

        $this->assertSame(2, $this->certifiedCard($dashboard));
    }
}
