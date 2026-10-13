<?php

namespace App\Http\Controllers;

use App\Traits\HasPaginatedResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Base Controller
 *
 * All API controllers should extend this base controller
 *
 * @OA\Info(
 *     version=QCI_API_VERSION,
 *     title="QCI Samar API Documentation",
 *     description="API documentation for QCI Samar Backend

## Case Convention: camelCase

This API uses **camelCase** for all request and response JSON keys.

```",
 *     @OA\Contact(
 *         email="support@webority.com"
 *     )
 * )
 *
 * @OA\Server(
 *     url=L5_SWAGGER_CONST_HOST,
 *     description="API Server"
 * )
 *
 * @OA\SecurityScheme(
 *     securityScheme="bearerAuth",
 *     type="http",
 *     scheme="bearer",
 *     bearerFormat="JWT",
 *     description="Enter your JWT token in the format: Bearer {token}"
 * )
 */
abstract class Controller
{
    use HasPaginatedResponse;

    /**
     * Success response helper
     *
     * @param  mixed  $data
     * @return JsonResponse
     */
    protected function successResponse($data = null, string $message = 'Success', int $statusCode = 200, array $extra = [])
    {
        $response = [
            'success' => true,
            'message' => $message,
        ];

        if ($data !== null) {
            $response['data'] = $data;
        }

        return response()->json($response + $extra, $statusCode);
    }

    /**
     * Error response helper
     *
     * @return JsonResponse
     */
    protected function errorResponse(string $message = 'Error', int $statusCode = 400, ?array $errors = null, array $extra = [])
    {
        $response = [
            'success' => false,
            'message' => $message,
        ];

        if ($errors !== null) {
            $response['errors'] = $errors;
        }

        return response()->json($response + $extra, $statusCode);
    }

    /**
     * Safe server-error response for caught exceptions.
     *
     * Logs the full exception server-side and returns only the curated $message
     * plus a reference id. The exception's own text (SQL fragments, DB and table
     * names, file paths, framework internals) is never put on the wire.
     *
     * This deliberately does NOT consult app.debug. It used to echo the raw
     * message whenever debug was on, which made a single wrong APP_DEBUG in a
     * deployed .env sufficient to reproduce the STQC "Verbose SQL Error Message"
     * finding — and it left the web client depending on a field that only exists
     * in some environments. Developers read the log; clients get the reference.
     *
     * @return JsonResponse
     */
    protected function serverErrorResponse(Throwable $e, string $message = 'An unexpected error occurred', int $statusCode = 500)
    {
        $reference = 'REF-'.strtoupper(Str::random(8));

        Log::error($message, [
            'reference' => $reference,
            'exception' => $e::class,
            'message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
        ]);

        return $this->errorResponse($message, $statusCode, null, ['reference' => $reference]);
    }
}
