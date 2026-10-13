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

    // Ambiguous glyphs (0/O, 1/l/I) are excluded so a correct answer is never
    // rejected because the user read the image the only sensible way.
    'charset' => 'abcdefghjkmnpqrstuvwxyz23456789',

    'width' => 180,

    'height' => 60,

    // Fixed palette — the library otherwise randomises both per render and
    // regularly produces low-contrast, unreadable combinations. Light neutral
    // background, near-black glyphs, matching the auth forms.
    'background_rgb' => [245, 245, 245],

    'text_rgb' => [31, 41, 55],

];
