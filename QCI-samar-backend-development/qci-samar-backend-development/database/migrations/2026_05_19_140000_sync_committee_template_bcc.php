<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private array $committeeSlugs = [
        'committee-created',
        'meeting-scheduled',
        'meeting-cancelled',
        'meeting-closed',
    ];

    public function up(): void
    {
        // Phase 3 routes committee emails through EmailNotificationService, which
        // reads bcc from the template row. Older deployments may have these rows
        // without bcc set; force-sync to match the seeder.
        DB::table('notification_templates')
            ->whereIn('slug', $this->committeeSlugs)
            ->update([
                'bcc' => json_encode(['samar.admin@qcin.org']),
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        DB::table('notification_templates')
            ->whereIn('slug', $this->committeeSlugs)
            ->update([
                'bcc' => null,
                'updated_at' => now(),
            ]);
    }
};
