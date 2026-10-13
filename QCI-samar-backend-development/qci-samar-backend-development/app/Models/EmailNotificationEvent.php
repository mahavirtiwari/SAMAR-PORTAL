<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Email Notification Event Model
 *
 * Tracks email delivery events and audit trail.
 * Each record represents a single email sent to a recipient.
 */
class EmailNotificationEvent extends Model
{
    use HasFactory;

    protected $table = 'notification_events';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'email_notification_template_id',
        'event',
        'notifiable_type',
        'notifiable_id',
        'user_id',
        'recipient_email',
        'recipient_name',
        'sent',
        'status',
        'subject',
        'body',
        'sent_at',
        'delivered_at',
        'opened_at',
        'clicked_at',
        'error_message',
        'data',
        'attempts',
        'last_attempt_at',
        'next_retry_at',
        'priority',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'sent' => 'boolean',
        'data' => 'array',
        'sent_at' => 'datetime',
        'delivered_at' => 'datetime',
        'opened_at' => 'datetime',
        'clicked_at' => 'datetime',
        'last_attempt_at' => 'datetime',
        'next_retry_at' => 'datetime',
    ];

    /**
     * Get the email notification template.
     */
    public function emailNotificationTemplate(): BelongsTo
    {
        return $this->belongsTo(EmailNotificationTemplate::class, 'email_notification_template_id');
    }

    /**
     * Get the user recipient.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the notifiable model (polymorphic).
     */
    public function notifiable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * Scope: For user.
     */
    public function scopeForUser(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Scope: By status.
     */
    public function scopeByStatus(Builder $query, string $status): Builder
    {
        return $query->where('status', $status);
    }

    /**
     * Scope: Pending emails.
     */
    public function scopePending(Builder $query): Builder
    {
        return $query->whereIn('status', ['pending', 'queued']);
    }

    /**
     * Scope: Failed emails.
     */
    public function scopeFailed(Builder $query): Builder
    {
        return $query->where('status', 'failed');
    }
}
