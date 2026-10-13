<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * SwaggerAccess Middleware
 *
 * Controls access to Swagger documentation based on environment
 */
class SwaggerAccess
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Check if Swagger is explicitly disabled (config so it survives config:cache)
        if (config('app.swagger_enabled', true) === false) {
            abort(404);
        }

        // Allow access in local and development environments only
        if (app()->environment(['local', 'development'])) {
            return $next($request);
        }

        // In production and staging, deny access unless explicitly enabled
        abort(404);
    }
}
