<?php

namespace App\Http\Middleware;

use App\Support\TextNormalizer;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * SanitizeInput Middleware
 *
 * Removes control characters from all string inputs. Password fields are excluded
 * so their special characters survive intact.
 *
 * This deliberately does NOT strip HTML tags. strip_tags() deletes everything from a
 * "<" to the next ">", so ordinary assessment text ("scores >= 90 and <95") silently
 * lost its tail, and the loss is unrecoverable once stored. Output escaping is what
 * actually prevents XSS here: the React clients escape by default, and the PDF/email
 * Blade templates render user values through e().
 */
class SanitizeInput
{
    /**
     * Fields that should not be sanitized (passwords may contain angle brackets).
     */
    protected array $except = [
        'password',
        'password_confirmation',
        'current_password',
        'new_password',
    ];

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $input = $request->all();
        $request->merge($this->sanitizeArray($input));

        return $next($request);
    }

    /**
     * Recursively remove control characters from all string values in an array.
     */
    protected function sanitizeArray(array $array): array
    {
        return collect($array)->map(function ($value, $key) {
            if (in_array($key, $this->except, true)) {
                return $value;
            }

            if (is_array($value)) {
                return $this->sanitizeArray($value);
            }

            if (is_string($value)) {
                return TextNormalizer::stripControlCharacters($value);
            }

            return $value;
        })->all();
    }
}
