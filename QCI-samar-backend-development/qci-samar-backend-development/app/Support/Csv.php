<?php

namespace App\Support;

/**
 * CSV row writer that neutralizes spreadsheet formula injection.
 *
 * Excel and LibreOffice evaluate a cell that begins with = + - @ or a tab/CR even
 * when the CSV quotes it, so a user-entered name like =HYPERLINK(...) runs when an
 * admin opens the export. Every exporter writes its data rows through putRow(), which
 * prefixes such cells with a single quote so the spreadsheet treats them as text.
 * Numeric strings ("-500.00") are left alone; they cannot be formulas.
 */
final class Csv
{
    private const FORMULA_LEADERS = ['=', '+', '-', '@', "\t", "\r"];

    /**
     * @param  resource  $handle
     * @param  array<int, mixed>  $row
     */
    public static function putRow($handle, array $row): void
    {
        fputcsv($handle, array_map(self::neutralize(...), $row), ',', '"', '');
    }

    public static function neutralize(mixed $value): mixed
    {
        if (! is_string($value) || $value === '' || is_numeric($value)) {
            return $value;
        }

        return in_array($value[0], self::FORMULA_LEADERS, true) ? "'".$value : $value;
    }

    /**
     * Inverse of neutralize(), for spreadsheets that come back through an importer:
     * an export that was opened in Excel and re-uploaded carries the quote as content.
     */
    public static function unneutralize(string $value): string
    {
        if (strlen($value) >= 2 && $value[0] === "'" && in_array($value[1], self::FORMULA_LEADERS, true)) {
            return substr($value, 1);
        }

        return $value;
    }
}
