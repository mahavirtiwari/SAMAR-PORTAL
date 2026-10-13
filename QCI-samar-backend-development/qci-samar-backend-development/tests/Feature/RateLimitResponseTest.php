<?php

namespace Tests\Feature;

use App\Exceptions\ErrorReporter;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * A rate-limited request must come back as the limiter's own 429, not as the
 * generic "unexpected error, quote reference REF-..." card. [BUG-07860]
 *
 * Every auth limiter carries a ->response() callback, and Laravel's throttle
 * middleware wraps such a response in an HttpResponseException rather than the
 * ThrottleRequestsException the API render callback used to look for. The
 * exception is thrown from MIDDLEWARE, so Route::run()'s own catch for it never
 * sees it and it reaches our render callback, which runs before Laravel's
 * HttpResponseException handling. Without a branch for it the throttle fell
 * through to the generic card, as a 500, and ErrorReporter classified it as a
 * server error because HttpResponseException is not an HttpException.
 *
 * The route below is throttled by a limiter shaped exactly like the auth ones,
 * so the exception arrives by the same path a real throttle takes.
 */
class RateLimitResponseTest extends TestCase
{
    private const THROTTLE_MESSAGE = 'Too many password reset attempts. Please try again later.';

    protected function setUp(): void
    {
        parent::setUp();

        RateLimiter::for('testing.throttled', fn (Request $request) => Limit::perMinute(1)
            ->by('rate-limit-response-test')
            ->response(fn (Request $request, array $headers) => response()->json([
                'success' => false,
                'message' => self::THROTTLE_MESSAGE,
                'retry_after' => $headers['Retry-After'] ?? 60,
            ], 429, $headers)));

        Route::middleware(['api', 'throttle:testing.throttled'])
            ->post('/api/v1/testing/throttled', fn () => response()->json(['success' => true]));
    }

    private function exhaustLimiter(): TestResponse
    {
        $this->postJson('/api/v1/testing/throttled')->assertOk();

        return $this->postJson('/api/v1/testing/throttled');
    }

    public function test_the_limiters_own_response_reaches_the_client(): void
    {
        $response = $this->exhaustLimiter();

        $response->assertStatus(429);
        $response->assertJsonPath('success', false);
        $response->assertJsonPath('message', self::THROTTLE_MESSAGE);
        $this->assertNotNull($response->headers->get('Retry-After'));
    }

    public function test_a_throttle_is_never_answered_as_an_unexpected_error(): void
    {
        $response = $this->exhaustLimiter();

        $this->assertSame(429, $response->status());
        $this->assertArrayNotHasKey('reference', $response->json());
        $this->assertStringNotContainsString(
            'unexpected error',
            (string) $response->json('message'),
        );
    }

    public function test_a_throttle_is_not_classified_as_a_server_error(): void
    {
        $exception = new HttpResponseException(
            response()->json(['message' => self::THROTTLE_MESSAGE], 429),
        );

        $statusCode = (new \ReflectionClass(ErrorReporter::class))->getMethod('statusCode');
        $statusCode->setAccessible(true);

        $this->assertSame(
            429,
            $statusCode->invoke(app(ErrorReporter::class), $exception),
            'A throttle must not be classified as a 500, or it is persisted and emailed as a server error.',
        );
    }
}
