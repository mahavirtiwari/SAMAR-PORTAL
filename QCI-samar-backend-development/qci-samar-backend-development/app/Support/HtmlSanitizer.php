<?php

namespace App\Support;

use HTMLPurifier;
use HTMLPurifier_Config;

/**
 * Sanitises admin-authored HTML (email bodies, instructions, disclaimers)
 * before it is stored.
 *
 * Allows the table-based, inline-styled markup that email clients need and
 * removes anything executable (scripts, event handlers, javascript: URLs).
 * {{placeholder}} tokens are protected so they survive, including inside
 * href attributes where the URI filter would otherwise mangle them.
 */
class HtmlSanitizer
{
    private const TOKEN_PATTERN = '/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/';

    private const SENTINEL_PREFIX = 'samarplaceholder';

    private ?HTMLPurifier $purifier = null;

    public function clean(?string $html): string
    {
        if ($html === null || trim($html) === '') {
            return '';
        }

        // Swap {{name}} for a URI-safe sentinel, purify, then swap back.
        $protected = preg_replace_callback(
            self::TOKEN_PATTERN,
            fn (array $m) => self::SENTINEL_PREFIX.'-'.$m[1].'-end',
            $html
        );

        $clean = $this->purifier()->purify($protected);

        return preg_replace_callback(
            '/'.self::SENTINEL_PREFIX.'-([A-Za-z_][A-Za-z0-9_]*)-end/',
            fn (array $m) => '{{'.$m[1].'}}',
            $clean
        );
    }

    private function purifier(): HTMLPurifier
    {
        if ($this->purifier !== null) {
            return $this->purifier;
        }

        $config = HTMLPurifier_Config::createDefault();
        $config->set('Cache.SerializerPath', storage_path('framework/cache'));
        $config->set('HTML.Doctype', 'XHTML 1.0 Transitional');
        $config->set(
            'HTML.Allowed',
            'p,br,hr,div,span,strong,b,em,i,u,s,small,sup,sub,blockquote,'
            .'h1,h2,h3,h4,h5,h6,ul,ol,li,'
            .'a[href|title|target|rel],'
            .'table[width|cellpadding|cellspacing|border|align|bgcolor],'
            .'thead,tbody,tfoot,tr[align|valign|bgcolor],'
            .'td[width|height|colspan|rowspan|align|valign|bgcolor],'
            .'th[width|height|colspan|rowspan|align|valign|bgcolor],'
            .'*[style]'
        );
        $config->set('CSS.AllowedProperties', [
            'color', 'background-color', 'font-family', 'font-size', 'font-weight', 'font-style',
            'text-align', 'text-decoration', 'line-height', 'letter-spacing',
            'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
            'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
            'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
            'width', 'height', 'vertical-align', 'white-space', 'list-style-type',
        ]);
        $config->set('URI.AllowedSchemes', ['http' => true, 'https' => true, 'mailto' => true, 'tel' => true]);
        $config->set('Attr.AllowedFrameTargets', ['_blank']);
        $config->set('HTML.TargetBlank', false);
        $config->set('AutoFormat.RemoveEmpty', false);

        return $this->purifier = new HTMLPurifier($config);
    }
}
