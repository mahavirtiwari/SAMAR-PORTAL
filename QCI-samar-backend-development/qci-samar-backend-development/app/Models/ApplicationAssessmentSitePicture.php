<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Application Assessment Site Picture
 *
 * Stores site photographs captured by assessors (Step 2).
 */
class ApplicationAssessmentSitePicture extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'application_assessment_site_pictures';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'assessment_id',
        'team_member_id',
        'uploaded_by_user_id',
        'uploader_type',
        'is_selected',
        'selected_by_team_member_id',
        'selected_at',
        'client_uuid',
        'title',
        'file_path',
        'file_name',
        'file_size',
        'disk',
        'latitude',
        'longitude',
        'captured_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     */
    protected $hidden = [
        'file_path',
        'disk',
    ];

    /**
     * The accessors to append to the model's array form.
     */
    protected $appends = [
        'download_url',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
        'file_size' => 'integer',
        'captured_at' => 'datetime',
        'is_selected' => 'boolean',
        'selected_at' => 'datetime',
    ];

    /**
     * Get the download URL for this picture.
     */
    public function getDownloadUrlAttribute(): string
    {
        return route('api.v1.application-assessments.site-pictures.download', [
            'assessmentId' => $this->assessment_id,
            'pictureId' => $this->id,
        ]);
    }

    /**
     * Get the assessment this picture belongs to.
     */
    public function assessment(): BelongsTo
    {
        return $this->belongsTo(Assessment::class);
    }

    /**
     * Get the team member who captured this picture.
     */
    public function teamMember(): BelongsTo
    {
        return $this->belongsTo(AssessmentTeamMember::class, 'team_member_id');
    }

    /**
     * Get the user who uploaded this picture. For applicant-captured pictures
     * (service sector) this is the unit/enterprise admin; for assessor captures
     * it mirrors the team member's user.
     */
    public function uploadedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by_user_id');
    }

    /**
     * Get the team member who selected this applicant-supplied picture for the
     * assessment's official set (service sector). Null for manufacturing rows.
     */
    public function selectedBy(): BelongsTo
    {
        return $this->belongsTo(AssessmentTeamMember::class, 'selected_by_team_member_id');
    }
}
