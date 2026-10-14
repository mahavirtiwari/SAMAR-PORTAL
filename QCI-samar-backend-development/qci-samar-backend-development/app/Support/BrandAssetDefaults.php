<?php

namespace App\Support;

/**
 * The replaceable logos and their built-in images.
 *
 * `email_image` / `pdf_image` are the files (under public/) the emails and
 * committee PDFs use until an admin uploads a replacement; the web app has
 * its own bundled copies. One upload replaces the logo everywhere it is used.
 */
class BrandAssetDefaults
{
    /**
     * @return array<int, array{key: string, title: string, description: string, link_url: ?string, email_image: ?string, pdf_image: ?string}>
     */
    public static function all(): array
    {
        return [
            [
                'key' => 'samar_logo',
                'title' => 'SAMAR Logo',
                'description' => 'Login, registration, policy, certificate verification and maintenance pages, the collapsed sidebar, email header and committee PDFs.',
                'link_url' => null,
                'email_image' => 'images/emails/samar-logo-2026.png',
                'pdf_image' => 'pdf/samar_logo.png',
            ],
            [
                'key' => 'sidebar_logo',
                'title' => 'Sidebar Logo',
                'description' => 'The full logo at the top of the expanded sidebar after sign-in (shown on the blue sidebar, so a light/white wordmark works best).',
                'link_url' => null,
                'email_image' => null,
                'pdf_image' => null,
            ],
            [
                'key' => 'drdo_logo',
                'title' => 'DRDO Logo',
                'description' => 'Public page headers, email footer (left) and committee PDFs.',
                'link_url' => 'https://www.drdo.gov.in',
                'email_image' => 'images/emails/footer-left.png',
                'pdf_image' => 'pdf/drdo_logo.png',
            ],
            [
                'key' => 'qci_logo',
                'title' => 'QCI Logo',
                'description' => 'Public page headers, email footer (right) and committee PDFs.',
                'link_url' => 'https://www.qcin.org',
                'email_image' => 'images/emails/footer-right.png',
                'pdf_image' => 'pdf/qci_logo.png',
            ],
            [
                'key' => 'favicon',
                'title' => 'Browser Icon (Favicon)',
                'description' => 'The small icon shown on the browser tab.',
                'link_url' => null,
                'email_image' => null,
                'pdf_image' => null,
            ],
        ];
    }

    public static function find(string $key): ?array
    {
        foreach (self::all() as $asset) {
            if ($asset['key'] === $key) {
                return $asset;
            }
        }

        return null;
    }
}
