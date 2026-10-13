<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Application Assessment Parameter
 *
 * Stores copied parameter data for an assessment. This is immutable -
 * copied from master assessment_parameters when assessment starts.
 */
class ApplicationAssessmentParameter extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'application_assessment_parameters';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'assessment_id',
        'discipline_name',
        'code',
        'name',
        'is_mandatory',
        'assigned_to_team_member_id',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'is_mandatory' => 'boolean',
    ];

    /**
     * Get the assessment this parameter belongs to.
     */
    public function assessment(): BelongsTo
    {
        return $this->belongsTo(Assessment::class);
    }

    /**
     * Get the questions for this parameter.
     */
    public function questions(): HasMany
    {
        return $this->hasMany(ApplicationAssessmentQuestion::class, 'parameter_id');
    }

    /**
     * Get the team member assigned to this parameter.
     */
    public function assignedTeamMember(): BelongsTo
    {
        return $this->belongsTo(AssessmentTeamMember::class, 'assigned_to_team_member_id');
    }

    /**
     * Check if this parameter is assigned to a team member.
     */
    public function isAssigned(): bool
    {
        return $this->assigned_to_team_member_id !== null;
    }

    /**
     * Scope for assigned parameters.
     */
    public function scopeAssigned($query)
    {
        return $query->whereNotNull('assigned_to_team_member_id');
    }

    /**
     * Scope for the assessed set: mandatory parameters (always in scope) plus
     * optional parameters that were assigned to a team member. This is the
     * canonical "what's actually being assessed" filter — use it wherever you
     * need the parameter list that drives scores, counts, or PDF output.
     */
    public function scopeAssessed($query)
    {
        return $query->where(function ($q) {
            $q->where('is_mandatory', true)
                ->orWhereNotNull('assigned_to_team_member_id');
        });
    }

    /**
     * Scope for unassigned parameters.
     */
    public function scopeUnassigned($query)
    {
        return $query->whereNull('assigned_to_team_member_id');
    }

    /**
     * Scope for parameters assigned to a specific team member.
     */
    public function scopeAssignedTo($query, int $teamMemberId)
    {
        return $query->where('assigned_to_team_member_id', $teamMemberId);
    }
}
