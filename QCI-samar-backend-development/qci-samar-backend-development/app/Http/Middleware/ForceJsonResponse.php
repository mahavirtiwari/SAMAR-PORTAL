<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * ForceJsonResponse Middleware
 *
 * Forces all API requests to accept and return JSON responses
 */
class ForceJsonResponse
{
    /**
     * Handle an incoming request.
     *
     * Force all API requests to accept JSON responses.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Force Accept header to application/json
        $request->headers->set('Accept', 'application/json');

        $response = $next($request);

        // Ensure response is JSON
        if (! $response->headers->has('Content-Type')) {
            $response->headers->set('Content-Type', 'application/json');
        }

        return $response;
    }
}
