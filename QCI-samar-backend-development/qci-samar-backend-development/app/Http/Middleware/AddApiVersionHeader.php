<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Symfony\Component\HttpFoundation\Response;

/**
 * Add API Version Header Middleware
 *
 * Adds X-Api-Version to API responses in local/development only. Deployed
 * environments omit it: an unauthenticated response advertising the exact build
 * is version fingerprinting, raised by the STQC/ITQCR audit.
 */
class AddApiVersionHeader
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (App::environment(['local', 'development'])) {
            $response->headers->set('X-Api-Version', config('app.api_version'));
        }

        return $response;
    }
}
