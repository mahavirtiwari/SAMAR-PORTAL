<?php

namespace Tests\Unit;

use App\Support\Csv;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Locks the spreadsheet formula neutralization every CSV export writes through,
 * and its inverse on the bulk-import path, so an export can be re-imported unchanged.
 */
class CsvNeutralizationTest extends TestCase
{
    public static function formulaCells(): array
    {
        return [
            'equals' => ['=SUM(1+1)', "'=SUM(1+1)"],
            'plus' => ['+cmd|/C calc!A0', "'+cmd|/C calc!A0"],
            'minus' => ['-2+3+cmd', "'-2+3+cmd"],
            'at' => ['@SUM(A1)', "'@SUM(A1)"],
            'tab' => ["\t=1+1", "'\t=1+1"],
            'carriage return' => ["\r=1+1", "'\r=1+1"],
        ];
    }

    public static function plainCells(): array
    {
        return [
            'ordinary text' => ['Customer Experience'],
            'empty string' => [''],
            'negative numeric string' => ['-500.00'],
            'signed numeric string' => ['+91'],
            'integer' => [42],
            'float' => [12.5],
            'null' => [null],
            'formula not at start' => ['Score = 90'],
        ];
    }

    #[DataProvider('formulaCells')]
    public function test_formula_leading_cells_are_prefixed(string $raw, string $expected): void
    {
        $this->assertSame($expected, Csv::neutralize($raw));
    }

    #[DataProvider('plainCells')]
    public function test_plain_cells_are_untouched(mixed $raw): void
    {
        $this->assertSame($raw, Csv::neutralize($raw));
    }

    #[DataProvider('formulaCells')]
    public function test_unneutralize_reverses_neutralize(string $raw, string $neutralized): void
    {
        $this->assertSame($raw, Csv::unneutralize($neutralized));
    }

    public function test_unneutralize_keeps_a_quote_that_does_not_guard_a_formula(): void
    {
        $this->assertSame("'Sullivan", Csv::unneutralize("'Sullivan"));
        $this->assertSame("'", Csv::unneutralize("'"));
    }

    public function test_put_row_writes_neutralized_cells(): void
    {
        $handle = fopen('php://memory', 'w+');
        Csv::putRow($handle, [7, '=HYPERLINK("http://evil")', 'Plain', -3]);
        rewind($handle);
        $line = stream_get_contents($handle);
        fclose($handle);

        $this->assertSame("7,\"'=HYPERLINK(\"\"http://evil\"\")\",Plain,-3\n", $line);
    }
}
