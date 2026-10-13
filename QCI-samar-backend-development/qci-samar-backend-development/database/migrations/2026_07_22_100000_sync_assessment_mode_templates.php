<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Subjects hardcoded "Onsite Assessment", so service-sector (remote)
     * assessments announced themselves as onsite. They now interpolate
     * {{assessment_mode}}, and carry meeting_link for the remote joining link.
     */
    public function up(): void
    {
        DB::table('notification_templates')
            ->where('slug', 'assessment-scheduled')
            ->update([
                'subject' => '{{assessment_mode}} Date and Assessor Details under SAMAR Scheme - {{application_number}}',
                'variables' => json_encode(['user_name', 'applicant_name', 'application_number', 'lead_assessor_name', 'lead_assessor_email', 'lead_assessor_mobile', 'co_assessor_names', 'assessment_date_range', 'assessment_mode', 'meeting_link']),
                'updated_at' => now(),
            ]);

        foreach (['assessor-assigned', 'co-assessor-assigned'] as $slug) {
            DB::table('notification_templates')
                ->where('slug', $slug)
                ->update([
                    'subject' => 'Allocation of {{assessment_mode}} under SAMAR Scheme – {{application_number}}',
                    'variables' => json_encode(['user_name', 'assessor_name', 'application_number', 'organization_name', 'unit_address', 'assessment_date_range', 'assessment_mode', 'meeting_link', 'assessor_id', 'assessor_password', 'login_url', 'mobile_app_url']),
                    'updated_at' => now(),
                ]);
        }
    }

    public function down(): void
    {
        DB::table('notification_templates')
            ->where('slug', 'assessment-scheduled')
            ->update([
                'subject' => 'Onsite Assessment Date and Assessor Details under SAMAR Scheme - {{application_number}}',
                'variables' => json_encode(['user_name', 'applicant_name', 'application_number', 'lead_assessor_name', 'lead_assessor_email', 'lead_assessor_mobile', 'co_assessor_names', 'assessment_date_range', 'assessment_mode']),
                'updated_at' => now(),
            ]);

        foreach (['assessor-assigned', 'co-assessor-assigned'] as $slug) {
            DB::table('notification_templates')
                ->where('slug', $slug)
                ->update([
                    'subject' => 'Allocation of Onsite Assessment under SAMAR Scheme – {{application_number}}',
                    'variables' => json_encode(['user_name', 'assessor_name', 'application_number', 'organization_name', 'unit_address', 'assessment_date_range', 'assessment_mode', 'assessor_id', 'assessor_password', 'login_url', 'mobile_app_url']),
                    'updated_at' => now(),
                ]);
        }
    }
};
