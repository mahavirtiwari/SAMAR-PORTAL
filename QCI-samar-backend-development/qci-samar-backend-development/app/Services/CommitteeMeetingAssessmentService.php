<?php

namespace App\Services;

use App\Models\Assessment;
use App\Models\CommitteeMeeting;
use App\Models\CommitteeMeetingAssessment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Owns the lifecycle of committee_meeting_assessments pivot rows.
 *
 * Every attach/detach pairs a pivot mutation with the corresponding assessment
 * state-machine transition in one transaction. Direct pivot writes from
 * controllers are deprecated — funnel all changes through this service so the
 * pivot and assessment.status cannot drift apart.
 */
class CommitteeMeetingAssessmentService
{
    public function attach(CommitteeMeeting $meeting, Assessment $assessment, User $user): CommitteeMeetingAssessment
    {
        $existingPending = CommitteeMeetingAssessment::where('assessment_id', $assessment->id)
            ->where('decision', 'pending')
            ->whereHas('meeting', fn ($q) => $q->whereIn('status', ['scheduled', 'in_progress']))
            ->first();

        if ($existingPending && $existingPending->committee_meeting_id !== $meeting->id) {
            throw new RuntimeException(
                "Assessment {$assessment->id} is already attached to active meeting #{$existingPending->committee_meeting_id}."
            );
        }

        return DB::transaction(function () use ($meeting, $assessment, $user) {
            if ($assessment->status === Assessment::STATUS_READY_FOR_COMMITTEE) {
                $assessment->transitionTo('schedule_committee', [], $user);
            } elseif ($assessment->status !== Assessment::STATUS_COMMITTEE_REVIEW) {
                throw new RuntimeException(
                    "Assessment {$assessment->id} is in status '{$assessment->status}' and cannot be attached to a committee meeting."
                );
            }

            return CommitteeMeetingAssessment::create([
                'committee_meeting_id' => $meeting->id,
                'assessment_id' => $assessment->id,
                'decision' => 'pending',
            ]);
        });
    }

    public function detach(CommitteeMeetingAssessment $pivot, User $user): void
    {
        if ($pivot->decision !== 'pending') {
            throw new RuntimeException(
                "Cannot detach pivot #{$pivot->id}: decision '{$pivot->decision}' is final history."
            );
        }

        DB::transaction(function () use ($pivot, $user) {
            $assessment = $pivot->assessment;
            if ($assessment && $assessment->status === Assessment::STATUS_COMMITTEE_REVIEW) {
                $assessment->transitionTo('unschedule_committee', [], $user);
            }
            $pivot->delete();
        });
    }

    /**
     * Repair pivot↔assessment.status drift before a meeting starts. Assessments
     * that drifted back to ready_for_committee (e.g., assessor responded to a
     * send-back from a sibling meeting) are re-attached cleanly; incompatible
     * statuses throw with a clear message instead of producing a 400 later
     * during committee_decision.
     */
    public function ensureReadyToStart(CommitteeMeeting $meeting, User $user): void
    {
        $pendingPivots = $meeting->meetingAssessments()
            ->where('decision', 'pending')
            ->with('assessment')
            ->get();

        foreach ($pendingPivots as $pivot) {
            $assessment = $pivot->assessment;
            if (! $assessment) {
                throw new RuntimeException("Pivot #{$pivot->id} has no backing assessment.");
            }

            if ($assessment->status === Assessment::STATUS_COMMITTEE_REVIEW) {
                continue;
            }

            if ($assessment->status === Assessment::STATUS_READY_FOR_COMMITTEE) {
                $assessment->transitionTo('schedule_committee', [], $user);

                continue;
            }

            throw new RuntimeException(
                "Assessment {$assessment->id} is in status '{$assessment->status}' and cannot be reviewed by meeting #{$meeting->id}."
            );
        }
    }

    /**
     * Detach every pending pivot row for a meeting (used by cancel).
     * Decided rows are kept as history.
     */
    public function detachAllPending(CommitteeMeeting $meeting, User $user): void
    {
        $meeting->meetingAssessments()
            ->where('decision', 'pending')
            ->with('assessment')
            ->get()
            ->each(fn ($pivot) => $this->detach($pivot, $user));
    }
}
