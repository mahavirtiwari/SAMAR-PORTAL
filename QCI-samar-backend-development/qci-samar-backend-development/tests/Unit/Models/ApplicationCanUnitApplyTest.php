<?php

namespace Tests\Unit\Models;

use App\Models\Application;
use App\Models\Organization;
use App\Models\SystemSetting;
use App\Models\Unit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApplicationCanUnitApplyTest extends TestCase
{
    use RefreshDatabase;

    private function makeUnit(): Unit
    {
        $org = Organization::factory()->create();

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

    private function makeApp(Unit $unit, array $overrides): Application
    {
        return Application::create(array_merge([
            'organization_id' => $unit->organization_id,
            'unit_id' => $unit->id,
            'application_number' => 'SAMAR-'.uniqid(),
            'application_type' => 'new',
            'sector' => 'manufacturing',
            'status' => 'draft',
        ], $overrides));
    }

    public function test_rejected_application_does_not_block_new_application(): void
    {
        $unit = $this->makeUnit();
        $this->makeApp($unit, ['status' => 'rejected', 'rejected_at' => now()]);

        $this->assertTrue(Application::canUnitApply($unit->id)['allowed']);
    }

    public function test_active_draft_blocks_new_application(): void
    {
        $unit = $this->makeUnit();
        $this->makeApp($unit, ['status' => 'draft']);

        $this->assertFalse(Application::canUnitApply($unit->id)['allowed']);
    }

    public function test_expired_certificate_allows_renewal(): void
    {
        $unit = $this->makeUnit();
        $this->makeApp($unit, [
            'status' => 'certified',
            'certificate_expiry_at' => now()->subDays(5),
        ]);

        $this->assertTrue(Application::canUnitApply($unit->id)['allowed']);
    }

    public function test_window_is_driven_by_recertification_setting(): void
    {
        $unit = $this->makeUnit();
        $this->makeApp($unit, [
            'status' => 'certified',
            'certificate_expiry_at' => now()->addDays(100),
        ]);

        // Default window 90 -> opens in 10 days -> not eligible yet.
        $this->assertFalse(Application::canUnitApply($unit->id)['allowed']);

        // Widen to 120 -> window already open -> eligible.
        SystemSetting::setValue('recertification_window_days', '120');
        $this->assertTrue(Application::canUnitApply($unit->id)['allowed']);
    }
}
