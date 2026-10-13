<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Track which staged renewal reminders have already gone out for a certificate.
 *
 * The pre-expiry notifier sends one email per stage (window-open, 30 days,
 * 7 days, expiry); this JSON array records the stage keys already sent so the
 * daily run never re-sends the same stage. NULL/empty means none sent yet.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('certificates', function (Blueprint $table) {
            $table->json('renewal_reminders_sent')->nullable()->after('renews_certificate_id');
        });
    }

    public function down(): void
    {
        Schema::table('certificates', function (Blueprint $table) {
            $table->dropColumn('renewal_reminders_sent');
        });
    }
};
