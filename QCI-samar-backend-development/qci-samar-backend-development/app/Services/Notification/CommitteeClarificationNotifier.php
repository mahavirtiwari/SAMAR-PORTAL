<?php

namespace App\Services\Notification;

use App\Mail\NotificationMail;
use App\Models\Application;
use App\Models\Assessment;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class CommitteeClarificationNotifier
{
    public function notify(Application $application, Assessment $assessment): void
    {
        $assessment->loadMissing('teamMembers.user');
        $teamMembers = $assessment->teamMembers;

        if ($teamMembers->isEmpty()) {
            Log::warning('No team members found for clarification notification', [
                'assessment_id' => $assessment->id,
            ]);

            return;
        }

        foreach ($teamMembers as $teamMember) {
            $user = $teamMember->user;
            if (! $user || ! $user->email) {
                continue;
            }

            $templateData = [
                'assessor_name' => $user->name ?? $user->first_name ?? 'Assessor',
                'application_number' => $application->application_number ?? 'N/A',
                'assessor_id' => $user->username ?? $user->email,
                'password' => 'Use your existing password',
                'login_url' => config('app.frontend_url', '').'/login',
                'query_form_link' => config('app.frontend_url', '').'/support',
            ];

            try {
                $htmlBody = view('emails.assessment.rc-clarification-sought', $templateData)->render();
                $textBody = strip_tags($htmlBody);
                $subject = 'Assessment Reverted for Clarification – SAMAR Scheme';

                Mail::to($user->email)
                    ->send(new NotificationMail($subject, $htmlBody, $textBody));

                Log::info('RC clarification email sent to assessor', [
                    'assessment_id' => $assessment->id,
                    'assessor_email' => $user->email,
                    'role' => $teamMember->role,
                ]);
            } catch (\Exception $e) {
                Log::error('Failed to send RC clarification email', [
                    'assessment_id' => $assessment->id,
                    'assessor_email' => $user->email,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
