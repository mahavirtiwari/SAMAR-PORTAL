<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * Log Client Build Middleware
 *
 * The mobile apps send X-Client-Build ("<version>+<commit>") on every request,
 * stamped at build time by their prebuild scripts. Recording it here is what
 * answers "who is running which build" from the server side: one line per
 * request carrying the header, in the dedicated client_build daily log.
 * Requests without the header (web app, curl) are not logged.
 */
class LogClientBuild
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $build = $request->header('X-Client-Build');
        if ($build !== null && $build !== '') {
            Log::channel('client_build')->info('client build', [
                'build' => substr($build, 0, 100),
                'user_id' => $request->user()?->id,
                'method' => $request->method(),
                'path' => $request->path(),
                'status' => $response->getStatusCode(),
                'ip' => $request->ip(),
            ]);
        }

        return $response;
    }
}
