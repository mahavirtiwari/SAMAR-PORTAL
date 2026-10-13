<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Remove duplicates of DRDO Approval and the confused applicant-clarification orphan.
        DB::table('notification_templates')
            ->whereIn('slug', ['application-approved', 'clarification-submitted'])
            ->delete();

        // QC Feedback Required is an internal Operations Manager email; fired on
        // submit_for_qc (state machine emits assessment.submitted_for_qc).
        DB::table('notification_templates')
            ->where('slug', 'qc-feedback-required')
            ->update([
                'event' => 'assessment.submitted_for_qc',
                'recipient_roles' => json_encode(['operations_manager']),
                'description' => 'Sent to operations manager when an assessor submits an assessment for QC review',
                'updated_at' => now(),
            ]);

        // Assessment Completed (applicant-facing) fires on the same transition;
        // both templates dispatch from a single sendEmailForEvent call.
        DB::table('notification_templates')
            ->where('slug', 'assessment-completed')
            ->update([
                'event' => 'assessment.submitted_for_qc',
                'bcc' => json_encode(['samar.admin@qcin.org']),
                'description' => 'Sent to applicant when onsite assessment is submitted and moves to the QC pipeline',
                'updated_at' => now(),
            ]);

        // QC clarification pair — mirrors the existing RC pair so both review
        // gates have parallel revert + resubmitted notifications.
        $now = now();
        DB::table('notification_templates')->insert([
            [
                'slug' => 'qc-clarification-sought',
                'name' => 'Clarification Sought by QC',
                'description' => 'Sent to assessor when QC reverts the assessment for clarification',
                'event' => 'assessment.qc_clarification_sought',
                'category' => 'assessment',
                'subject' => 'Assessment Reverted for Clarification – SAMAR Scheme – {{samar_id}}',
                'bcc' => json_encode(['samar.admin@qcin.org']),
                'variables' => json_encode(['user_name', 'assessor_name', 'application_number', 'samar_id', 'login_url', 'query_form_link']),
                'recipient_roles' => json_encode(['assessor']),
                'is_active' => true,
                'priority' => 8,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'slug' => 'qc-clarification-submitted',
                'name' => 'Clarification Submitted by Assessor (QC)',
                'description' => 'Sent to operations manager when assessor resubmits after QC reverted the assessment',
                'event' => 'assessment.qc_clarification_submitted',
                'category' => 'assessment',
                'subject' => 'Submission of Clarification by Assessor – SAMAR Scheme – {{samar_id}}',
                'bcc' => json_encode(['samar.admin@qcin.org']),
                'variables' => json_encode(['user_name', 'application_number', 'organization_name', 'assessor_name', 'clarification_submission_date', 'samar_id']),
                'recipient_roles' => json_encode(['operations_manager']),
                'is_active' => true,
                'priority' => 7,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    public function down(): void
    {
        DB::table('notification_templates')
            ->whereIn('slug', ['qc-clarification-sought', 'qc-clarification-submitted'])
            ->delete();

        DB::table('notification_templates')
            ->where('slug', 'assessment-completed')
            ->update([
                'event' => 'assessment.completed',
                'bcc' => null,
                'description' => 'Sent when assessment is completed',
                'updated_at' => now(),
            ]);

        DB::table('notification_templates')
            ->where('slug', 'qc-feedback-required')
            ->update([
                'event' => 'assessment.qc_required',
                'recipient_roles' => json_encode(['operations_manager', 'operations_admin']),
                'description' => 'Sent when QC review is needed for an assessment',
                'updated_at' => now(),
            ]);

        $now = now();
        DB::table('notification_templates')->insert([
            [
                'slug' => 'application-approved',
                'name' => 'Application Approved',
                'description' => 'Sent when application is approved',
                'event' => 'application.approved',
                'category' => 'application',
                'subject' => 'Application Approved - {{application_number}}',
                'variables' => json_encode(['user_name', 'application_number', 'organization_name']),
                'recipient_roles' => json_encode(['enterprise_admin', 'unit_admin']),
                'is_active' => true,
                'priority' => 9,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'slug' => 'clarification-submitted',
                'name' => 'Clarification Submitted',
                'description' => 'Sent when applicant submits clarification response',
                'event' => 'application.clarification_submitted',
                'category' => 'application',
                'subject' => 'Clarification Response Submitted - {{application_number}}',
                'variables' => json_encode(['user_name', 'applicant_name', 'application_number']),
                'recipient_roles' => json_encode(['assessor', 'operations_manager']),
                'is_active' => true,
                'priority' => 6,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }
};
