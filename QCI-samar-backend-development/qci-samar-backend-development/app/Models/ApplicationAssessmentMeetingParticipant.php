<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Application Assessment Meeting Participant
 *
 * Stores participants for Opening and Closing meetings.
 * Default participants are assessors, optional participants are external.
 */
class ApplicationAssessmentMeetingParticipant extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'application_assessment_meeting_participants';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'meeting_id',
        'team_member_id',
        'name',
        'designation',
        'is_default',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'is_default' => 'boolean',
    ];

    /**
     * Get the meeting this participant belongs to.
     */
    public function meeting(): BelongsTo
    {
        return $this->belongsTo(ApplicationAssessmentMeeting::class, 'meeting_id');
    }

    /**
     * Get the team member (for assessor participants).
     */
    public function teamMember(): BelongsTo
    {
        return $this->belongsTo(AssessmentTeamMember::class, 'team_member_id');
    }

    /**
     * Check if this is a default participant (assessor).
     */
    public function isDefault(): bool
    {
        return $this->is_default;
    }

    /**
     * Check if this is an external participant.
     */
    public function isExternal(): bool
    {
        return ! $this->is_default && $this->team_member_id === null;
    }

    /**
     * Get the display name for this participant.
     */
    public function getDisplayNameAttribute(): string
    {
        if ($this->team_member_id && $this->teamMember) {
            return $this->teamMember->user->name ?? $this->name ?? 'Unknown';
        }

        return $this->name ?? 'Unknown';
    }
}
