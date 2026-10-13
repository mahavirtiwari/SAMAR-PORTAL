<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class TrimStrings
{
    /**
     * Fields that should not be trimmed.
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
        $request->merge($this->trimArray($input));

        return $next($request);
    }

    /**
     * Recursively trim all string values in an array.
     */
    protected function trimArray(array $array): array
    {
        return collect($array)->map(function ($value, $key) {
            if (in_array($key, $this->except, true)) {
                return $value;
            }

            if (is_array($value)) {
                return $this->trimArray($value);
            }

            if (is_string($value)) {
                return trim($value);
            }

            return $value;
        })->all();
    }
}
