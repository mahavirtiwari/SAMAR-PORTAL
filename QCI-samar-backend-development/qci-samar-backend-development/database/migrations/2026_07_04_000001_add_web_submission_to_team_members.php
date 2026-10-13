<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per-co-assessor web submission marker. After the assessment is
     * mobile_complete, each co-assessor "submits" on the web to sign off their
     * portion. The lead can only "Submit for QC" once every co-assessor has
     * web-submitted, so this stamp is what unlocks the lead's QC submission.
     */
    public function up(): void
    {
        Schema::table('application_assessment_team_members', function (Blueprint $table) {
            $table->timestamp('web_submitted_at')->nullable()->after('mobile_completed_metadata');
            $table->json('web_submitted_metadata')->nullable()->after('web_submitted_at');
        });
    }

    public function down(): void
    {
        Schema::table('application_assessment_team_members', function (Blueprint $table) {
            $table->dropColumn(['web_submitted_at', 'web_submitted_metadata']);
        });
    }
};
