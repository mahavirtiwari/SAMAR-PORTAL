<?php

namespace App\Services\Auth;

use Gregwar\Captcha\CaptchaBuilder;
use Gregwar\Captcha\PhraseBuilder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Self-hosted image CAPTCHA for the browser-facing auth forms.
 *
 * The answer is held server-side in the cache under an opaque id; the client
 * receives only the id and the image. Verification pulls the entry, so a solved
 * challenge cannot be replayed.
 */
class CaptchaService
{
    private const CACHE_PREFIX = 'captcha:';

    private const PASS_PREFIX = 'captcha-pass:';

    // Long enough to cover the device-conflict confirmation modal between the
    // two credential calls, short enough that a solved challenge is not a
    // reusable brute-force budget.
    private const PASS_TTL = 120;

    /**
     * @return array{captcha_id: string, image: string, expires_in: int}
     */
    public function generate(): array
    {
        $phraseBuilder = new PhraseBuilder(
            (int) config('captcha.length'),
            (string) config('captcha.charset')
        );

        $builder = new CaptchaBuilder(null, $phraseBuilder);

        // Pin the palette. Left to itself the library picks both colours at
        // random per render, which regularly lands on low-contrast pairings
        // (saturated glyphs on a dark background) — unreadable for some users
        // and visibly inconsistent between one form and the next. Distortion,
        // interpolation and the noise lines are untouched, so pinning the
        // colours costs nothing in resistance to automated reading.
        $background = config('captcha.background_rgb');
        $text = config('captcha.text_rgb');
        $builder->setBackgroundColor($background[0], $background[1], $background[2]);
        $builder->setTextColor($text[0], $text[1], $text[2]);

        $builder->build((int) config('captcha.width'), (int) config('captcha.height'));

        $id = (string) Str::uuid();
        $ttl = (int) config('captcha.ttl');

        Cache::put(self::CACHE_PREFIX.$id, strtolower($builder->getPhrase()), $ttl);

        return [
            'captcha_id' => $id,
            'image' => $builder->inline(),
            'expires_in' => $ttl,
        ];
    }

    /**
     * Consume a challenge. Always single-use: the entry is pulled whether or not
     * the answer matches, so a wrong guess costs the attacker a fresh challenge.
     */
    public function verify(?string $id, ?string $answer): bool
    {
        if (blank($id) || blank($answer)) {
            return false;
        }

        $expected = Cache::pull(self::CACHE_PREFIX.$id);

        if ($expected === null) {
            return false;
        }

        return hash_equals($expected, strtolower(trim($answer)));
    }

    /**
     * The web login flow makes two credential-bearing calls — check-active-session
     * then login — and both validate the password, so challenging only one of them
     * would leave the other as an unprotected credential oracle. Challenging both
     * would mean two puzzles per login. Instead the first call consumes the
     * challenge and issues a single-use pass that the second call spends.
     *
     * The pass is bound to the account and the caller's IP, and is issued only
     * after a solved challenge, so it never becomes a reusable attempt budget.
     */
    public function issuePass(Request $request, ?string $samarId): void
    {
        Cache::put(self::PASS_PREFIX.$this->passKey($request, $samarId), true, self::PASS_TTL);
    }

    public function consumePass(Request $request, ?string $samarId): bool
    {
        return (bool) Cache::pull(self::PASS_PREFIX.$this->passKey($request, $samarId));
    }

    private function passKey(Request $request, ?string $samarId): string
    {
        return hash('sha256', strtoupper((string) $samarId).'|'.$request->ip());
    }

    /**
     * Browser requests are challenged; the mobile apps are not.
     *
     * The discriminator is the Origin header, which browsers set on every
     * cross-site request and on same-site POSTs, and which the React Native
     * clients do not send. A self-declared body field (device_type) would be
     * trivially omitted by a bot, and the mobile apps would need reworking.
     *
     * This is defence-in-depth, not the primary anti-automation control: the
     * per-IP throttle, per-account lockout and mandatory login OTP apply to
     * every client regardless of where the request claims to come from.
     */
    public function isRequiredFor(Request $request): bool
    {
        if (! config('captcha.enabled')) {
            return false;
        }

        $origin = $request->headers->get('Origin');

        if (blank($origin)) {
            return false;
        }

        return in_array($origin, config('cors.allowed_origins', []), true);
    }
}
