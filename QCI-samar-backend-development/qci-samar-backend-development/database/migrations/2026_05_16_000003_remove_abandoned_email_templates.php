<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('notification_templates')
            ->whereIn('slug', [
                'clarification-requested',
                'committee-decision',
                'certificate-expiring-30',
            ])
            ->delete();
    }

    public function down(): void
    {
        DB::table('notification_templates')->insert([
            [
                'slug' => 'clarification-requested',
                'name' => 'Clarification Requested',
                'description' => 'Sent when assessor requests clarification from applicant',
                'event' => 'assessment.clarification_requested',
                'category' => 'assessment',
                'subject' => 'Clarification Required - {{application_number}}',
                'variables' => json_encode(['user_name', 'applicant_name', 'application_number']),
                'recipient_roles' => json_encode(['applicant', 'enterprise_admin']),
                'send_to_creator' => false,
                'has_attachment' => false,
                'is_active' => true,
                'priority' => 7,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'slug' => 'committee-decision',
                'name' => 'Committee Decision',
                'description' => 'Sent when committee makes a decision on application',
                'event' => 'committee.decision_made',
                'category' => 'committee',
                'subject' => 'Committee Decision - {{application_number}}',
                'variables' => json_encode(['user_name', 'application_number', 'committee_decision', 'decision_date', 'committee_remarks']),
                'recipient_roles' => json_encode(['applicant', 'enterprise_admin']),
                'send_to_creator' => false,
                'has_attachment' => false,
                'is_active' => true,
                'priority' => 9,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'slug' => 'certificate-expiring-30',
                'name' => 'Certificate Expiring in 30 Days',
                'description' => 'Sent 30 days before certificate expiry',
                'event' => 'certificate.expiring_30_days',
                'category' => 'certificate',
                'subject' => 'Certificate Expiring Soon - {{certificate_number}}',
                'variables' => json_encode(['user_name', 'certificate_number', 'certificate_expiry_date', 'organization_name']),
                'recipient_roles' => json_encode(['applicant', 'enterprise_admin']),
                'send_to_creator' => false,
                'has_attachment' => false,
                'is_active' => true,
                'priority' => 8,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }
};
