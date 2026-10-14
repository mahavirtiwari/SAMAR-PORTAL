<?php

namespace App\Models;

use App\Traits\TracksUserActions;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Email Notification Template Model
 *
 * Stores metadata and configuration for email notification templates.
 * Email body content is handled by Blade templates in resources/views/emails/
 *
 * This is an email-only notification system.
 *
 * Template Path Resolution (EmailNotificationService):
 * - Primary: emails/{category}/{slug}.blade.php
 * - Fallback: emails/{slug}.blade.php (flat structure)
 *
 * @property string $slug Unique template identifier
 * @property string $category Template category (application, payment, assessment, etc.)
 * @property string $subject Email subject line (supports {{ variable }} syntax)
 */
class EmailNotificationTemplate extends Model
{
    use HasFactory, SoftDeletes, TracksUserActions;

    protected $table = 'notification_templates';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'slug',
        'name',
        'description',
        'event',
        'category',
        'subject',
        'title',
        'body',
        'customized_at',
        'cc',
        'bcc',
        'variables',
        'variables_description',
        'recipient_roles',
        'send_to_creator',
        'has_attachment',
        'is_active',
        'priority',
        'created_by',
        'updated_by',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'cc' => 'array',
        'bcc' => 'array',
        'variables' => 'array',
        'recipient_roles' => 'array',
        'send_to_creator' => 'boolean',
        'has_attachment' => 'boolean',
        'is_active' => 'boolean',
        'customized_at' => 'datetime',
    ];

    /**
     * Get the email notification events using this template.
     */
    public function emailNotificationEvents(): HasMany
    {
        return $this->hasMany(EmailNotificationEvent::class, 'email_notification_template_id');
    }

    /**
     * Scope: Active templates.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope: By event.
     */
    public function scopeForEvent(Builder $query, string $event): Builder
    {
        return $query->where('event', $event);
    }

    /**
     * Scope: By category.
     */
    public function scopeByCategory(Builder $query, string $category): Builder
    {
        return $query->where('category', $category);
    }

    /**
     * Replace template variables with actual data.
     *
     * NOTE: Email body is now handled by Blade templates, not this method.
     * This method only renders the email subject line.
     */
    public function renderTemplate(array $data): array
    {
        return [
            'subject' => $this->replaceVariables($this->subject, $data),
            // Email body rendered by Blade templates in EmailNotificationService
        ];
    }

    /**
     * Replace variables in a string.
     */
    protected function replaceVariables(?string $text, array $data): ?string
    {
        if (! $text) {
            return null;
        }

        foreach ($data as $key => $value) {
            $text = str_replace('{{'.$key.'}}', $value, $text);
        }

        return $text;
    }
}
