<?php

namespace App\Listeners;

use App\Models\Application;
use App\Models\User;
use App\Services\Email\EmailNotificationService;
use Illuminate\Contracts\Queue\ShouldQueueAfterCommit;
use Illuminate\Support\Facades\Log;

/**
 * Application Status Changed Listener
 *
 * Listens to application.status.changed events and triggers appropriate email notifications.
 */
class ApplicationStatusChangedListener implements ShouldQueueAfterCommit
{
    /**
     * Runs on the queue worker after the transition commits: one status change
     * emails every Operations Manager/Admin, which is too slow (one SMTP
     * round-trip each) to do inside the request and its database locks.
     */
    public int $tries = 3;

    /** @var array<int, int> */
    public array $backoff = [60, 300];

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
     * @param  Application  $application
     * @param  User|null  $user
     */
    public function handle($application, string $event, string $transition, $user = null): void
    {
        if (! $application || ! $event) {
            Log::warning('ApplicationStatusChangedListener: Missing application or event', [
                'application' => $application,
                'event' => $event,
            ]);

            return;
        }

        Log::info('ApplicationStatusChangedListener: Processing event', [
            'application_id' => $application->id,
            'application_number' => $application->application_number,
            'event' => $event,
            'transition' => $transition,
            'user_id' => $user?->id,
        ]);

        // Map state machine events to email notification events
        $emailEvent = $this->mapToEmailEvent($event, $transition);

        if (! $emailEvent) {
            Log::debug('ApplicationStatusChangedListener: No email mapping for event', [
                'event' => $event,
            ]);

            return;
        }

        // Prepare email data from application
        $emailData = $this->prepareEmailData($application, $user);

        try {
            // Send email notification
            $sentNotifications = $this->emailService->sendEmailForEvent($emailEvent, $emailData);

            Log::info('ApplicationStatusChangedListener: Email notifications sent', [
                'application_id' => $application->id,
                'email_event' => $emailEvent,
                'sent_count' => count($sentNotifications),
                'notification_ids' => $sentNotifications,
            ]);
        } catch (\Exception $e) {
            Log::error('ApplicationStatusChangedListener: Failed to send email notification', [
                'application_id' => $application->id,
                'email_event' => $emailEvent,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Map state machine event to email notification event.
     *
     * Mapping is driven by the transition (the verb), not the resulting state.
     * Reason: the same target state can be reached via different transitions
     * (e.g. payment_pending ← submit_direct or ← drdo_approve), and the
     * user-visible email differs. Mapping by state also caused the
     * payment_failed self-loop on payment_pending to re-fire the submission
     * email — the bug behind the 2026-05-16 template removal.
     *
     * @param  string|null  $transition  The transition that triggered the event
     */
    protected function mapToEmailEvent(string $stateMachineEvent, ?string $transition = null): ?string
    {
        return match ($transition) {
            'submit', 'submit_direct' => 'application.received',
            'drdo_approve' => 'application.drdo_approved',
            'drdo_reject' => 'application.drdo_rejected',
            default => null,
        };
    }

    /**
     * Prepare email data from application.
     *
     * @param  Application  $application
     * @param  User|null  $user
     */
    protected function prepareEmailData($application, $user = null): array
    {
        // Load necessary relationships if not already loaded
        $application->loadMissing(['organization', 'creator']);

        // Generate frontend payment URL
        $frontendUrl = config('app.frontend_url', config('app.url'));
        $paymentUrl = $frontendUrl.'/applications/'.$application->id.'/payment';

        return [
            'application' => $application,
            'application_number' => $application->application_number,
            'organization_name' => $application->organization->name ?? 'N/A',
            'submitted_date' => $application->submitted_at
                ? $application->submitted_at->format('d M Y')
                : now()->format('d M Y'),
            'applicant_name' => $application->creator->full_name ?? 'Applicant',
            'rejection_remarks' => $application->rejection_reason ?? 'No remarks provided',
            'application_status' => $application->status,
            'user_name' => $user?->full_name ?? $application->creator?->full_name ?? 'User',
            'payment_url' => $paymentUrl,
            'portal_url' => $frontendUrl,
        ];
    }
}
