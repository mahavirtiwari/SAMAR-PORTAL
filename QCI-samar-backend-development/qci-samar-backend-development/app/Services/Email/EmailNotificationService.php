<?php

namespace App\Services\Email;

use App\Exceptions\ErrorReporter;
use App\Mail\NotificationMail;
use App\Models\EmailNotificationEvent;
use App\Models\EmailNotificationTemplate;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class EmailNotificationService
{
    /**
     * Send email notification to user(s).
     *
     * @param  string|array  $recipients  User ID(s) or User object(s)
     * @param  string  $templateSlug  Email notification template slug
     * @param  array  $data  Template variables
     * @param  array  $options  Additional options (priority, etc.)
     * @return array Sent email notification IDs
     */
    public function sendEmail($recipients, string $templateSlug, array $data = [], array $options = []): array
    {
        // Normalize recipients to array of User objects
        $users = $this->normalizeRecipients($recipients);

        if (empty($users)) {
            Log::warning('No valid recipients for email notification', [
                'template' => $templateSlug,
            ]);

            return [];
        }

        // Load template
        $template = EmailNotificationTemplate::where('slug', $templateSlug)
            ->where('is_active', true)
            ->first();

        if (! $template) {
            Log::error('Email notification template not found', [
                'template' => $templateSlug,
            ]);

            return [];
        }

        $sentNotifications = [];

        foreach ($users as $user) {
            try {
                // Render template with user-specific data
                $renderedContent = $this->renderEmailTemplate($template, $data, $user);

                // Create email notification event record
                $emailEvent = EmailNotificationEvent::create([
                    'email_notification_template_id' => $template->id,
                    'event' => $templateSlug,
                    'user_id' => $user->id,
                    'recipient_email' => $user->email,
                    'recipient_name' => $user->first_name.' '.$user->last_name,
                    'subject' => $renderedContent['subject'],
                    'body' => $renderedContent['body'],
                    'status' => 'pending',
                    'data' => array_merge($data, ['template' => $templateSlug]),
                    'priority' => $options['priority'] ?? $template->priority ?? 5,
                ]);

                // Send email immediately (with optional attachments)
                $this->deliverEmail($user, $renderedContent, $emailEvent, $options['attachments'] ?? []);

                $sentNotifications[] = $emailEvent->id;

                Log::info('Email notification sent', [
                    'email_event_id' => $emailEvent->id,
                    'user_id' => $user->id,
                    'template' => $templateSlug,
                ]);
            } catch (\Exception $e) {
                Log::error('Failed to send email notification', [
                    'user_id' => $user->id,
                    'template' => $templateSlug,
                    'error' => $e->getMessage(),
                ]);

                app(ErrorReporter::class)->captureException($e, 'email', [
                    'template' => $templateSlug,
                    'user_id' => $user->id,
                ]);
            }
        }

        return $sentNotifications;
    }

    /**
     * Send a template-driven email to a list of raw email addresses, bypassing
     * the User-based recipient resolution. Use this when recipients aren't User
     * records (e.g., CommitteeMember rows that have an email but no portal
     * account). Template subject/body/bcc still come from the seeded template;
     * BCC is applied in production only, mirroring sendEmail.
     *
     * @param  array<int, string>  $emailAddresses
     * @param  array  $data  Template variables
     * @param  array  $options  'attachments' supported
     * @return array Sent email event IDs
     */
    public function sendEmailToAddresses(string $templateSlug, array $emailAddresses, array $data = [], array $options = []): array
    {
        $emailAddresses = array_values(array_unique(array_filter($emailAddresses)));
        if (empty($emailAddresses)) {
            Log::warning('No recipient addresses for direct email send', ['template' => $templateSlug]);

            return [];
        }

        $template = EmailNotificationTemplate::where('slug', $templateSlug)
            ->where('is_active', true)
            ->first();

        if (! $template) {
            Log::error('Email template not found for direct send', ['template' => $templateSlug]);

            return [];
        }

        $rendered = $this->renderTemplateForAddresses($template, $data);
        if (trim((string) ($rendered['body'] ?? '')) === '') {
            Log::warning('Empty body — direct email send skipped', ['template' => $templateSlug]);

            return [];
        }

        $bcc = [];
        if (app()->environment('production') && ! empty($rendered['bcc'])) {
            $bcc = $rendered['bcc'];
        }

        $attachments = $options['attachments'] ?? [];
        $sentIds = [];

        foreach ($emailAddresses as $address) {
            // Record the event first so a send failure can be marked `failed` on the
            // same row (the model has a `failed` scope that nothing set before this),
            // instead of being swallowed to a log line and left stuck at `pending`.
            $emailEvent = EmailNotificationEvent::create([
                'email_notification_template_id' => $template->id,
                'event' => $template->event ?? $templateSlug,
                'user_id' => null,
                'recipient_email' => $address,
                'recipient_name' => null,
                'subject' => $rendered['subject'],
                'body' => $rendered['body'],
                'status' => 'pending',
                'data' => array_merge($data, ['template' => $templateSlug]),
                'priority' => $options['priority'] ?? $template->priority ?? 5,
            ]);

            try {
                Mail::to($address)
                    ->send(new NotificationMail(
                        $rendered['subject'],
                        $rendered['body'],
                        $rendered['body_text'],
                        $attachments,
                        $bcc
                    ));

                $emailEvent->update([
                    'sent' => true,
                    'sent_at' => now(),
                    'status' => 'sent',
                ]);
                $sentIds[] = $emailEvent->id;
            } catch (\Exception $e) {
                $emailEvent->update([
                    'status' => 'failed',
                    'error_message' => $e->getMessage(),
                ]);

                Log::error('Direct email send failed', [
                    'template' => $templateSlug,
                    'recipient' => $address,
                    'error' => $e->getMessage(),
                ]);

                app(ErrorReporter::class)->captureException($e, 'email', [
                    'template' => $templateSlug,
                    'recipient' => $address,
                ]);
            }
        }

        return $sentIds;
    }

    /**
     * Render a template using only the supplied $data (no per-user merge).
     * Used by sendEmailToAddresses where recipients aren't User records.
     */
    protected function renderTemplateForAddresses(EmailNotificationTemplate $template, array $data): array
    {
        $subject = $this->replaceVariables($template->subject ?? '', $data);

        $emailBody = '';
        $emailBodyText = '';
        $possiblePaths = [
            'emails.'.$template->category.'.'.$template->slug,
            'emails.'.$template->slug,
        ];

        foreach ($possiblePaths as $bladeViewPath) {
            if (view()->exists($bladeViewPath)) {
                try {
                    $emailBody = view($bladeViewPath, $data)->render();
                    $emailBodyText = strip_tags($emailBody);
                    break;
                } catch (\Exception $e) {
                    Log::warning('Failed to render Blade for direct send', [
                        'template' => $template->slug,
                        'view_path' => $bladeViewPath,
                        'error' => $e->getMessage(),
                    ]);

                    continue;
                }
            }
        }

        return [
            'subject' => $subject,
            'body' => $emailBody,
            'body_text' => $emailBodyText,
            'bcc' => is_array($template->bcc) ? $template->bcc : [],
        ];
    }

    /**
     * Send email notification based on event.
     *
     * @param  string  $event  Event name (e.g., 'payment.success')
     * @param  array  $data  Event data
     * @param  array  $options  Forwarded to sendEmail() — supports 'attachments' and 'priority'.
     * @return array Sent email notification IDs
     */
    public function sendEmailForEvent(string $event, array $data, array $options = []): array
    {
        // Find templates for this event
        $templates = EmailNotificationTemplate::where('event', $event)
            ->where('is_active', true)
            ->get();

        if ($templates->isEmpty()) {
            Log::debug('No email templates found for event', ['event' => $event]);

            return [];
        }

        $sentNotifications = [];

        foreach ($templates as $template) {
            // Determine recipients based on event and template config
            $recipients = $this->determineRecipientsForEvent($event, $data, $template);

            if (! empty($recipients)) {
                $sent = $this->sendEmail(
                    $recipients,
                    $template->slug,
                    $data,
                    $options
                );

                $sentNotifications = array_merge($sentNotifications, $sent);
            }
        }

        return $sentNotifications;
    }

    /**
     * Record a failed EmailNotificationEvent for each resolved recipient of an event
     * WITHOUT attempting delivery. Used when a send is deliberately withheld — e.g. a
     * required attachment could not be generated — so the failure still surfaces in the
     * failed-events view for a manual/ops resend instead of vanishing into a log line.
     *
     * @return array<int> Created event IDs
     */
    public function recordEventFailure(string $event, array $data, string $reason): array
    {
        $templates = EmailNotificationTemplate::where('event', $event)
            ->where('is_active', true)
            ->get();

        $ids = [];
        foreach ($templates as $template) {
            $recipients = $this->normalizeRecipients($this->determineRecipientsForEvent($event, $data, $template));

            foreach ($recipients as $user) {
                $emailEvent = EmailNotificationEvent::create([
                    'email_notification_template_id' => $template->id,
                    'event' => $template->slug,
                    'user_id' => $user->id,
                    'recipient_email' => $user->email,
                    'recipient_name' => $user->first_name.' '.$user->last_name,
                    'subject' => $this->replaceVariables($template->subject ?? '', $data),
                    'body' => $reason,
                    'status' => 'failed',
                    'error_message' => $reason,
                    'attempts' => 0,
                    'last_attempt_at' => now(),
                    'data' => array_merge($data, ['template' => $template->slug]),
                    'priority' => $template->priority ?? 5,
                ]);
                $ids[] = $emailEvent->id;
            }
        }

        return $ids;
    }

    /**
     * Normalize recipients to User objects.
     *
     * @param  mixed  $recipients
     * @return array<User>
     */
    protected function normalizeRecipients($recipients): array
    {
        if ($recipients instanceof User) {
            return [$recipients];
        }

        if (is_array($recipients)) {
            $users = [];
            foreach ($recipients as $recipient) {
                if ($recipient instanceof User) {
                    $users[] = $recipient;
                } elseif (is_numeric($recipient)) {
                    $user = User::find($recipient);
                    if ($user) {
                        $users[] = $user;
                    }
                }
            }

            return $users;
        }

        if (is_numeric($recipients)) {
            $user = User::find($recipients);

            return $user ? [$user] : [];
        }

        return [];
    }

    /**
     * Render email template with data.
     */
    protected function renderEmailTemplate(EmailNotificationTemplate $template, array $data, User $user): array
    {
        // Add user data to template variables
        $variables = array_merge($data, [
            'user_name' => $user->full_name,
            'user_email' => $user->email,
            'user_first_name' => $user->first_name,
            'user_last_name' => $user->last_name,
            'user_samar_id' => $user->samar_id,
        ]);

        // Render email subject
        $subject = $this->replaceVariables($template->subject ?? '', $variables);

        // A body customised in Settings → Email Templates replaces the Blade view.
        if ($template->body !== null && trim($template->body) !== '') {
            try {
                $emailBody = app(EmailTemplateEditor::class)->render($template, $variables);

                return [
                    'subject' => $subject,
                    'body' => $emailBody,
                    'body_text' => strip_tags($emailBody),
                    'bcc' => is_array($template->bcc) ? $template->bcc : [],
                ];
            } catch (\Exception $e) {
                // Fall through to the Blade view rather than send nothing.
                Log::error('Failed to render customised email template; using the default', [
                    'template' => $template->slug,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Try to find and render Blade email template
        $emailBody = '';
        $emailBodyText = '';

        // Build possible Blade template paths based on category and slug
        $possiblePaths = [
            'emails.'.$template->category.'.'.$template->slug, // e.g., emails.payment.payment-received
            'emails.auth.'.$template->slug,                         // Legacy auth path
            'emails.'.$template->slug,                              // Flat structure fallback
        ];

        $bladeRendered = false;
        foreach ($possiblePaths as $bladeViewPath) {
            if (view()->exists($bladeViewPath)) {
                try {
                    $emailBody = view($bladeViewPath, $variables)->render();
                    $emailBodyText = strip_tags($emailBody);
                    $bladeRendered = true;
                    break;
                } catch (\Exception $e) {
                    Log::warning('Failed to render Blade template', [
                        'template' => $template->slug,
                        'view_path' => $bladeViewPath,
                        'error' => $e->getMessage(),
                    ]);

                    continue;
                }
            }
        }

        // If no Blade template found, log error
        if (! $bladeRendered) {
            Log::error('No Blade template found for email notification', [
                'template' => $template->slug,
                'category' => $template->category,
                'tried_paths' => $possiblePaths,
            ]);

            // Use empty body as fallback (Blade templates are required)
            $emailBody = '';
            $emailBodyText = '';
        }

        return [
            'subject' => $subject,
            'body' => $emailBody,
            'body_text' => $emailBodyText,
            'bcc' => is_array($template->bcc) ? $template->bcc : [],
        ];
    }

    /**
     * Replace template variables.
     *
     * Supports both formats:
     * - Simple: {{variable}}
     * - Blade-style: {{ $variable }}
     */
    protected function replaceVariables(string $template, array $variables): string
    {
        foreach ($variables as $key => $value) {
            // Handle nested arrays (e.g., application.number)
            if (is_array($value)) {
                foreach ($value as $nestedKey => $nestedValue) {
                    if (! is_array($nestedValue)) {
                        // Escape HTML entities for security (XSS prevention)
                        $escapedValue = htmlspecialchars((string) $nestedValue, ENT_QUOTES, 'UTF-8');
                        $nestedPattern = $key.'.'.$nestedKey;
                        // Replace all formats: {{key.nested}}, {{ key.nested }}, {{ $key.nested }}
                        $template = $this->replaceVariableFormats($template, $nestedPattern, $escapedValue);
                    }
                }
            } else {
                // Escape HTML entities for security (XSS prevention)
                $escapedValue = htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
                // Replace all formats: {{key}}, {{ key }}, {{ $key }}
                $template = $this->replaceVariableFormats($template, $key, $escapedValue);
            }
        }

        return $template;
    }

    /**
     * Replace variable in all supported formats.
     *
     * @param  string  $key  Variable name
     * @param  string  $value  Replacement value
     */
    protected function replaceVariableFormats(string $template, string $key, string $value): string
    {
        // Patterns to match:
        // 1. {{key}} - simple format
        // 2. {{ key }} - with spaces
        // 3. {{ $key }} - Blade-style with $ prefix
        // 4. {{$key}} - $ prefix without spaces
        $patterns = [
            '{{'.$key.'}}',           // {{application_number}}
            '{{ '.$key.' }}',         // {{ application_number }}
            '{{ $'.$key.' }}',        // {{ $application_number }}
            '{{$'.$key.'}}',          // {{$application_number}}
            '{{ $'.$key.'}}',         // {{ $application_number}} (no trailing space)
            '{{$'.$key.' }}',         // {{$application_number }} (no leading space)
        ];

        foreach ($patterns as $pattern) {
            $template = str_replace($pattern, $value, $template);
        }

        return $template;
    }

    /**
     * Deliver email notification.
     *
     * @param  array  $attachments  Array of \Illuminate\Mail\Mailables\Attachment objects
     */
    protected function deliverEmail(User $user, array $content, EmailNotificationEvent $emailEvent, array $attachments = []): void
    {
        try {
            $subject = $content['subject'] ?? 'QCI SAMAR Notification';
            $htmlBody = $content['body'];
            $textBody = $content['body_text'] ?? strip_tags($htmlBody);

            if (trim((string) $htmlBody) === '') {
                $emailEvent->update([
                    'status' => 'skipped',
                    'error_message' => 'No Blade template rendered; empty body suppressed.',
                ]);
                Log::warning('Email skipped: empty body (no template found)', [
                    'email_event_id' => $emailEvent->id,
                    'to' => $user->email,
                    'subject' => $subject,
                ]);

                return;
            }

            // BCC is honored in production only. Staging/local stay BCC-free to
            // avoid spamming the live admin inbox during testing.
            $bcc = [];
            if (app()->environment('production') && ! empty($content['bcc'])) {
                $bcc = $content['bcc'];
            }

            // Send email using our NotificationMail Mailable
            Mail::to($user->email)
                ->send(new NotificationMail($subject, $htmlBody, $textBody, $attachments, $bcc));

            // Update email event record
            $emailEvent->update([
                'sent' => true,
                'sent_at' => now(),
                'status' => 'sent',
            ]);

            Log::info('Email notification sent successfully', [
                'email_event_id' => $emailEvent->id,
                'to' => $user->email,
                'subject' => $subject,
            ]);
        } catch (\Exception $e) {
            // Update email event record with error
            $emailEvent->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'attempts' => $emailEvent->attempts + 1,
                'last_attempt_at' => now(),
            ]);

            Log::error('Failed to send email notification', [
                'email_event_id' => $emailEvent->id,
                'to' => $user->email,
                'subject' => $content['subject'] ?? 'Unknown',
                'error' => $e->getMessage(),
            ]);
            throw $e; // Re-throw to handle in calling code
        }
    }

    /**
     * Determine recipients for event.
     *
     * @return array<User>
     */
    protected function determineRecipientsForEvent(string $event, array $data, EmailNotificationTemplate $template): array
    {
        $recipients = [];

        // Parse recipient rules from template
        $recipientRoles = $template->recipient_roles ?? [];

        // Event-specific logic
        if (str_starts_with($event, 'application.')
            || str_starts_with($event, 'payment.')
            || str_starts_with($event, 'certificate.')) {
            $application = $data['application'] ?? null;
            if ($application) {
                // Add organization admins
                if (in_array('enterprise_admin', $recipientRoles)) {
                    $orgAdmins = User::whereHas('activeRoles', function ($q) {
                        $q->where('slug', 'enterprise_admin');
                    })->where('organization_id', $application->organization_id)->get();
                    $recipients = array_merge($recipients, $orgAdmins->all());
                }

                // Add unit admins assigned to this application's unit
                if (in_array('unit_admin', $recipientRoles) && $application->unit_id) {
                    $unitAdmins = User::whereHas('activeRoles', function ($q) use ($application) {
                        $q->where('slug', 'unit_admin')
                            ->where('user_role.unit_id', $application->unit_id);
                    })->where('organization_id', $application->organization_id)->get();
                    $recipients = array_merge($recipients, $unitAdmins->all());
                }
            }
        }

        if (str_starts_with($event, 'assessment.')) {
            // Handle assessment events
            $assessment = $data['assessment'] ?? null;
            $application = $data['application'] ?? null;

            if ($application && in_array('enterprise_admin', $recipientRoles)) {
                $orgAdmins = User::whereHas('activeRoles', function ($q) {
                    $q->where('slug', 'enterprise_admin');
                })->where('organization_id', $application->organization_id)->get();
                $recipients = array_merge($recipients, $orgAdmins->all());
            }

            // Add unit admins assigned to this application's unit
            if ($application && in_array('unit_admin', $recipientRoles) && $application->unit_id) {
                $unitAdmins = User::whereHas('activeRoles', function ($q) use ($application) {
                    $q->where('slug', 'unit_admin')
                        ->where('user_role.unit_id', $application->unit_id);
                })->where('organization_id', $application->organization_id)->get();
                $recipients = array_merge($recipients, $unitAdmins->all());
            }

            // For assessor assignment - send to specific assessor
            if (in_array('assessor', $recipientRoles)) {
                // Check if specific assessor is provided in data
                $assessor = $data['assessor'] ?? null;
                if ($assessor) {
                    $recipients[] = $assessor;
                } elseif ($assessment) {
                    // Fallback to lead assessor from assessment
                    $leadAssessor = $assessment->getLeadAssessor();
                    if ($leadAssessor) {
                        $recipients[] = $leadAssessor->id;
                    }
                }
            }
        }

        // Add operations managers for important events
        if (in_array('operations_manager', $recipientRoles)) {
            $opsManagers = User::whereHas('activeRoles', function ($q) {
                $q->where('slug', 'operations_manager');
            })->get();
            $recipients = array_merge($recipients, $opsManagers->all());
        }

        // Add operations admins
        if (in_array('operations_admin', $recipientRoles)) {
            $opsAdmins = User::whereHas('activeRoles', function ($q) {
                $q->where('slug', 'operations_admin');
            })->get();
            $recipients = array_merge($recipients, $opsAdmins->all());
        }

        // Normalize and deduplicate recipients to prevent duplicate emails
        $normalizedRecipients = $this->normalizeRecipients($recipients);

        // Remove duplicates by user ID
        $uniqueRecipients = collect($normalizedRecipients)->unique('id')->values()->all();

        return $uniqueRecipients;
    }
}
