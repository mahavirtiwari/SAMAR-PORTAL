<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Addresses blind-copied on every outgoing email (Settings → Email Server).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mail_configurations', function (Blueprint $table) {
            $table->json('bcc')->nullable()->after('from_name');
        });
    }

    public function down(): void
    {
        Schema::table('mail_configurations', function (Blueprint $table) {
            $table->dropColumn('bcc');
        });
    }
};
