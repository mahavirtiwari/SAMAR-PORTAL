<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('application_assessment_meetings', function (Blueprint $table) {
            // Up to 5 meeting-recording URLs on the closing meeting (assessor adds, lead edits).
            $table->json('recording_links')->nullable()->after('conducted_at');
        });
    }

    public function down(): void
    {
        Schema::table('application_assessment_meetings', function (Blueprint $table) {
            $table->dropColumn('recording_links');
        });
    }
};
