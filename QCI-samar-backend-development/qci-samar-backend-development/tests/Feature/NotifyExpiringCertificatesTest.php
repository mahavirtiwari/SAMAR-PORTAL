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

class NotifyExpiringCertificatesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(NotificationTemplateSeeder::class);
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

    private function makeCertificate(Organization $org, Unit $unit, $validUntil, string $status = 'active'): Certificate
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

    public function test_sends_staged_reminder_once_and_records_stage(): void
    {
        Mail::fake();

        $org = Organization::factory()->create();
        $unit = $this->makeUnit($org);
        $ea = User::factory()->create(['organization_id' => $org->id]);
        $role = Role::where('slug', Role::ENTERPRISE_ADMIN)->firstOrFail();
        $ea->roles()->attach($role->id, ['organization_id' => $org->id, 'unit_id' => null, 'is_active' => true, 'assigned_at' => now()]);

        // 20 days before expiry -> default window 90 -> most urgent reached stage is 30_days.
        $cert = $this->makeCertificate($org, $unit, now()->addDays(20)->toDateString());

        $this->artisan('certificates:notify-expiring')->assertExitCode(0);

        $cert->refresh();
        $this->assertContains('30_days', $cert->renewal_reminders_sent);
        Mail::assertSent(NotificationMail::class);
    }

    public function test_does_not_resend_same_stage(): void
    {
        $org = Organization::factory()->create();
        $unit = $this->makeUnit($org);
        $ea = User::factory()->create(['organization_id' => $org->id]);
        $role = Role::where('slug', Role::ENTERPRISE_ADMIN)->firstOrFail();
        $ea->roles()->attach($role->id, ['organization_id' => $org->id, 'unit_id' => null, 'is_active' => true, 'assigned_at' => now()]);

        $cert = $this->makeCertificate($org, $unit, now()->addDays(20)->toDateString());

        $this->artisan('certificates:notify-expiring')->assertExitCode(0);
        $cert->refresh();
        $firstSent = $cert->renewal_reminders_sent;

        Mail::fake();
        $this->artisan('certificates:notify-expiring')->assertExitCode(0);
        $cert->refresh();

        $this->assertSame($firstSent, $cert->renewal_reminders_sent);
        Mail::assertNothingSent();
    }

    public function test_skips_certificates_far_from_expiry(): void
    {
        Mail::fake();

        $org = Organization::factory()->create();
        $unit = $this->makeUnit($org);
        $ea = User::factory()->create(['organization_id' => $org->id]);
        $role = Role::where('slug', Role::ENTERPRISE_ADMIN)->firstOrFail();
        $ea->roles()->attach($role->id, ['organization_id' => $org->id, 'unit_id' => null, 'is_active' => true, 'assigned_at' => now()]);

        // 2 years out -> outside the 90-day window -> no reminder.
        $cert = $this->makeCertificate($org, $unit, now()->addYears(2)->toDateString());

        $this->artisan('certificates:notify-expiring')->assertExitCode(0);

        $cert->refresh();
        $this->assertTrue(empty($cert->renewal_reminders_sent));
        Mail::assertNothingSent();
    }
}
