<?php

namespace Tests\Unit\Payment;

use App\Services\Payment\ICICIEazyPayAdapter;
use PHPUnit\Framework\TestCase;

class ICICIEazyPaySanitizeFieldTest extends TestCase
{
    public function test_strips_embedded_crlf_that_caused_e00314_in_prod(): void
    {
        $raw = "BESTECH PARK VIEW CITY-1\r\nBadshahpur Sohna Rd, Park View City 1, Tatvam Villas, Sector 48, Gurugram, Haryana 122018";

        $clean = ICICIEazyPayAdapter::sanitizeField($raw, 80);

        $this->assertStringNotContainsString("\r", $clean);
        $this->assertStringNotContainsString("\n", $clean);
        $this->assertLessThanOrEqual(80, mb_strlen($clean));
        $this->assertStringStartsWith('BESTECH PARK VIEW CITY-1 Badshahpur Sohna Rd', $clean);
        // Must end on a word boundary, not mid-word or with trailing punctuation
        $this->assertMatchesRegularExpression('/[A-Za-z0-9]$/', $clean);
    }

    public function test_truncation_snaps_back_to_word_boundary_when_cut_mid_word(): void
    {
        // App 27's actual prod data (175 chars) — caused E00314 after first deploy because
        // sanitize cut mid-word at position 100 ("...Gautam Buddha")
        $raw = 'Plot No 14, A-15 Block, Sector 44, Noida, Gautam Buddha Nagar, Uttar Pradesh - 201303, Gautam Buddha Nagar, Uttar Pradesh - 201303, Gautam Buddha Nagar, Uttar Pradesh - 201301';

        $clean = ICICIEazyPayAdapter::sanitizeField($raw, 80);

        $this->assertLessThanOrEqual(80, mb_strlen($clean));
        // No trailing partial word
        $this->assertDoesNotMatchRegularExpression('/Buddha$/', $clean);
        // No trailing punctuation/whitespace/hyphen
        $this->assertMatchesRegularExpression('/[A-Za-z0-9]$/', $clean);
        // Concrete expected output for the prod case
        $this->assertSame(
            'Plot No 14, A-15 Block, Sector 44, Noida, Gautam Buddha Nagar, Uttar Pradesh',
            $clean
        );
    }

    public function test_truncation_strips_trailing_hyphen_and_comma(): void
    {
        $raw = 'Plot No 14, A-15 Block, Uttar Pradesh - 201303, Some Extra Suffix Text';
        $clean = ICICIEazyPayAdapter::sanitizeField($raw, 50);
        $this->assertMatchesRegularExpression('/[A-Za-z0-9]$/', $clean);
        $this->assertDoesNotMatchRegularExpression('/[,\\- ]$/', $clean);
    }

    public function test_strips_pipe_so_field_cannot_break_delimiter(): void
    {
        $this->assertSame(
            'Plot 12 Sector 5',
            ICICIEazyPayAdapter::sanitizeField('Plot 12|Sector 5', 50)
        );
    }

    public function test_strips_tabs_and_other_control_chars(): void
    {
        $this->assertSame(
            'foo bar baz',
            ICICIEazyPayAdapter::sanitizeField("foo\tbar\x00baz", 50)
        );
    }

    public function test_collapses_repeated_whitespace_and_trims(): void
    {
        $this->assertSame(
            'Acme Industries Ltd',
            ICICIEazyPayAdapter::sanitizeField("   Acme  \n  Industries   Ltd  ", 50)
        );
    }

    public function test_enforces_max_length(): void
    {
        $long = str_repeat('a', 200);
        $this->assertSame(80, mb_strlen(ICICIEazyPayAdapter::sanitizeField($long, 80)));
    }

    public function test_null_and_empty_become_empty_string(): void
    {
        $this->assertSame('', ICICIEazyPayAdapter::sanitizeField(null, 50));
        $this->assertSame('', ICICIEazyPayAdapter::sanitizeField('', 50));
    }

    public function test_passthrough_for_clean_value(): void
    {
        $clean = 'Plot No 14 Block, A15, A Block, Sector 44, Noida, Uttar Pradesh 201301, India';
        $this->assertSame($clean, ICICIEazyPayAdapter::sanitizeField($clean, 100));
    }
}
