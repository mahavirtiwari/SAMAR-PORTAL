<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per-assessor mobile cutover marker. When an assessor finishes field work
     * they "Complete on Mobile" — the device pushes this so the server knows the
     * mobile step is done for that team member. The lead can only complete after
     * every co-assessor has, so the last completion (always the lead's) is what
     * flips the assessment to mobile_complete and unlocks QC submission.
     */
    public function up(): void
    {
        Schema::table('application_assessment_team_members', function (Blueprint $table) {
            $table->timestamp('mobile_completed_at')->nullable()->after('role');
            $table->json('mobile_completed_metadata')->nullable()->after('mobile_completed_at');
        });
    }

    public function down(): void
    {
        Schema::table('application_assessment_team_members', function (Blueprint $table) {
            $table->dropColumn(['mobile_completed_at', 'mobile_completed_metadata']);
        });
    }
};
