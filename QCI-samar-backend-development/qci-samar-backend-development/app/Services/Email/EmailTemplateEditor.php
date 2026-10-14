<?php

namespace App\Services\Email;

use App\Models\EmailNotificationTemplate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\View;

/**
 * Backs Settings → Email Templates: the default (Blade) heading and body of a
 * template as editable HTML with {{placeholders}}, the placeholders it can
 * use, and rendering a template with sample or real data.
 *
 * A template with a custom `body` renders through emails.custom inside the
 * same layout as the Blade views; without one it keeps using its Blade view.
 */
class EmailTemplateEditor
{
    private const PLACEHOLDER_PATTERN = '/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/';

    /** Variables every email can use (added by EmailNotificationService). */
    public const COMMON_PLACEHOLDERS = ['user_name', 'user_email', 'user_first_name', 'user_last_name', 'user_samar_id', 'portal_url'];

    /** Blade-internal names that are not template data. */
    private const INTERNAL_VARIABLES = ['item', 'items', 'accountItems', 'loop', 'mode', 'errors', '__env', '__data', 'app', 'message', 'this', 'name', 'slot'];

    public function bladeViewFor(EmailNotificationTemplate $template): ?string
    {
        foreach ([
            'emails.'.$template->category.'.'.$template->slug,
            'emails.auth.'.$template->slug,
            'emails.'.$template->slug,
        ] as $view) {
            if (View::exists($view)) {
                return $view;
            }
        }

        return null;
    }

    /**
     * Placeholders available to a template: its declared variables, the
     * variables its Blade view reads, and the common user variables.
     *
     * @return array<int, string>
     */
    public function placeholdersFor(EmailNotificationTemplate $template): array
    {
        $names = array_merge(
            (array) ($template->variables ?? []),
            $this->bladeVariables($template),
            self::COMMON_PLACEHOLDERS,
        );
        $names = array_values(array_unique(array_filter($names, fn ($n) => is_string($n) && preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $n))));
        sort($names);

        return $names;
    }

    /**
     * The template's Blade heading and body with every variable rendered as a
     * {{placeholder}} token, i.e. the starting point for a custom version.
     *
     * @return array{title: string, body: string}|null null when the view cannot be rendered with tokens
     */
    public function defaultContent(EmailNotificationTemplate $template): ?array
    {
        $view = $this->bladeViewFor($template);
        if ($view === null) {
            return null;
        }

        $tokens = [];
        foreach ($this->placeholdersFor($template) as $name) {
            $tokens[$name] = '{{'.$name.'}}';
        }

        try {
            $sections = view($view, $tokens)->renderSections();
        } catch (\Throwable $e) {
            Log::info('Email template default content could not be tokenised', [
                'template' => $template->slug,
                'error' => $e->getMessage(),
            ]);

            return null;
        } finally {
            // renderSections() leaves the section stack populated; clear it so
            // the next render (or the next template) starts clean.
            View::flushState();
        }

        return [
            'title' => trim(html_entity_decode((string) ($sections['title'] ?? ''), ENT_QUOTES)),
            'body' => trim((string) ($sections['content'] ?? '')),
        ];
    }

    /**
     * Renders a template to full email HTML with the given data. Uses the
     * custom title/body when present (or when passed as overrides, for a
     * preview of unsaved edits), else the Blade view.
     */
    public function render(EmailNotificationTemplate $template, array $data, ?string $titleOverride = null, ?string $bodyOverride = null): string
    {
        $data += ['portal_url' => config('app.frontend_url')];
        $body = $bodyOverride ?? $template->body;

        if ($body !== null && trim($body) !== '') {
            $title = $titleOverride ?? $template->title ?? ($this->defaultContent($template)['title'] ?? $template->name);

            return view('emails.custom', [
                'customTitle' => $this->fill($title, $data, false),
                'customBody' => $this->fill($body, $data, true),
            ])->render();
        }

        $view = $this->bladeViewFor($template);
        if ($view === null) {
            return '';
        }

        try {
            return view($view, $data)->render();
        } finally {
            View::flushState();
        }
    }

    /**
     * Sample data for previews and test emails: each placeholder shows its own
     * name, e.g. [application_number], so the admin can see where it lands.
     *
     * @return array<string, string>
     */
    public function sampleData(EmailNotificationTemplate $template): array
    {
        $data = [];
        foreach ($this->placeholdersFor($template) as $name) {
            $data[$name] = '['.$name.']';
        }
        $data['portal_url'] = config('app.frontend_url');

        return $data;
    }

    /**
     * Replaces {{name}} tokens with values. Values are HTML-escaped in bodies;
     * unknown placeholders become empty rather than leaking the raw token.
     */
    public function fill(string $content, array $data, bool $html): string
    {
        return preg_replace_callback(self::PLACEHOLDER_PATTERN, function (array $m) use ($data, $html) {
            $value = $data[$m[1]] ?? '';
            if (! is_scalar($value)) {
                $value = '';
            }

            return $html ? e((string) $value) : (string) $value;
        }, $content);
    }

    /**
     * Variables a template's Blade view (and the components it includes) reads.
     *
     * @return array<int, string>
     */
    private function bladeVariables(EmailNotificationTemplate $template): array
    {
        $view = $this->bladeViewFor($template);
        if ($view === null) {
            return [];
        }

        $sources = [View::getFinder()->find($view)];
        foreach (glob(resource_path('views/emails/components/*.blade.php')) ?: [] as $component) {
            $sources[] = $component;
        }

        $names = [];
        foreach ($sources as $index => $path) {
            $source = (string) @file_get_contents($path);
            // Component files only contribute variables when the view includes them.
            if ($index > 0) {
                $component = basename($path, '.blade.php');
                if (! str_contains((string) @file_get_contents($sources[0]), 'emails.components.'.$component)) {
                    continue;
                }
            }
            preg_match_all('/\$([A-Za-z_][A-Za-z0-9_]*)/', $source, $m);
            $names = array_merge($names, $m[1]);
        }

        return array_values(array_diff(array_unique($names), self::INTERNAL_VARIABLES));
    }
}
