<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('notification_templates')
            ->where('slug', 'application-submitted')
            ->delete();
    }

    public function down(): void
    {
        DB::table('notification_templates')->insert([
            'slug' => 'application-submitted',
            'name' => 'Application Submitted',
            'description' => 'Sent when an application is successfully submitted',
            'event' => 'application.submitted',
            'category' => 'application',
            'subject' => 'Submission of Basic information and Documents under SAMAR Scheme of DRDO - {{application_number}}',
            'variables' => json_encode(['user_name', 'applicant_name', 'application_number', 'application_status', 'organization_name', 'submitted_date', 'portal_url']),
            'recipient_roles' => json_encode(['applicant', 'enterprise_admin']),
            'send_to_creator' => false,
            'has_attachment' => false,
            'is_active' => true,
            'priority' => 5,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
};
