<?php

namespace App\Models;

use App\Traits\HasAuditLog;
use App\Traits\TracksUserActions;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class CommitteeMeeting extends Model
{
    use HasAuditLog, HasFactory, SoftDeletes, TracksUserActions;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'meeting_number',
        'title',
        'scheduled_at',
        'started_at',
        'ended_at',
        'meeting_type',
        'venue',
        'meeting_link',
        'chair_id',
        'convenor_id',
        'remarks',
        'status',
        'minutes',
        'cancellation_reason',
        'cancelled_at',
        'cancelled_by',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'scheduled_at' => 'datetime',
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    /**
     * Get the chair (CommitteeMember).
     */
    public function chair(): BelongsTo
    {
        return $this->belongsTo(CommitteeMember::class, 'chair_id');
    }

    /**
     * Get the convenor (CommitteeMember).
     */
    public function convenor(): BelongsTo
    {
        return $this->belongsTo(CommitteeMember::class, 'convenor_id');
    }

    /**
     * Get the members of this meeting.
     */
    public function members(): HasMany
    {
        return $this->hasMany(MeetingMember::class);
    }

    /**
     * Get the meeting assessments (pivot records).
     */
    public function meetingAssessments(): HasMany
    {
        return $this->hasMany(CommitteeMeetingAssessment::class);
    }

    /**
     * Get the assessments for this meeting (through pivot).
     */
    public function assessments()
    {
        return $this->belongsToMany(Assessment::class, 'committee_meeting_assessments')
            ->withPivot(['decision', 'remarks', 'decided_by', 'decided_at'])
            ->withTimestamps();
    }

    /**
     * Get the total member count.
     */
    public function getMemberCount(): int
    {
        return $this->members()->count();
    }

    /**
     * Get the chair of this meeting.
     */
    public function getChair(): ?MeetingMember
    {
        return $this->members()->where('role', 'chair')->first();
    }

    /**
     * Get the convenor of this meeting.
     */
    public function getConvenor(): ?MeetingMember
    {
        return $this->members()->where('role', 'convenor')->first();
    }

    /**
     * Scope: Upcoming meetings.
     */
    public function scopeUpcoming(Builder $query): Builder
    {
        return $query->where('scheduled_at', '>', now())
            ->where('status', 'scheduled');
    }

    /**
     * Scope: Completed meetings.
     */
    public function scopeCompleted(Builder $query): Builder
    {
        return $query->where('status', 'completed');
    }

    /**
     * Scope: By status.
     */
    public function scopeByStatus(Builder $query, string $status): Builder
    {
        return $query->where('status', $status);
    }

    /**
     * Scope: Search by meeting title or meeting number.
     */
    public function scopeSearch(Builder $query, ?string $search): Builder
    {
        $search = trim((string) $search);
        if ($search === '') {
            return $query;
        }

        return $query->where(function (Builder $q) use ($search) {
            $q->where('title', 'like', "%{$search}%")
                ->orWhere('meeting_number', 'like', "%{$search}%");
        });
    }

    /**
     * Scope: Today's meetings.
     */
    public function scopeToday(Builder $query): Builder
    {
        return $query->whereDate('scheduled_at', today());
    }
}
