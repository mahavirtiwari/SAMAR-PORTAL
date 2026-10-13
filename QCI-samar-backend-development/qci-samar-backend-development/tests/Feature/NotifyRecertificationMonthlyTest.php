<?php

namespace Tests\Feature;

use App\Mail\NotificationMail;
use App\Models\Application;
use App\Models\Certificate;
use App\Models\Organization;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\NotificationTemplateSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class NotifyRecertificationMonthlyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(NotificationTemplateSeeder::class);
    }

    private function monthKey(): string
    {
        return 'recert_monthly_'.now()->format('Y-m');
    }

    private function makeUnit(Organization $org): Unit
    {
        return Unit::create([
            'organization_id' => $org->id,
            'name' => 'Unit',
            'address' => 'Addr',
            'state' => 'State',
            'district' => 'District',
            'pincode' => '110011',
            'unit_type' => 'manufacturing',
            'status' => 'active',
        ]);
    }

    private function makeCertificate(Organization $org, Unit $unit, string $validUntil, string $status = 'active'): Certificate
    {
        $app = Application::create([
            'organization_id' => $org->id,
            'organization_name' => 'Acme Defense',
            'unit_id' => $unit->id,
            'application_number' => 'SAMAR-'.uniqid(),
            'application_type' => 'new',
            'sector' => 'manufacturing',
            'status' => 'certified',
        ]);

        return Certificate::create([
            'application_id' => $app->id,
            'organization_id' => $org->id,
            'unit_id' => $unit->id,
            'certificate_number' => 'CERT-'.uniqid(),
            'certificate_type' => 'initial',
            'scheme' => 'SAMAR',
            'scope' => 'Manufacturing',
            'issue_date' => now()->subYears(3)->toDateString(),
            'valid_from' => now()->subYears(3)->toDateString(),
            'valid_until' => $validUntil,
            'validity_months' => 36,
            'status' => $status,
        ]);
    }

    private function attachEnterpriseAdmin(Organization $org): User
    {
        $ea = User::factory()->create(['organization_id' => $org->id]);
        $role = Role::where('slug', Role::ENTERPRISE_ADMIN)->firstOrFail();
        $ea->roles()->attach($role->id, ['organization_id' => $org->id, 'unit_id' => null, 'is_active' => true, 'assigned_at' => now()]);

        return $ea;
    }

    public function test_sends_monthly_reminder_once_and_records_month_key(): void
    {
        Mail::fake();

        $org = Organization::factory()->create();
        $unit = $this->makeUnit($org);
        $this->attachEnterpriseAdmin($org);

        // 20 days before expiry -> inside the default 90-day window.
        $cert = $this->makeCertificate($org, $unit, now()->addDays(20)->toDateString());

        $this->artisan('certificates:notify-recert-monthly')->assertExitCode(0);

        $cert->refresh();
        $this->assertContains($this->monthKey(), $cert->renewal_reminders_sent);
        Mail::assertSent(NotificationMail::class);
    }

    public function test_does_not_resend_within_same_month(): void
    {
        $org = Organization::factory()->create();
        $unit = $this->makeUnit($org);
        $this->attachEnterpriseAdmin($org);

        $cert = $this->makeCertificate($org, $unit, now()->addDays(20)->toDateString());

        $this->artisan('certificates:notify-recert-monthly')->assertExitCode(0);
        $cert->refresh();
        $firstSent = $cert->renewal_reminders_sent;

        Mail::fake();
        $this->artisan('certificates:notify-recert-monthly')->assertExitCode(0);
        $cert->refresh();

        $this->assertSame($firstSent, $cert->renewal_reminders_sent);
        Mail::assertNothingSent();
    }

    public function test_stops_when_renewal_already_started(): void
    {
        Mail::fake();

        $org = Organization::factory()->create();
        $unit = $this->makeUnit($org);
        $this->attachEnterpriseAdmin($org);

        $cert = $this->makeCertificate($org, $unit, now()->addDays(20)->toDateString());

        // A live (non-rejected) renewal draft off the certified application means
        // the applicant has begun renewing -> the reminder cycle is closed.
        Application::create([
            'organization_id' => $org->id,
            'organization_name' => 'Acme Defense',
            'unit_id' => $unit->id,
            'application_number' => 'SAMAR-'.uniqid(),
            'application_type' => 'renewal',
            'sector' => 'manufacturing',
            'status' => 'draft',
            'previous_application_id' => $cert->application_id,
        ]);

        $this->artisan('certificates:notify-recert-monthly')->assertExitCode(0);

        $cert->refresh();
        $this->assertTrue(empty($cert->renewal_reminders_sent));
        Mail::assertNothingSent();
    }

    public function test_skips_certificates_before_window_opens(): void
    {
        Mail::fake();

        $org = Organization::factory()->create();
        $unit = $this->makeUnit($org);
        $this->attachEnterpriseAdmin($org);

        // 2 years out -> window not yet open -> no reminder.
        $cert = $this->makeCertificate($org, $unit, now()->addYears(2)->toDateString());

        $this->artisan('certificates:notify-recert-monthly')->assertExitCode(0);

        $cert->refresh();
        $this->assertTrue(empty($cert->renewal_reminders_sent));
        Mail::assertNothingSent();
    }
}
