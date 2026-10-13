<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class AuditLog extends Model
{
    public const UPDATED_AT = null; // No updated_at for audit logs

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'auditable_type',
        'auditable_id',
        'event',
        'custom_event',
        'user_id',
        'user_name',
        'user_email',
        'user_roles',
        'old_values',
        'new_values',
        'changed_fields',
        'ip_address',
        'user_agent',
        'request_method',
        'request_url',
        'tags',
        'description',
        'metadata',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'user_roles' => 'array',
        'old_values' => 'array',
        'new_values' => 'array',
        'changed_fields' => 'array',
        'tags' => 'array',
        'metadata' => 'array',
        'created_at' => 'datetime',
    ];

    /**
     * Get the auditable model.
     */
    public function auditable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * Get the user who performed the action.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get a human-readable description of the change.
     */
    public function getDescription(): string
    {
        if ($this->description) {
            return $this->description;
        }

        $event = $this->custom_event ?? $this->event;
        $modelName = class_basename($this->auditable_type);

        return "{$this->user_name} {$event} {$modelName} #{$this->auditable_id}";
    }

    /**
     * Get summary of changes.
     */
    public function getChangesSummary(): array
    {
        if (! $this->changed_fields) {
            return [];
        }

        $summary = [];

        foreach ($this->changed_fields as $field) {
            $summary[$field] = [
                'old' => $this->old_values[$field] ?? null,
                'new' => $this->new_values[$field] ?? null,
            ];
        }

        return $summary;
    }
}
