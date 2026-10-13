<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('notification_templates')
            ->where('slug', 'application-received')
            ->update([
                'name' => 'Application Submission Acknowledged',
                'description' => 'Sent when an applicant submits basic information and documents; prompts payment to continue certification.',
                'subject' => 'Submission of Basic information and Documents under SAMAR Scheme of DRDO – {{user_samar_id}}',
                'bcc' => json_encode(['samar.admin@qcin.org']),
                'variables' => json_encode(['user_name', 'applicant_name', 'application_number', 'organization_name', 'user_samar_id', 'portal_url']),
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        DB::table('notification_templates')
            ->where('slug', 'application-received')
            ->update([
                'name' => 'Application Received',
                'description' => 'Sent when an application is received for review',
                'subject' => 'Application Received - {{application_number}}',
                'bcc' => null,
                'variables' => json_encode(['user_name', 'applicant_name', 'application_number', 'organization_name']),
                'updated_at' => now(),
            ]);
    }
};
