<?php

namespace App\Services\Email;

use App\Models\MailConfiguration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Applies the System Admin's mail server settings (Settings → Email Server)
 * on top of the MAIL_* environment config. Runs once per request/command at
 * boot; the row is cached until it is saved again.
 */
class MailConfigurationApplier
{
    public const CACHE_KEY = 'mail_configuration.current';

    /** Environment mail settings as they were before any override. */
    private static ?array $environmentDefaults = null;

    public static function environmentDefaults(): array
    {
        return self::$environmentDefaults ?? self::snapshot();
    }

    private static function snapshot(): array
    {
        return [
            'mailer' => config('mail.default'),
            'host' => config('mail.mailers.smtp.host'),
            'port' => config('mail.mailers.smtp.port') ? (int) config('mail.mailers.smtp.port') : null,
            'from_address' => config('mail.from.address'),
            'from_name' => config('mail.from.name'),
        ];
    }

    public function apply(): void
    {
        self::$environmentDefaults ??= self::snapshot();

        try {
            $settings = Cache::rememberForever(self::CACHE_KEY, fn () => MailConfiguration::query()->first());
        } catch (\Throwable $e) {
            // Table missing (fresh install before migrate) or DB unavailable:
            // keep the environment's mail settings.
            return;
        }

        if (! $settings || ! $settings->enabled || ! $settings->host) {
            return;
        }

        try {
            config([
                'mail.default' => 'smtp',
                'mail.mailers.smtp' => array_merge((array) config('mail.mailers.smtp', []), $settings->toMailerConfig()),
            ]);
            if ($settings->from_address) {
                config(['mail.from.address' => $settings->from_address]);
            }
            if ($settings->from_name) {
                config(['mail.from.name' => $settings->from_name]);
            }
            if (app()->resolved('mail.manager')) {
                app('mail.manager')->purge('smtp');
            }
        } catch (\Throwable $e) {
            // e.g. the app key changed and the password no longer decrypts.
            Log::error('Saved mail server settings could not be applied; using the environment settings', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    public static function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
    }
}
