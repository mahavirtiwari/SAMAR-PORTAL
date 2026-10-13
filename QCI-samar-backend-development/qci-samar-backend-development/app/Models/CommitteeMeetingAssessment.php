<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommitteeMeetingAssessment extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'committee_meeting_assessments';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'committee_meeting_id',
        'assessment_id',
        'decision',
        'remarks',
        'decided_by',
        'decided_at',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'decided_at' => 'datetime',
    ];

    /**
     * Get the meeting this record belongs to.
     */
    public function meeting(): BelongsTo
    {
        return $this->belongsTo(CommitteeMeeting::class, 'committee_meeting_id');
    }

    /**
     * Get the assessment.
     */
    public function assessment(): BelongsTo
    {
        return $this->belongsTo(Assessment::class, 'assessment_id');
    }

    /**
     * Get the user who made the decision.
     */
    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }

    /**
     * Check if decision is pending.
     */
    public function isPending(): bool
    {
        return $this->decision === 'pending';
    }

    /**
     * Check if certified.
     */
    public function isCertified(): bool
    {
        return $this->decision === 'certified';
    }

    /**
     * Check if sent for feedback.
     */
    public function isFeedback(): bool
    {
        return $this->decision === 'feedback';
    }
}
