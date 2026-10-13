<?php

namespace Tests\Unit\Models;

use App\Models\Application;
use Tests\TestCase;

class ApplicationFullAddressTest extends TestCase
{
    public function test_full_unit_address_includes_all_parts_with_pincode(): void
    {
        $application = new Application;
        $application->unit_address = 'Plot 12, Industrial Area';
        $application->unit_district = 'Gurugram';
        $application->unit_state = 'Haryana';
        $application->unit_pincode = '122016';

        $this->assertSame('Plot 12, Industrial Area, Gurugram, Haryana - 122016', $application->full_unit_address);
    }

    public function test_full_unit_address_skips_empty_parts(): void
    {
        $application = new Application;
        $application->unit_address = 'Plot 12, Industrial Area';
        $application->unit_state = 'Haryana';
        $application->unit_pincode = '122016';

        $this->assertSame('Plot 12, Industrial Area, Haryana - 122016', $application->full_unit_address);
    }

    public function test_full_unit_address_returns_pincode_only_when_address_blank(): void
    {
        $application = new Application;
        $application->unit_pincode = '122016';

        $this->assertSame('122016', $application->full_unit_address);
    }

    public function test_full_unit_address_is_null_when_no_parts(): void
    {
        $application = new Application;

        $this->assertNull($application->full_unit_address);
    }

    public function test_full_registered_office_address_includes_pincode(): void
    {
        $application = new Application;
        $application->registered_office_address = '1 MG Road';
        $application->registered_office_district = 'Bengaluru';
        $application->registered_office_state = 'Karnataka';
        $application->registered_office_pincode = '560001';

        $this->assertSame('1 MG Road, Bengaluru, Karnataka - 560001', $application->full_registered_office_address);
    }
}
