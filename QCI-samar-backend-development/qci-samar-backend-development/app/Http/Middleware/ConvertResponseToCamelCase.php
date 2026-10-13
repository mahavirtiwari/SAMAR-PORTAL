<?php

namespace App\Http\Middleware;

use App\Support\CaseConverter;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * ConvertResponseToCamelCase Middleware
 *
 * Converts all JSON response keys from snake_case to camelCase
 * to match JavaScript/frontend conventions
 */
class ConvertResponseToCamelCase
{
    /**
     * Handle an incoming request.
     *
     * Process the response and convert all array keys to camelCase.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Only process JSON responses
        if ($response instanceof JsonResponse) {
            $data = $response->getData(true); // Get data as array

            if (is_array($data)) {
                $camelCaseData = CaseConverter::toCamelCase($data);
                $response->setData($camelCaseData);
            }
        }

        return $response;
    }
}
