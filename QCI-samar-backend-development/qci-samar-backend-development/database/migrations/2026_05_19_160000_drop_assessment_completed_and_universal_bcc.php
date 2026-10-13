<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Templates that previously had no bcc. Force-setting bcc on every active
     * template (per business: every operational email BCCs samar.admin in prod;
     * the runtime gate in EmailNotificationService::deliverEmail keeps it
     * production-only).
     */
    private array $slugsNeedingBcc = [
        'payment-received',
        'assessment-scheduled',
        'qc-feedback-required',
        'password-reset',
        'otp-verification',
        'user-created',
        'user-invitation',
        'registration-successful',
        'login-otp-verification',
        'application-rejected',
        'drdo-approved',
        'application-received',
        'assessor-assigned',
        'co-assessor-assigned',
        'meeting-updated',
        'password-reset-confirmation',
    ];

    public function up(): void
    {
        // Remove assessment-completed — the assessment.feedback_request email
        // (sent after committee certifies) already covers the "your assessment
        // is done" notification to enterprise + unit admin.
        DB::table('notification_templates')
            ->where('slug', 'assessment-completed')
            ->delete();

        DB::table('notification_templates')
            ->whereIn('slug', $this->slugsNeedingBcc)
            ->update([
                'bcc' => json_encode(['samar.admin@qcin.org']),
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        DB::table('notification_templates')
            ->whereIn('slug', $this->slugsNeedingBcc)
            ->update([
                'bcc' => null,
                'updated_at' => now(),
            ]);

        $now = now();
        DB::table('notification_templates')->insert([
            'slug' => 'assessment-completed',
            'name' => 'Assessment Completed',
            'description' => 'Sent to applicant when onsite assessment is submitted and moves to the QC pipeline',
            'event' => 'assessment.submitted_for_qc',
            'category' => 'assessment',
            'subject' => 'Assessment Completed - {{application_number}}',
            'bcc' => json_encode(['samar.admin@qcin.org']),
            'variables' => json_encode(['user_name', 'application_number', 'assessment_date', 'assessor_name']),
            'recipient_roles' => json_encode(['enterprise_admin', 'unit_admin']),
            'is_active' => true,
            'priority' => 6,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }
};
