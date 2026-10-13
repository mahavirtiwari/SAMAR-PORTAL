<?php

namespace App\Http\Middleware;

use App\Support\CaseConverter;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * ConvertRequestToSnakeCase Middleware
 *
 * Validates that request keys are in camelCase format, then converts
 * them to snake_case for Laravel/PHP conventions in database and model operations.
 */
class ConvertRequestToSnakeCase
{
    /**
     * Handle an incoming request.
     *
     * Validate camelCase format and convert to snake_case.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Validate and convert JSON body parameters
        if ($request->isJson() && $request->getContent()) {
            $data = $request->json()->all();
            if (is_array($data) && ! empty($data)) {
                $snakeCaseKeys = $this->findSnakeCaseKeys($data);
                if (! empty($snakeCaseKeys)) {
                    return $this->rejectSnakeCaseRequest($snakeCaseKeys);
                }
                $snakeCaseData = CaseConverter::toSnakeCase($data);
                $request->json()->replace($snakeCaseData);
                // Also replace the input bag so $request->all() returns converted data
                $request->replace($snakeCaseData);
            }
        } else {
            // Validate and convert regular input parameters (form data, query params)
            // Only for non-JSON requests since JSON is handled above
            $input = $request->all();
            if (! empty($input)) {
                $snakeCaseKeys = $this->findSnakeCaseKeys($input);
                if (! empty($snakeCaseKeys)) {
                    return $this->rejectSnakeCaseRequest($snakeCaseKeys);
                }
                $snakeCaseInput = CaseConverter::toSnakeCase($input);
                $request->replace($snakeCaseInput);
            }
        }

        return $next($request);
    }

    /**
     * Find all snake_case keys in the data array (recursive).
     */
    private function findSnakeCaseKeys(array $data, string $prefix = ''): array
    {
        $snakeCaseKeys = [];

        foreach ($data as $key => $value) {
            // Skip numeric keys (array indices)
            if (is_numeric($key)) {
                if (is_array($value)) {
                    $snakeCaseKeys = array_merge(
                        $snakeCaseKeys,
                        $this->findSnakeCaseKeys($value, $prefix)
                    );
                }

                continue;
            }

            $fullKey = $prefix ? "{$prefix}.{$key}" : $key;

            // Check if key contains underscore (snake_case indicator)
            if (str_contains($key, '_')) {
                $snakeCaseKeys[] = $fullKey;
            }

            // Recursively check nested arrays
            if (is_array($value)) {
                $snakeCaseKeys = array_merge(
                    $snakeCaseKeys,
                    $this->findSnakeCaseKeys($value, $fullKey)
                );
            }
        }

        return $snakeCaseKeys;
    }

    /**
     * Return a 400 response for snake_case keys.
     */
    private function rejectSnakeCaseRequest(array $snakeCaseKeys): Response
    {
        $examples = array_slice($snakeCaseKeys, 0, 3);
        $exampleStr = implode(', ', array_map(fn ($k) => "'{$k}'", $examples));

        return response()->json([
            'success' => false,
            'message' => "Invalid request format. Use camelCase for all keys (e.g., 'firstName' not 'first_name').",
            'errors' => [
                'format' => ["Found snake_case keys: {$exampleStr}. Please use camelCase format."],
            ],
        ], 400);
    }
}
