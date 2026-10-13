<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Application Assessment Attendance
 *
 * Tracks punch-in/punch-out for assessors during on-site assessments.
 */
class ApplicationAssessmentAttendance extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'application_assessment_attendances';

    /**
     * Attendance type constants
     */
    public const TYPE_PUNCH_IN = 'punch_in';

    public const TYPE_PUNCH_OUT = 'punch_out';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'assessment_id',
        'team_member_id',
        'client_uuid',
        'type',
        'selfie_path',
        'disk',
        'latitude',
        'longitude',
        'recorded_at',
        'device_metadata',
    ];

    /**
     * The attributes that should be hidden for serialization.
     */
    protected $hidden = [
        'selfie_path',
        'disk',
    ];

    /**
     * The accessors to append to the model's array form.
     */
    protected $appends = [
        'selfie_url',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
        'recorded_at' => 'datetime',
        'device_metadata' => 'array',
    ];

    /**
     * Get the download URL for the selfie.
     */
    public function getSelfieUrlAttribute(): ?string
    {
        if (! $this->selfie_path) {
            return null;
        }

        return route('api.v1.application-assessments.attendance.selfie', [
            'assessmentId' => $this->assessment_id,
            'attendanceId' => $this->id,
        ]);
    }

    /**
     * Get the assessment this attendance belongs to.
     */
    public function assessment(): BelongsTo
    {
        return $this->belongsTo(Assessment::class);
    }

    /**
     * Get the team member who recorded this attendance.
     */
    public function teamMember(): BelongsTo
    {
        return $this->belongsTo(AssessmentTeamMember::class, 'team_member_id');
    }

    /**
     * Scope for punch-in records.
     */
    public function scopePunchIn(Builder $query): Builder
    {
        return $query->where('type', self::TYPE_PUNCH_IN);
    }

    /**
     * Scope for punch-out records.
     */
    public function scopePunchOut(Builder $query): Builder
    {
        return $query->where('type', self::TYPE_PUNCH_OUT);
    }

    /**
     * Check if this is a punch-in record.
     */
    public function isPunchIn(): bool
    {
        return $this->type === self::TYPE_PUNCH_IN;
    }

    /**
     * Check if this is a punch-out record.
     */
    public function isPunchOut(): bool
    {
        return $this->type === self::TYPE_PUNCH_OUT;
    }
}
