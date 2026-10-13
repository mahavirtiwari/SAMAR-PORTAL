<?php

namespace App\Listeners;

use App\Models\Assessment;
use App\Models\User;
use App\Services\Email\EmailNotificationService;
use Illuminate\Support\Facades\Log;

/**
 * Assessment Status Changed Listener
 *
 * Listens to assessment.status.changed events and triggers appropriate email notifications.
 * Mirrors the ApplicationStatusChangedListener pattern used for application transitions.
 */
class AssessmentStatusChangedListener
{
    /**
     * Email notification service instance.
     */
    protected EmailNotificationService $emailService;

    /**
     * Create the event listener.
     */
    public function __construct(EmailNotificationService $emailService)
    {
        $this->emailService = $emailService;
    }

    /**
     * Handle the event.
     *
     * Laravel's event() helper spreads array values as individual parameters.
     *
     * @param  Assessment  $assessment
     * @param  User|null  $user
     */
    public function handle($assessment, string $event, string $transition, $user = null): void
    {
        if (! $assessment || ! $event) {
            Log::warning('AssessmentStatusChangedListener: Missing assessment or event', [
                'assessment' => $assessment,
                'event' => $event,
            ]);

            return;
        }

        Log::info('AssessmentStatusChangedListener: Processing event', [
            'assessment_id' => $assessment->id,
            'event' => $event,
            'transition' => $transition,
            'user_id' => $user?->id,
        ]);

        $emailEvent = $this->mapToEmailEvent($event, $transition);

        if (! $emailEvent) {
            Log::debug('AssessmentStatusChangedListener: No email mapping for event', [
                'event' => $event,
                'transition' => $transition,
            ]);

            return;
        }

        $emailData = $this->prepareEmailData($assessment, $user);

        try {
            $sentNotifications = $this->emailService->sendEmailForEvent($emailEvent, $emailData);

            Log::info('AssessmentStatusChangedListener: Email notifications sent', [
                'assessment_id' => $assessment->id,
                'email_event' => $emailEvent,
                'sent_count' => count($sentNotifications),
                'notification_ids' => $sentNotifications,
            ]);
        } catch (\Exception $e) {
            Log::error('AssessmentStatusChangedListener: Failed to send email notification', [
                'assessment_id' => $assessment->id,
                'email_event' => $emailEvent,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Map state machine event to email notification event.
     *
     * Mapping is keyed by transition (the verb), not the resulting state. Reason:
     * the same target state can be reached via different transitions — e.g.,
     * STATUS_READY_FOR_COMMITTEE can be entered via qc_approve (no clarification)
     * OR address_qc_feedback (assessor resubmitted after QC revert), and only the
     * latter should email Operations Manager.
     *
     * @param  string|null  $transition  The transition that triggered the event
     */
    protected function mapToEmailEvent(string $stateMachineEvent, ?string $transition = null): ?string
    {
        return match ($transition) {
            'schedule' => 'assessment.scheduled',
            'submit_for_qc' => 'assessment.submitted_for_qc',
            'qc_feedback' => 'assessment.qc_clarification_sought',
            'address_qc_feedback' => 'assessment.qc_clarification_submitted',
            default => null,
        };
    }

    /**
     * Prepare email data from assessment.
     *
     * @param  Assessment  $assessment
     * @param  User|null  $user
     */
    protected function prepareEmailData($assessment, $user = null): array
    {
        $assessment->loadMissing(['application.organization', 'application.creator', 'teamMembers.user']);

        $application = $assessment->application;
        $organization = $application?->organization;
        $leadAssessor = $assessment->getLeadAssessor();
        $coAssessors = $assessment->getCoAssessors();

        $start = $assessment->scheduled_start_date;
        $end = $assessment->scheduled_end_date;
        $dateRange = ($start && $end)
            ? $start->format('F d, Y').' - '.$end->format('F d, Y')
            : 'N/A';

        $frontendUrl = config('app.frontend_url', config('app.url'));

        return [
            'assessment' => $assessment,
            'assessment_id' => $assessment->id,
            'application' => $application,
            'application_number' => $application?->application_number ?? 'N/A',
            'samar_id' => $application?->application_number ?? 'N/A',
            'organization_name' => $organization?->name ?? 'N/A',
            'unit_name' => $application?->unit_name ?? 'N/A',
            'applicant_name' => $application?->creator?->full_name ?? 'Applicant',
            'lead_assessor_name' => $leadAssessor?->full_name ?? 'N/A',
            'lead_assessor_email' => $leadAssessor?->email ?? 'N/A',
            'lead_assessor_mobile' => $leadAssessor?->mobile_number ?? 'N/A',
            'assessor_name' => $leadAssessor?->full_name ?? 'N/A',
            'co_assessor_names' => $coAssessors->pluck('full_name')->implode(', ') ?: 'None',
            'assessment_date_range' => $dateRange,
            'assessment_mode' => $assessment->modeLabel(),
            'meeting_link' => $assessment->meeting_link,
            'qc_submission_date' => now()->format('d M Y'),
            'clarification_submission_date' => now()->format('d M Y'),
            'scheduled_start_date' => $start?->format('d M Y'),
            'scheduled_end_date' => $end?->format('d M Y'),
            'user_name' => $user?->full_name ?? 'User',
            'portal_url' => $frontendUrl,
        ];
    }
}
