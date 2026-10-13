<?php

namespace App\Services\Notification;

use App\Services\Email\EmailNotificationService;
use Illuminate\Support\Facades\Log;

class NotificationService
{
    public function __construct(
        private EmailNotificationService $emailService
    ) {}

    /**
     * Send notification to user(s) using one or more channels.
     *
     * @param  mixed  $recipients  User object(s) or ID(s)
     * @param  string  $templateSlug  Notification template slug or event
     * @param  array  $data  Template variables
     * @param  array  $options  Options, e.g. ['channels' => ['email','sms']]
     * @return array Sent notification IDs (aggregated from channels)
     */
    public function send($recipients, string $templateSlug, array $data = [], array $options = []): array
    {
        $channels = $options['channels'] ?? ['email'];
        $sent = [];

        if (in_array('email', $channels, true)) {
            try {
                $sent = array_merge($sent, $this->emailService->sendEmail($recipients, $templateSlug, $data, $options));
            } catch (\Exception $e) {
                Log::error('NotificationService: failed to send email', ['error' => $e->getMessage(), 'template' => $templateSlug]);
            }
        }

        // Future channels (sms, push, in_app) can be added here.

        return $sent;
    }

    /**
     * Send notifications for an event (multiple templates).
     */
    public function sendForEvent(string $event, array $data = [], array $options = []): array
    {
        // Delegate to email service for event-based email templates
        try {
            return $this->emailService->sendEmailForEvent($event, $data);
        } catch (\Exception $e) {
            Log::error('NotificationService: failed to send event notifications', ['error' => $e->getMessage(), 'event' => $event]);

            return [];
        }
    }
}
