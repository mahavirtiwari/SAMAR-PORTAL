<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MeetingMember extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'meeting_members';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'committee_meeting_id',
        'committee_member_id',
        'role',
        'added_by',
        'attended',
        'attendance_notes',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'attended' => 'boolean',
    ];

    /**
     * Get the meeting this member belongs to.
     */
    public function meeting(): BelongsTo
    {
        return $this->belongsTo(CommitteeMeeting::class, 'committee_meeting_id');
    }

    /**
     * Get the committee member.
     */
    public function committeeMember(): BelongsTo
    {
        return $this->belongsTo(CommitteeMember::class, 'committee_member_id');
    }

    /**
     * Scope: Get by role.
     */
    public function scopeByRole(Builder $query, string $role): Builder
    {
        return $query->where('role', $role);
    }

    /**
     * Check if this member is the chair.
     */
    public function isChair(): bool
    {
        return $this->role === 'chair';
    }

    /**
     * Check if this member is the convenor.
     */
    public function isConvenor(): bool
    {
        return $this->role === 'convenor';
    }
}
