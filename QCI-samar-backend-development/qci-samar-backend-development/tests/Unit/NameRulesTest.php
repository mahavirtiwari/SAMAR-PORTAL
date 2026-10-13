<?php

namespace Tests\Unit;

use App\Rules\EntityName;
use App\Rules\PersonName;
use Illuminate\Contracts\Validation\ValidationRule;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Locks the character allowlists behind every name field: what real names need
 * must pass, and markup or formula leaders must not.
 */
class NameRulesTest extends TestCase
{
    public static function validPersonNames(): array
    {
        return [
            ['Navneet'],
            ['Mary-Jane'],
            ["D'Souza"],
            ['Dr. A.P.J. Abdul Kalam'],
            ['राम कुमार'],
            ['José Ñíguez'],
        ];
    }

    public static function invalidPersonNames(): array
    {
        return [
            ['Test<script>alert(1)</script>Testy'],
            ['=SUM(1+1)'],
            ['-Rao'],
            ['John123'],
            ['Jane & Co'],
            ['a;b'],
            [''],
        ];
    }

    public static function validEntityNames(): array
    {
        return [
            ['Customer Experience'],
            ['Safety & Environment'],
            ['ISO 9001:2015'],
            ['5S / Housekeeping'],
            ['Quality Management System (QMS)'],
            ['ABC Manufacturing Pvt. Ltd.'],
            ["Health, Safety & Env't"],
        ];
    }

    public static function invalidEntityNames(): array
    {
        return [
            ['=SUM(1+1)'],
            ['+SUM(1+1)'],
            ['-1+1'],
            ['@SUM(A1)'],
            ['<b>Bold</b>'],
            ['Name; DROP TABLE'],
            ['a=b'],
            [''],
        ];
    }

    private function passes(ValidationRule $rule, string $value): bool
    {
        $failed = false;
        $rule->validate('name', $value, function () use (&$failed) {
            $failed = true;
        });

        return ! $failed;
    }

    #[DataProvider('validPersonNames')]
    public function test_person_name_accepts_real_names(string $value): void
    {
        $this->assertTrue($this->passes(new PersonName, $value));
    }

    #[DataProvider('invalidPersonNames')]
    public function test_person_name_rejects_markup_and_symbols(string $value): void
    {
        $this->assertFalse($this->passes(new PersonName, $value));
    }

    #[DataProvider('validEntityNames')]
    public function test_entity_name_accepts_real_names(string $value): void
    {
        $this->assertTrue($this->passes(new EntityName, $value));
    }

    #[DataProvider('invalidEntityNames')]
    public function test_entity_name_rejects_markup_and_formula_leaders(string $value): void
    {
        $this->assertFalse($this->passes(new EntityName, $value));
    }
}
