<?php

namespace App\Support;

class TextNormalizer
{
    /**
     * Unicode whitespace that reaches us from spreadsheets and pasted content but that
     * PHP's trim() does not touch, because trim() only knows the ASCII set. A cell
     * ending in a non-breaking space compares unequal to its own visible text, which is
     * how a valid "Monitoring" category came back as invalid.
     */
    private const UNICODE_SPACES = [
        "\u{00A0}", // non-breaking space (Excel and Word emit this constantly)
        "\u{1680}", // ogham space mark
        "\u{2000}", "\u{2001}", "\u{2002}", "\u{2003}", "\u{2004}",
        "\u{2005}", "\u{2006}", "\u{2007}", "\u{2008}", "\u{2009}", "\u{200A}",
        "\u{202F}", // narrow no-break space
        "\u{205F}", // medium mathematical space
        "\u{3000}", // ideographic space
    ];

    /**
     * Zero-width characters, which are invisible and so never get noticed in a cell.
     */
    private const ZERO_WIDTH = [
        "\u{200B}", // zero-width space
        "\u{200C}", // zero-width non-joiner
        "\u{200D}", // zero-width joiner
        "\u{FEFF}", // zero-width no-break space / BOM
    ];

    /**
     * Remove control characters, keeping newlines and tabs, which are legitimate in
     * multi-line answer text.
     */
    public static function stripControlCharacters(string $value): string
    {
        return preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '';
    }

    /**
     * Collapse the invisible variants of whitespace to a plain space and drop
     * zero-width characters, so a value compares by what a human can actually see.
     */
    public static function normalizeWhitespace(string $value): string
    {
        $value = str_replace(self::ZERO_WIDTH, '', $value);
        $value = str_replace(self::UNICODE_SPACES, ' ', $value);

        return preg_replace('/[ \t]+/u', ' ', $value) ?? '';
    }

    /**
     * The form used for comparing a spreadsheet cell against an expected value:
     * control characters gone, invisible whitespace normalised, trimmed.
     */
    public static function normalize(?string $value): string
    {
        if ($value === null) {
            return '';
        }

        return trim(self::normalizeWhitespace(self::stripControlCharacters($value)));
    }

    /**
     * Normalised and lowercased, for case-insensitive matching of names and enum-like
     * cells (categories, parameter types, discipline names).
     */
    public static function normalizeKey(?string $value): string
    {
        return mb_strtolower(self::normalize($value));
    }
}
