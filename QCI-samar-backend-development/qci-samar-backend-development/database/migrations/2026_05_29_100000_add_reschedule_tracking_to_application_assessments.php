<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('application_assessments', function (Blueprint $table) {
            $table->unsignedInteger('reschedule_version')->default(0)->after('scheduled_end_date');
            $table->timestamp('rescheduled_at')->nullable()->after('reschedule_version');
        });
    }

    public function down(): void
    {
        Schema::table('application_assessments', function (Blueprint $table) {
            $table->dropColumn(['reschedule_version', 'rescheduled_at']);
        });
    }
};
