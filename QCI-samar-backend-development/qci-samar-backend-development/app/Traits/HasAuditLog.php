<?php

namespace App\Traits;

use App\Models\AuditLog;
use App\Models\User;
use App\Support\AuditContext;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

trait HasAuditLog
{
    /**
     * When true, the generic status-only "updated" audit row is skipped. Set
     * around a state-machine transition that writes its own semantic entry, so
     * a business status change is not logged twice. Per-class — each model
     * using the trait gets its own copy via late static binding.
     */
    protected static bool $suppressStatusUpdateAudit = false;

    /**
     * Boot the trait.
     */
    protected static function bootHasAuditLog(): void
    {
        // Track created event
        static::created(function ($model) {
            if (! static::auditsGenericChanges()) {
                return;
            }

            $model->logAudit('created', null, $model->getAuditableAttributes());
        });

        // Track updated event
        static::updated(function ($model) {
            if (! static::auditsGenericChanges()) {
                return;
            }

            $oldValues = $model->getOriginal();
            $newValues = $model->getAttributes();

            $changes = $model->getChanges();
            unset($changes['updated_at']); // Don't track updated_at changes

            if (empty($changes)) {
                return;
            }

            // A whitelisted workflow transition writes its own semantic entry, so
            // the generic row for a status-only change would just duplicate it.
            if (static::$suppressStatusUpdateAudit && array_keys($changes) === ['status']) {
                return;
            }

            $model->logAudit('updated', $oldValues, $newValues, array_keys($changes));
        });

        // Track deleted event
        static::deleted(function ($model) {
            if (! static::auditsGenericChanges()) {
                return;
            }

            $model->logAudit('deleted', $model->getAuditableAttributes(), null);
        });

        // Track restored event (if using soft deletes)
        if (method_exists(static::class, 'restored')) {
            static::restored(function ($model) {
                if (! static::auditsGenericChanges()) {
                    return;
                }

                $model->logAudit('restored', null, $model->getAuditableAttributes());
            });
        }
    }

    /**
     * When false, the model's generic created/updated/deleted/restored audit
     * rows are not written — only explicit logAudit() calls (e.g. the state
     * machine's semantic workflow-transition entries) are recorded. Override
     * per model to opt a high-churn entity out of field-level auditing while
     * keeping its meaningful workflow trail.
     */
    protected static function auditsGenericChanges(): bool
    {
        return true;
    }

    /**
     * Run $callback with the generic status-only "updated" audit row suppressed
     * for this model class. Used by the state machine so a business transition
     * logs one semantic entry instead of a duplicate generic "Updated" row.
     */
    public static function withoutStatusUpdateAudit(callable $callback)
    {
        $previous = static::$suppressStatusUpdateAudit;
        static::$suppressStatusUpdateAudit = true;

        try {
            return $callback();
        } finally {
            static::$suppressStatusUpdateAudit = $previous;
        }
    }

    /**
     * Get all audit logs for this model.
     */
    public function auditLogs(): MorphMany
    {
        return $this->morphMany(AuditLog::class, 'auditable')
            ->orderBy('created_at', 'desc');
    }

    /**
     * Log an audit event.
     */
    public function logAudit(
        string $event,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?array $changedFields = null,
        ?string $description = null,
        array $metadata = [],
        ?User $actor = null
    ): AuditLog {
        // $actor covers events fired before the auth guard is populated
        // (login, password reset), where Auth::user() is still null.
        $user = $actor ?? Auth::user();

        // Model-event audits fire inside Eloquent and have no seam to pass an
        // actor, so CLI/console writes fall back to the ambient system actor.
        $systemActor = $user ? null : AuditContext::details();

        return AuditLog::create([
            'auditable_type' => get_class($this),
            'auditable_id' => $this->id,
            'event' => in_array($event, ['created', 'updated', 'deleted', 'restored', 'accessed'])
                ? $event
                : 'custom',
            'custom_event' => ! in_array($event, ['created', 'updated', 'deleted', 'restored', 'accessed'])
                ? $event
                : null,
            'user_id' => $user?->id,
            'user_name' => $user ? $user->full_name : AuditContext::label(),
            'user_email' => $user?->email,
            'user_roles' => $user?->roles->pluck('slug')->toArray(),
            'old_values' => $this->filterSensitiveData($oldValues),
            'new_values' => $this->filterSensitiveData($newValues),
            'changed_fields' => $changedFields,
            'ip_address' => Request::ip(),
            'user_agent' => Request::userAgent(),
            'request_method' => Request::method(),
            'request_url' => Request::fullUrl(),
            'description' => $description,
            'metadata' => $systemActor ? $metadata + ['actor' => $systemActor] : $metadata,
        ]);
    }

    /**
     * Get auditable attributes (override to customize).
     */
    protected function getAuditableAttributes(): array
    {
        return $this->getAttributes();
    }

    /**
     * Filter sensitive data from audit logs.
     */
    protected function filterSensitiveData(?array $data): ?array
    {
        if (! $data) {
            return null;
        }

        $sensitive = $this->getAuditSensitiveFields();

        foreach ($sensitive as $field) {
            if (isset($data[$field])) {
                $data[$field] = '***REDACTED***';
            }
        }

        return $data;
    }

    /**
     * Get fields that should be redacted in audit logs.
     */
    protected function getAuditSensitiveFields(): array
    {
        return [
            'password',
            'remember_token',
            'otp_code',
            'reset_token',
            'email_verification_token',
            'api_token',
            'access_token',
            'refresh_token',
        ];
    }
}
