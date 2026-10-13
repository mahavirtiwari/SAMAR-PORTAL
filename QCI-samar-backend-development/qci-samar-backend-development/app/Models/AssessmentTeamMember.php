<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\HasOne;

class AssessmentTeamMember extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'application_assessment_team_members';

    /**
     * Role constants
     */
    public const ROLE_LEAD_ASSESSOR = 'lead_assessor';

    public const ROLE_CO_ASSESSOR = 'co_assessor';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'assessment_id',
        'user_id',
        'role',
        'mobile_completed_at',
        'mobile_completed_metadata',
        'web_submitted_at',
        'web_submitted_metadata',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'mobile_completed_at' => 'datetime',
        'mobile_completed_metadata' => 'array',
        'web_submitted_at' => 'datetime',
        'web_submitted_metadata' => 'array',
    ];

    /**
     * True once this assessor has done their mobile cutover.
     */
    public function hasCompletedMobile(): bool
    {
        return $this->mobile_completed_at !== null;
    }

    /**
     * True once this co-assessor has submitted their portion on the web.
     */
    public function hasSubmittedWeb(): bool
    {
        return $this->web_submitted_at !== null;
    }

    /**
     * Get the assessment this team member belongs to.
     */
    public function assessment(): BelongsTo
    {
        return $this->belongsTo(Assessment::class);
    }

    /**
     * Get the user who is the team member.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Scope for team members by role.
     */
    public function scopeByRole(Builder $query, string $role): Builder
    {
        return $query->where('role', $role);
    }

    /**
     * Scope for lead assessors.
     */
    public function scopeLeadAssessors(Builder $query): Builder
    {
        return $query->where('role', self::ROLE_LEAD_ASSESSOR);
    }

    /**
     * Scope for co-assessors.
     */
    public function scopeCoAssessors(Builder $query): Builder
    {
        return $query->where('role', self::ROLE_CO_ASSESSOR);
    }

    /**
     * Check if this is the lead assessor.
     */
    public function isLeadAssessor(): bool
    {
        return $this->role === self::ROLE_LEAD_ASSESSOR;
    }

    /**
     * Check if this is a co-assessor.
     */
    public function isCoAssessor(): bool
    {
        return $this->role === self::ROLE_CO_ASSESSOR;
    }

    /**
     * Get the parameters assigned to this team member.
     */
    public function assignedParameters(): HasMany
    {
        return $this->hasMany(ApplicationAssessmentParameter::class, 'assigned_to_team_member_id');
    }

    /**
     * Get the questions assigned to this team member (through parameters).
     */
    public function assignedQuestions(): HasManyThrough
    {
        return $this->hasManyThrough(
            ApplicationAssessmentQuestion::class,
            ApplicationAssessmentParameter::class,
            'assigned_to_team_member_id', // FK on parameters
            'parameter_id',                // FK on questions
            'id',                          // Local key on team_members
            'id'                           // Local key on parameters
        );
    }

    /**
     * Get the attendance records for this team member.
     */
    public function attendances(): HasMany
    {
        return $this->hasMany(ApplicationAssessmentAttendance::class, 'team_member_id');
    }

    /**
     * The most recent attendance event for this team member. Eager-loadable so
     * "is this member on site?" can be resolved without an N+1 over a list.
     */
    public function latestAttendance(): HasOne
    {
        return $this->hasOne(ApplicationAssessmentAttendance::class, 'team_member_id')
            ->latestOfMany('recorded_at');
    }

    /**
     * Get the site pictures uploaded by this team member.
     */
    public function sitePictures(): HasMany
    {
        return $this->hasMany(ApplicationAssessmentSitePicture::class, 'team_member_id');
    }

    /**
     * Get the site tour pictures uploaded by this team member.
     */
    public function siteTourPictures(): HasMany
    {
        return $this->hasMany(ApplicationAssessmentSiteTourPicture::class, 'team_member_id');
    }

    /**
     * Get the meeting comments by this team member.
     */
    public function meetingComments(): HasMany
    {
        return $this->hasMany(ApplicationAssessmentMeetingComment::class, 'team_member_id');
    }

    /**
     * Boot method to add model event listeners.
     */
    protected static function boot(): void
    {
        parent::boot();

        // Validate that only one lead assessor exists per assessment
        static::saving(function (self $teamMember) {
            if ($teamMember->role === self::ROLE_LEAD_ASSESSOR) {
                $existingLeadAssessor = self::where('assessment_id', $teamMember->assessment_id)
                    ->where('role', self::ROLE_LEAD_ASSESSOR)
                    ->where('id', '!=', $teamMember->id ?? 0)
                    ->exists();

                if ($existingLeadAssessor) {
                    throw new \InvalidArgumentException(
                        'An assessment can only have one lead assessor. Please remove the existing lead assessor first.'
                    );
                }
            }
        });
    }
}
