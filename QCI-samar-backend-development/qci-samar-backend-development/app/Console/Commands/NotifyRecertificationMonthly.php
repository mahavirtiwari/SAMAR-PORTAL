<?php

namespace App\Console\Commands;

use App\Models\Certificate;
use App\Models\SystemSetting;
use App\Services\Email\EmailNotificationService;
use Illuminate\Console\Command;

class NotifyRecertificationMonthly extends Command
{
    /**
     * @var string
     */
    protected $signature = 'certificates:notify-recert-monthly {--days= : Override the recertification window in days}';

    /**
     * @var string
     */
    protected $description = 'Send one recertification reminder per calendar month for each open window, until a renewal is started';

    public function handle(EmailNotificationService $emailService): int
    {
        $window = (int) ($this->option('days') ?: SystemSetting::getRecertificationWindowDays());

        $now = now();

        // One reminder per calendar month. The month stamp is the idempotency key,
        // so the daily scheduler run emits at most one email per certificate per
        // month and picks up a window that opened mid-month on its first run.
        $monthKey = 'recert_monthly_'.$now->format('Y-m');

        // Certificates whose recertification window has opened — within `window`
        // days of expiry, or already past it. 'renewed'/'revoked'/'suspended'
        // certificates are intentionally excluded; they are no longer awaiting a
        // renewal.
        $certificates = Certificate::with('application')
            ->whereIn('status', ['active', 'expired'])
            ->where('valid_until', '<', $now->copy()->addDays($window + 1)->startOfDay())
            // Streamed in batches rather than loaded all at once: this set grows
            // with every certificate that expires without a renewal.
            ->lazyById(200);

        $sentCount = 0;

        foreach ($certificates as $certificate) {
            if (! $certificate->application) {
                continue;
            }

            // Stop once the applicant has started or submitted a renewal: a live
            // (non-rejected) renewal draft off this application closes the cycle.
            $renewalStarted = $certificate->application
                ->renewalApplications()
                ->where('status', '!=', 'rejected')
                ->exists();
            if ($renewalStarted) {
                continue;
            }

            $alreadySent = $certificate->renewal_reminders_sent ?? [];
            if (in_array($monthKey, $alreadySent, true)) {
                continue;
            }

            $payload = [
                'application' => $certificate->application,
                'certificate' => $certificate,
                'organization_name' => $certificate->application->organization_name ?? $certificate->application->enterprise_name,
                'application_number' => $certificate->application->application_number,
                'certificate_number' => $certificate->certificate_number,
                'expiry_date' => $certificate->valid_until->format('d-M-Y'),
                'login_url' => config('app.frontend_url'),
            ];

            $emailService->sendEmailForEvent('certificate.recert-monthly-reminder', $payload);

            $alreadySent[] = $monthKey;
            $certificate->renewal_reminders_sent = $alreadySent;
            $certificate->save();
            $sentCount++;
        }

        $this->info("Monthly recertification reminders sent: {$sentCount}");

        return Command::SUCCESS;
    }
}
