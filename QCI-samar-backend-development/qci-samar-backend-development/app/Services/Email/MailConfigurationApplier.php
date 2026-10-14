<?php

namespace App\Services\Email;

use App\Models\MailConfiguration;
use Illuminate\Mail\Events\MessageSending;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Mime\Address;

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

    private static function settings(): ?MailConfiguration
    {
        try {
            // false = "no row", so an empty table is cached too instead of queried on every request.
            return Cache::rememberForever(self::CACHE_KEY, fn () => MailConfiguration::query()->first() ?? false) ?: null;
        } catch (\Throwable $e) {
            // Table missing (fresh install before migrate) or DB unavailable.
            return null;
        }
    }

    /**
     * Addresses blind-copied on every outgoing email. Independent of the
     * custom SMTP switch, so it also applies to the environment mailer.
     *
     * @return list<string>
     */
    public static function bccAddresses(): array
    {
        return array_values(array_filter((array) (self::settings()->bcc ?? [])));
    }

    /**
     * MessageSending listener: adds the configured BCC addresses that the
     * message does not already go to.
     */
    public static function addBcc(MessageSending $event): void
    {
        $addresses = self::bccAddresses();
        if ($addresses === []) {
            return;
        }
        $message = $event->message;
        $existing = array_map(
            fn (Address $a) => strtolower($a->getAddress()),
            [...$message->getTo(), ...$message->getCc(), ...$message->getBcc()],
        );
        foreach ($addresses as $address) {
            if (! in_array(strtolower($address), $existing, true)) {
                $message->addBcc($address);
            }
        }
    }

    public function apply(): void
    {
        self::$environmentDefaults ??= self::snapshot();

        // No row, table missing or DB unavailable: keep the environment's settings.
        $settings = self::settings();

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
