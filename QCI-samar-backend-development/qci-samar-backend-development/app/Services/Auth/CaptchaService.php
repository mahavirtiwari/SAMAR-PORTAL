<?php

namespace App\Services\Auth;

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
        $phrase = $this->randomPhrase((int) config('captcha.length'), (string) config('captcha.charset'));

        $id = (string) Str::uuid();
        $ttl = (int) config('captcha.ttl');

        Cache::put(self::CACHE_PREFIX.$id, strtolower($phrase), $ttl);

        return [
            'captcha_id' => $id,
            'image' => $this->render($phrase),
            'expires_in' => $ttl,
        ];
    }

    private function randomPhrase(int $length, string $charset): string
    {
        $phrase = '';
        for ($i = 0; $i < $length; $i++) {
            $phrase .= $charset[random_int(0, strlen($charset) - 1)];
        }

        return $phrase;
    }

    /**
     * Draws the code as clear, bold capitals and digits in alternating colours on
     * a light hatched background, each glyph slightly tilted and offset, with one
     * strike-through line. Readable at a glance (no look-alike characters, no
     * handwriting fonts or warping), while still an image rather than text.
     */
    private function render(string $phrase): string
    {
        $width = (int) config('captcha.width');
        $height = (int) config('captcha.height');
        $img = imagecreatetruecolor($width, $height);

        [$r, $g, $b] = config('captcha.background_rgb');
        imagefill($img, 0, 0, imagecolorallocate($img, $r, $g, $b));

        // Faint diagonal hatching across the background.
        $hatch = imagecolorallocate($img, max(0, $r - 18), max(0, $g - 12), max(0, $b - 18));
        for ($x = -$height; $x < $width; $x += 6) {
            imageline($img, $x, $height, $x + $height, 0, $hatch);
        }

        $palette = array_map(fn (array $rgb) => imagecolorallocate($img, $rgb[0], $rgb[1], $rgb[2]), config('captcha.text_palette'));
        $font = $this->fontPath();
        $size = (int) round($height * 0.46);
        $slot = ($width - 16) / max(1, strlen($phrase));

        foreach (str_split($phrase) as $i => $char) {
            // Centre each glyph in its own slot so narrow letters (J, T) leave no gaps.
            $box = imagettfbbox($size, 0, $font, $char);
            $glyphWidth = $box[2] - $box[0];
            $angle = random_int(-10, 10);
            $x = (int) (8 + $i * $slot + ($slot - $glyphWidth) / 2 + random_int(-2, 2));
            $y = (int) ($height * 0.72 + random_int(-3, 3));
            imagettftext($img, $size, $angle, $x, $y, $palette[$i % count($palette)], $font, $char);
        }

        // One thin strike-through line, slightly sloped.
        $line = imagecolorallocate($img, 110, 120, 130);
        imagesetthickness($img, 1);
        imageline($img, 6, (int) ($height * (0.50 + random_int(-8, 8) / 100)), $width - 6, (int) ($height * (0.52 + random_int(-8, 8) / 100)), $line);

        ob_start();
        imagepng($img);
        $png = (string) ob_get_clean();
        imagedestroy($img);

        return 'data:image/png;base64,'.base64_encode($png);
    }

    private function fontPath(): string
    {
        foreach ((array) config('captcha.fonts') as $path) {
            if (is_file($path)) {
                return $path;
            }
        }

        throw new \RuntimeException('No captcha font found; check config/captcha.php "fonts".');
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
