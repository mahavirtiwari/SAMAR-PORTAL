<?php

namespace Tests\Unit\Payment;

use App\Exceptions\BusinessException;
use App\Exceptions\FeeConfigurationMissingException;
use App\Models\Application;
use App\Models\FeeConfiguration;
use App\Models\Organization;
use App\Models\Unit;
use App\Services\Payment\FeeCalculator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FeeCalculatorTest extends TestCase
{
    use RefreshDatabase;

    private FeeCalculator $calculator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->calculator = new FeeCalculator;
    }

    private function makeConfig(bool $tdsEnabled = false): FeeConfiguration
    {
        return FeeConfiguration::create([
            'sector' => 'manufacturing',
            'enterprise_size' => 'micro',
            'base_certification_fee' => 35000,
            'food_and_accommodation_fee' => 2000,
            'gst_percentage' => 18,
            'tds_enabled' => $tdsEnabled,
        ]);
    }

    private function makeApplication(string $sector = 'manufacturing', ?string $size = 'micro'): Application
    {
        $org = Organization::factory()->create();

        $unit = Unit::create([
            'organization_id' => $org->id,
            'name' => 'Unit',
            'address' => 'Addr',
            'state' => 'State',
            'district' => 'District',
            'pincode' => '110011',
            'unit_type' => 'manufacturing',
            'status' => 'active',
        ]);

        return Application::create([
            'organization_id' => $org->id,
            'organization_name' => 'Acme Defense',
            'unit_id' => $unit->id,
            'application_number' => 'SAMAR-'.uniqid(),
            'application_type' => 'new',
            'sector' => $sector,
            'enterprise_classification' => $size,
            'status' => 'payment_pending',
        ]);
    }

    public function test_total_is_base_plus_food_plus_gst(): void
    {
        $this->makeConfig();

        $fee = $this->calculator->forApplication($this->makeApplication());

        // (35000 + 2000) * 1.18
        $this->assertSame(43660.00, $fee['total']);
        $this->assertSame(6660.00, $fee['metadata']['gst_amount']);
        $this->assertSame(0.0, $fee['metadata']['tds_amount']);
        $this->assertFalse($fee['metadata']['tds_deductible']);
    }

    public function test_tds_is_deducted_when_configuration_enables_it_and_applicant_elects(): void
    {
        $this->makeConfig(tdsEnabled: true);

        $fee = $this->calculator->forApplication($this->makeApplication(), true, 2.0);

        // 37000 + 6660 - 740
        $this->assertSame(42920.00, $fee['total']);
        $this->assertSame(740.00, $fee['metadata']['tds_amount']);
        $this->assertTrue($fee['metadata']['tds_deductible']);
    }

    public function test_tds_election_is_ignored_when_configuration_disables_tds(): void
    {
        $this->makeConfig(tdsEnabled: false);

        $fee = $this->calculator->forApplication($this->makeApplication(), true, 10.0);

        $this->assertSame(43660.00, $fee['total']);
        $this->assertSame(0.0, $fee['metadata']['tds_amount']);
        $this->assertFalse($fee['metadata']['tds_deductible']);
    }

    public function test_disallowed_tds_percentage_is_rejected(): void
    {
        $this->makeConfig(tdsEnabled: true);

        $this->expectException(BusinessException::class);

        $this->calculator->forApplication($this->makeApplication(), true, 50.0);
    }

    public function test_missing_configuration_throws(): void
    {
        $this->makeConfig();

        $this->expectException(FeeConfigurationMissingException::class);

        $this->calculator->forApplication($this->makeApplication('service', 'large'));
    }

    public function test_application_without_enterprise_classification_throws(): void
    {
        $this->makeConfig();

        $this->expectException(FeeConfigurationMissingException::class);

        $this->calculator->forApplication($this->makeApplication('manufacturing', null));
    }
}
