<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Application Assessment Meeting
 *
 * Stores Opening Meeting (Step 3) and Closing Meeting (Step 7) data.
 */
class ApplicationAssessmentMeeting extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'application_assessment_meetings';

    /**
     * Meeting type constants
     */
    public const TYPE_OPENING = 'opening';

    public const TYPE_CLOSING = 'closing';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'assessment_id',
        'type',
        'image_path',
        'disk',
        'latitude',
        'longitude',
        'conducted_at',
        'recording_links',
        'created_by',
    ];

    /**
     * The attributes that should be hidden for serialization.
     */
    protected $hidden = [
        'image_path',
        'disk',
    ];

    /**
     * The accessors to append to the model's array form.
     */
    protected $appends = [
        'image_url',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
        'conducted_at' => 'datetime',
        'recording_links' => 'array',
    ];

    /**
     * Get the download URL for the meeting image.
     * Includes cache-busting parameter based on updated_at timestamp.
     */
    public function getImageUrlAttribute(): ?string
    {
        if (! $this->image_path) {
            return null;
        }

        $url = route('api.v1.application-assessments.meetings.image', [
            'assessmentId' => $this->assessment_id,
            'type' => $this->type,
        ]);

        // Add cache-busting parameter to force browser refresh when image is updated
        $version = $this->updated_at?->timestamp ?? time();

        return "{$url}?v={$version}";
    }

    /**
     * Get the assessment this meeting belongs to.
     */
    public function assessment(): BelongsTo
    {
        return $this->belongsTo(Assessment::class);
    }

    /**
     * Get the user who created this meeting (lead assessor).
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the participants of this meeting.
     */
    public function participants(): HasMany
    {
        return $this->hasMany(ApplicationAssessmentMeetingParticipant::class, 'meeting_id');
    }

    /**
     * Get the default participants (assessors).
     */
    public function defaultParticipants(): HasMany
    {
        return $this->participants()->where('is_default', true);
    }

    /**
     * Get the optional/external participants.
     */
    public function optionalParticipants(): HasMany
    {
        return $this->participants()->where('is_default', false);
    }

    /**
     * Get the comments for this meeting.
     */
    public function comments(): HasMany
    {
        return $this->hasMany(ApplicationAssessmentMeetingComment::class, 'meeting_id');
    }

    /**
     * Scope for opening meetings.
     */
    public function scopeOpening(Builder $query): Builder
    {
        return $query->where('type', self::TYPE_OPENING);
    }

    /**
     * Scope for closing meetings.
     */
    public function scopeClosing(Builder $query): Builder
    {
        return $query->where('type', self::TYPE_CLOSING);
    }

    /**
     * Check if this is an opening meeting.
     */
    public function isOpening(): bool
    {
        return $this->type === self::TYPE_OPENING;
    }

    /**
     * Check if this is a closing meeting.
     */
    public function isClosing(): bool
    {
        return $this->type === self::TYPE_CLOSING;
    }
}
