<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Login CAPTCHA
    |--------------------------------------------------------------------------
    |
    | Self-hosted image CAPTCHA on the browser-facing auth forms. The challenge
    | answer never leaves the server: the client only ever holds an opaque id,
    | and the answer is pulled (and deleted) from the cache on first check.
    |
    | Only browser requests are challenged — the mobile apps call the same
    | endpoints and must keep working. See CaptchaService::isRequiredFor().
    |
    */

    'enabled' => (bool) env('CAPTCHA_ENABLED', true),

    // Seconds a challenge stays solvable before it expires.
    'ttl' => (int) env('CAPTCHA_TTL', 300),

    'length' => (int) env('CAPTCHA_LENGTH', 5),

    // Capitals and digits only. Characters that are easily confused are left
    // out (0 O Q D, 1 I L, 2 Z, 5 S, 8 B, G, U V) so the code reads one way
    // only. The answer is checked case-insensitively.
    'charset' => 'ACEFHJKMNPRTWXY34679',

    'width' => 170,

    'height' => 56,

    // Light background; glyphs alternate between navy, green and charcoal,
    // all dark enough to read clearly on it.
    'background_rgb' => [238, 245, 240],

    'text_palette' => [
        [27, 58, 122],
        [22, 120, 70],
        [33, 37, 41],
    ],

    // Bold serif font for the code (first one found is used).
    'fonts' => [
        base_path('vendor/dompdf/dompdf/lib/fonts/DejaVuSerif-Bold.ttf'),
        public_path('fonts/Inter-Bold.ttf'),
    ],

];
