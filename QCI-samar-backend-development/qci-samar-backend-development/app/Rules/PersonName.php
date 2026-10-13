<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * A person's name: letters from any script, then letters, spaces, apostrophes,
 * hyphens and periods. Rejects markup, formula leaders and every other symbol.
 */
class PersonName implements ValidationRule
{
    public const PATTERN = "/^[\p{L}\p{M}][\p{L}\p{M} .'\-]*$/u";

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || preg_match(self::PATTERN, $value) !== 1) {
            $fail('The :attribute may contain only letters, spaces, apostrophes, hyphens and periods.');
        }
    }
}
