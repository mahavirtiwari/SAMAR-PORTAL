<?php

namespace App\Services;

use App\Models\Assessment;
use App\Models\AssessorOffTime;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;

/**
 * Whether assessors are free for a date range: not on off-time (leave) and not
 * already booked on another live assessment. One place for the overlap rules
 * so the scheduling dropdown and the schedule request agree. Overlaps are
 * inclusive: sharing a boundary day counts as a clash.
 */
class AssessorAvailabilityService
{
    /**
     * Live assessments (scheduled / in progress) whose planned window overlaps
     * the range and that include any of the given assessors.
     *
     * @param  array<int, int>  $userIds
     * @return Collection<int, Assessment>
     */
    public function bookings(array $userIds, string $start, string $end, ?int $excludeAssessmentId = null): Collection
    {
        return Assessment::query()
            ->when($excludeAssessmentId, fn ($q) => $q->where('id', '!=', $excludeAssessmentId))
            ->whereIn('status', [Assessment::STATUS_SCHEDULED, Assessment::STATUS_IN_PROGRESS])
            ->whereNotNull('scheduled_start_date')
            ->whereNotNull('scheduled_end_date')
            ->whereDate('scheduled_start_date', '<=', $end)
            ->whereDate('scheduled_end_date', '>=', $start)
            ->whereHas('teamMembers', fn ($q) => $q->whereIn('user_id', $userIds))
            ->with([
                'application:id,application_number',
                'teamMembers' => fn ($q) => $q->whereIn('user_id', $userIds),
            ])
            ->get();
    }

    /**
     * Off-time entries of the given assessors that overlap the range.
     *
     * @param  array<int, int>  $userIds
     * @return Collection<int, AssessorOffTime>
     */
    public function offTimes(array $userIds, string $start, string $end): Collection
    {
        return AssessorOffTime::query()
            ->whereIn('user_id', $userIds)
            ->whereDate('from_date', '<=', $end)
            ->whereDate('to_date', '>=', $start)
            ->orderBy('from_date')
            ->get();
    }

    /**
     * Availability of each assessor for the range, with a readable reason when
     * they are not free.
     *
     * @param  array<int, int>  $userIds
     * @return array<int, array{user_id: int, is_available: bool, unavailable_reason: string|null, conflicts: array<int, array<string, mixed>>}>
     */
    public function forRange(array $userIds, string $start, string $end, ?int $excludeAssessmentId = null): array
    {
        $result = [];
        foreach ($userIds as $id) {
            $result[$id] = ['user_id' => $id, 'is_available' => true, 'unavailable_reason' => null, 'conflicts' => []];
        }

        foreach ($this->offTimes($userIds, $start, $end) as $offTime) {
            $result[$offTime->user_id]['conflicts'][] = [
                'type' => 'off_time',
                'from_date' => $offTime->from_date->toDateString(),
                'to_date' => $offTime->to_date->toDateString(),
                'reason' => 'On leave '.$this->range($offTime->from_date, $offTime->to_date),
            ];
        }

        foreach ($this->bookings($userIds, $start, $end, $excludeAssessmentId) as $booking) {
            $reference = $booking->application->application_number ?? "Assessment #{$booking->id}";
            foreach ($booking->teamMembers as $member) {
                $memberRole = (string) $member->getAttribute('role');
                $memberId = (int) $member->getAttribute('user_id');
                $role = $memberRole === 'lead_assessor' ? 'Lead' : 'Co-assessor';
                $result[$memberId]['conflicts'][] = [
                    'type' => 'assigned',
                    'assessment_id' => $booking->id,
                    'application_number' => $booking->application->application_number ?? null,
                    'role' => $memberRole,
                    'from_date' => $booking->scheduled_start_date->toDateString(),
                    'to_date' => $booking->scheduled_end_date->toDateString(),
                    'reason' => "Assigned to {$reference} ({$role}) on ".$this->range($booking->scheduled_start_date, $booking->scheduled_end_date),
                ];
            }
        }

        foreach ($result as $id => $row) {
            if ($row['conflicts'] !== []) {
                $result[$id]['is_available'] = false;
                $result[$id]['unavailable_reason'] = implode('; ', array_column($row['conflicts'], 'reason'));
            }
        }

        return array_values($result);
    }

    private function range(CarbonInterface $from, CarbonInterface $to): string
    {
        return $from->isSameDay($to)
            ? $from->format('d M Y')
            : $from->format('d M').' – '.$to->format('d M Y');
    }
}
