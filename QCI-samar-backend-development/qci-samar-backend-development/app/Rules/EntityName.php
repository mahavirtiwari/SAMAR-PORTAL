<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * The name of a thing (discipline, parameter, organization): starts with a letter or
 * digit, then letters, digits, spaces and & ( ) / , . ' - : which real names use
 * ("Safety & Environment", "ISO 9001:2015", "5S / Housekeeping"). Rejects markup,
 * formula leaders and every other symbol.
 */
class EntityName implements ValidationRule
{
    public const PATTERN = "/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} &()\/,.'\-:]*$/u";

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || preg_match(self::PATTERN, $value) !== 1) {
            $fail('The :attribute may contain only letters, numbers, spaces and & ( ) / , . \' - :');
        }
    }
}
