<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sessions', function (Blueprint $table) {
            // Stable per-install id sent by the client. Single-session enforcement uses
            // it to tell a device re-authenticating from a genuinely different device, so
            // a re-login never terminates its own token as 'new_session' (BUG-06042).
            $table->string('device_id')->nullable()->after('device_name');
            $table->index(['user_id', 'is_active', 'device_id']);
        });

        Schema::table('pending_login_sessions', function (Blueprint $table) {
            $table->string('device_id')->nullable()->after('device_name');
        });
    }

    public function down(): void
    {
        Schema::table('sessions', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'is_active', 'device_id']);
            $table->dropColumn('device_id');
        });

        Schema::table('pending_login_sessions', function (Blueprint $table) {
            $table->dropColumn('device_id');
        });
    }
};
