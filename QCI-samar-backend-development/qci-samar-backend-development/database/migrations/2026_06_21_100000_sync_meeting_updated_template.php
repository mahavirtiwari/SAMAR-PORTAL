<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // The meeting-updated template now mirrors the invitation email (same
        // details + Summary Sheet attachment). Older deployments hold the legacy
        // row; force-sync it to match the seeder without a full re-seed.
        DB::table('notification_templates')
            ->where('slug', 'meeting-updated')
            ->update([
                'name' => 'Rating Committee Meeting Updated',
                'description' => 'Sent when a rating committee meeting details are updated, with revised invitation details and attachments',
                'subject' => 'Updated: Rating Committee Meeting Details – SAMAR Scheme',
                'variables' => json_encode(['meeting_date', 'meeting_time', 'meeting_mode', 'meeting_link_or_venue', 'query_form_link']),
                'has_attachment' => true,
                'is_active' => true,
                'priority' => 8,
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        DB::table('notification_templates')
            ->where('slug', 'meeting-updated')
            ->update([
                'name' => 'Meeting Updated',
                'description' => 'Sent when a committee meeting details are updated',
                'subject' => 'Committee Meeting Updated - {{meeting_date}}',
                'variables' => json_encode(['user_name', 'member_name', 'committee_name', 'meeting_date', 'meeting_time', 'meeting_agenda']),
                'has_attachment' => false,
                'priority' => 6,
                'updated_at' => now(),
            ]);
    }
};
