<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Every state-restricted list (applications, assessments, certificates,
 * payments) and the state-wise dashboards filter or group by unit_state,
 * which had no index.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->index(['unit_state', 'status'], 'idx_applications_unit_state_status');
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropIndex('idx_applications_unit_state_status');
        });
    }
};
