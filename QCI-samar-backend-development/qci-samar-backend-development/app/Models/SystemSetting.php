<?php

namespace App\Models;

use App\Traits\HasAuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class SystemSetting extends Model
{
    use HasAuditLog;

    protected $fillable = [
        'key',
        'value',
        'description',
    ];

    /**
     * Settings are audited with a semantic per-key event in setValue(), so the
     * trait's generic created/updated row would only duplicate it.
     */
    protected static function auditsGenericChanges(): bool
    {
        return false;
    }

    /** Settings are read on every request (maintenance mode); cache each briefly. */
    private const CACHE_SECONDS = 60;

    protected static function booted(): void
    {
        $forget = fn (self $setting) => Cache::forget(self::cacheKey($setting->key));
        static::saved($forget);
        static::deleted($forget);
    }

    private static function cacheKey(string $key): string
    {
        return 'system_setting:'.$key;
    }

    /**
     * Get setting value by key
     */
    public static function getValue(string $key, $default = null)
    {
        // Wrapped so a missing setting (null) is cached too.
        $cached = Cache::remember(self::cacheKey($key), self::CACHE_SECONDS, fn () => ['value' => self::where('key', $key)->value('value')]);

        return $cached['value'] ?? $default;
    }

    /**
     * Set (create or update) a setting by key and audit the change.
     *
     * This is the single write path for settings: routing every mutation
     * through here means maintenance mode, upload config, and any future
     * toggle are captured in the audit trail with actor, exact key, and the
     * old -> new value. A no-op write (same value) records nothing.
     */
    public static function setValue(string $key, $value, ?string $description = null): self
    {
        $existing = self::where('key', $key)->first();
        $oldValue = $existing?->value;

        $attributes = ['value' => $value];
        if ($description !== null) {
            $attributes['description'] = $description;
        }

        $setting = self::updateOrCreate(['key' => $key], $attributes);

        if ($existing === null) {
            $setting->logAudit(
                'setting_created',
                newValues: ['value' => (string) $value],
                changedFields: ['value'],
                description: "System setting '{$key}' created.",
                metadata: ['key' => $key],
            );
        } elseif ((string) $oldValue !== (string) $value) {
            $setting->logAudit(
                'setting_updated',
                oldValues: ['value' => $oldValue],
                newValues: ['value' => (string) $value],
                changedFields: ['value'],
                description: "System setting '{$key}' changed.",
                metadata: ['key' => $key],
            );
        }

        return $setting;
    }

    /**
     * Check if DRDO approval is required
     */
    public static function isDrdoApprovalRequired(): bool
    {
        $value = self::getValue('drdo_approval_required', 'true');

        return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }

    /**
     * Check if system is in maintenance mode
     */
    public static function isMaintenanceMode(): bool
    {
        $value = self::getValue('maintenance_mode', 'false');

        return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }

    /**
     * Check if application submission is open
     */
    public static function isApplicationSubmissionOpen(): bool
    {
        $value = self::getValue('application_submission_open', 'true');

        return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }

    /**
     * Get certificate validity period in years
     */
    public static function getCertificateValidityYears(): int
    {
        return (int) self::getValue('certificate_validity_years', 3);
    }

    /**
     * Get the recertification window in days.
     *
     * Renewal opens this many days before a certificate's expiry date (and
     * stays open after expiry). Single source of truth for the renewal window.
     */
    public static function getRecertificationWindowDays(): int
    {
        return (int) self::getValue('recertification_window_days', 90);
    }
}
