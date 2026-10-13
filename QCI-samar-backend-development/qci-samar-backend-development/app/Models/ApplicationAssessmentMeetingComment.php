<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Application Assessment Meeting Comment
 *
 * Stores mandatory comments from each assessor for meetings.
 * Each assessor (lead and co-assessors) must add their own comment.
 */
class ApplicationAssessmentMeetingComment extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'application_assessment_meeting_comments';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'meeting_id',
        'team_member_id',
        'comment',
    ];

    /**
     * Get the meeting this comment belongs to.
     */
    public function meeting(): BelongsTo
    {
        return $this->belongsTo(ApplicationAssessmentMeeting::class, 'meeting_id');
    }

    /**
     * Get the team member who wrote this comment.
     */
    public function teamMember(): BelongsTo
    {
        return $this->belongsTo(AssessmentTeamMember::class, 'team_member_id');
    }
}
