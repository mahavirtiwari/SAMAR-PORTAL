<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Assessment;
use App\Models\Certificate;
use App\Models\Organization;
use App\Models\Unit;
use App\Models\User;
use App\Services\StateMachine\AssessmentStateMachine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use ReflectionMethod;
use Tests\TestCase;

class CertificateRenewalLineageTest extends TestCase
{
    use RefreshDatabase;

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

    public function test_renewal_certificate_continues_validity_and_retires_predecessor(): void
    {
        $org = Organization::factory()->create();
        $unit = $this->makeUnit($org);
        $user = User::factory()->create(['organization_id' => $org->id]); // auto-assigned samar_id

        // Source certified application + its active certificate.
        $source = Application::create([
            'organization_id' => $org->id,
            'unit_id' => $unit->id,
            'application_number' => 'SAMAR-SRC-'.uniqid(),
            'application_type' => 'new',
            'sector' => 'manufacturing',
            'status' => 'certified',
            'created_by' => $user->id,
        ]);

        $oldExpiry = now()->addDays(20)->startOfDay();
        $oldCert = Certificate::create([
            'application_id' => $source->id,
            'organization_id' => $org->id,
            'unit_id' => $unit->id,
            'certificate_number' => 'OLD-001',
            'certificate_type' => 'initial',
            'scheme' => 'SAMAR',
            'scope' => 'Manufacturing',
            'issue_date' => now()->subYears(3)->toDateString(),
            'valid_from' => now()->subYears(3)->toDateString(),
            'valid_until' => $oldExpiry->toDateString(),
            'validity_months' => 36,
            'status' => 'active',
        ]);

        // Renewal application linked to the source, with a scored assessment.
        $renewal = Application::create([
            'organization_id' => $org->id,
            'unit_id' => $unit->id,
            'application_number' => 'SAMAR-REN-'.uniqid(),
            'application_type' => 'renewal',
            'previous_application_id' => $source->id,
            'sector' => 'manufacturing',
            'status' => 'in_progress',
            'created_by' => $user->id,
        ]);

        $assessment = Assessment::create([
            'application_id' => $renewal->id,
            'organization_id' => $org->id,
            'unit_id' => $unit->id,
            'total_score' => 3.5,
        ]);

        $stateMachine = new AssessmentStateMachine($assessment->fresh(), $user);
        $method = new ReflectionMethod($stateMachine, 'createCertificate');
        $method->setAccessible(true);
        $method->invoke($stateMachine);

        $newCert = Certificate::where('application_id', $renewal->id)->first();
        $this->assertNotNull($newCert);
        $this->assertSame('renewal', $newCert->certificate_type);
        $this->assertSame($oldCert->id, $newCert->renews_certificate_id);

        // Validity continues from the old certificate's expiry (no gap).
        $this->assertSame($oldExpiry->toDateString(), $newCert->valid_from->toDateString());
        $expectedUntil = $oldExpiry->copy()->addMonths(36)->subDay()->toDateString();
        $this->assertSame($expectedUntil, $newCert->valid_until->toDateString());

        // Predecessor retired and linked forward.
        $oldCert->refresh();
        $this->assertSame('renewed', $oldCert->status);
        $this->assertSame($newCert->id, $oldCert->renewed_by_certificate_id);

        // Renewal application's expiry stamped to the new validity.
        $this->assertSame($expectedUntil, $renewal->fresh()->certificate_expiry_at->toDateString());
    }

    public function test_initial_certificate_starts_today_and_has_no_lineage(): void
    {
        $org = Organization::factory()->create();
        $unit = $this->makeUnit($org);
        $user = User::factory()->create(['organization_id' => $org->id]);

        $application = Application::create([
            'organization_id' => $org->id,
            'unit_id' => $unit->id,
            'application_number' => 'SAMAR-NEW-'.uniqid(),
            'application_type' => 'new',
            'sector' => 'manufacturing',
            'status' => 'in_progress',
            'created_by' => $user->id,
        ]);

        $assessment = Assessment::create([
            'application_id' => $application->id,
            'organization_id' => $org->id,
            'unit_id' => $unit->id,
            'total_score' => 3.0,
        ]);

        $stateMachine = new AssessmentStateMachine($assessment->fresh(), $user);
        $method = new ReflectionMethod($stateMachine, 'createCertificate');
        $method->setAccessible(true);
        $method->invoke($stateMachine);

        $cert = Certificate::where('application_id', $application->id)->first();
        $this->assertNotNull($cert);
        $this->assertSame('initial', $cert->certificate_type);
        $this->assertNull($cert->renews_certificate_id);
        $this->assertSame(now()->toDateString(), $cert->valid_from->toDateString());
    }
}
