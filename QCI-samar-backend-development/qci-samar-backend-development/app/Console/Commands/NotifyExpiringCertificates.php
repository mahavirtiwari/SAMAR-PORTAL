<?php

namespace App\Console\Commands;

use App\Models\Certificate;
use App\Models\SystemSetting;
use App\Services\Email\EmailNotificationService;
use Illuminate\Console\Command;

class NotifyExpiringCertificates extends Command
{
    /**
     * @var string
     */
    protected $signature = 'certificates:notify-expiring {--days= : Override the recertification window in days}';

    /**
     * @var string
     */
    protected $description = 'Send staged renewal reminders for certificates nearing or past expiry';

    public function handle(EmailNotificationService $emailService): int
    {
        $window = (int) ($this->option('days') ?: SystemSetting::getRecertificationWindowDays());

        // Stage thresholds as days-before-expiry, most urgent first. Only stages
        // that fall inside the renewal window are eligible (renewal can't be acted
        // on before the window opens), and duplicate thresholds are collapsed.
        $stages = collect([
            ['key' => 'expired', 'days' => 0],
            ['key' => '7_days', 'days' => 7],
            ['key' => '30_days', 'days' => 30],
            ['key' => 'window_open', 'days' => $window],
        ])->filter(fn ($stage) => $stage['days'] <= $window)
            ->unique('days')
            ->sortBy('days')
            ->values();

        $now = now();

        // Active certs expiring within the window plus those already expired.
        // 'renewed'/'revoked'/'suspended' certs are intentionally excluded.
        $certificates = Certificate::with('application')
            ->whereIn('status', ['active', 'expired'])
            ->where('valid_until', '<', $now->copy()->addDays($window + 1)->startOfDay())
            // A certificate that already got the final (expired) reminder has
            // nothing left to send; skip it instead of reloading every expired
            // certificate ever issued on each daily run.
            ->where(fn ($q) => $q->whereNull('renewal_reminders_sent')->orWhereJsonDoesntContain('renewal_reminders_sent', 'expired'))
            ->lazyById(200);

        $sentCount = 0;

        foreach ($certificates as $certificate) {
            if (! $certificate->application) {
                continue;
            }

            $expiry = $certificate->valid_until;

            // Most urgent stage whose threshold has already been reached.
            $dueStage = $stages->first(fn ($stage) => $now->greaterThanOrEqualTo($expiry->copy()->subDays($stage['days'])));

            if (! $dueStage) {
                continue;
            }

            $alreadySent = $certificate->renewal_reminders_sent ?? [];
            if (in_array($dueStage['key'], $alreadySent, true)) {
                continue;
            }

            // The window-open stage is a distinct "you may start renewal" email;
            // the closer thresholds (30/7/expired) are the staged reminder.
            $payload = [
                'application' => $certificate->application,
                'certificate' => $certificate,
                'organization_name' => $certificate->application->organization_name ?? $certificate->application->enterprise_name,
                'application_number' => $certificate->application->application_number,
                'certificate_number' => $certificate->certificate_number,
                'expiry_date' => $expiry->format('d-M-Y'),
                'login_url' => config('app.frontend_url'),
            ];

            if ($dueStage['key'] === 'window_open') {
                $emailService->sendEmailForEvent('certificate.recertification-window-open', $payload);
            } else {
                $payload['days_remaining'] = (int) round($now->diffInDays($expiry, false));
                $payload['reminder_stage'] = $dueStage['key'];
                $emailService->sendEmailForEvent('certificate.expiring', $payload);
            }

            $alreadySent[] = $dueStage['key'];
            $certificate->renewal_reminders_sent = $alreadySent;
            $certificate->save();
            $sentCount++;
        }

        $this->info("Renewal reminders sent: {$sentCount}");

        return Command::SUCCESS;
    }
}
