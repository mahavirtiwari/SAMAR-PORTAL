<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Point-in-time feedback completion (BUG-06520).
 *
 * Completion was derived live as answered_count >= FeedbackQuestion::active()->count(),
 * so adding a new active question raised the global count and reopened feedback that was
 * already Completed. This freezes completion the moment it is reached, in a per-application
 * timestamp, so later question changes never reopen it.
 *
 * The backfill stamps every application that is Completed under the old rule right now,
 * using its latest answer's created_at as the completion moment — so existing Completed
 * feedback keeps its status after the read path switches to this column.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->timestamp('feedback_completed_at')->nullable()->after('certified_at');
        });

        $activeQuestionCount = DB::table('feedback_questions')
            ->where('is_active', true)
            ->whereNull('deleted_at')
            ->count();

        if ($activeQuestionCount === 0) {
            return;
        }

        $completedApplicationIds = DB::table('application_feedbacks')
            ->select('application_id')
            ->groupBy('application_id')
            ->havingRaw('COUNT(*) >= ?', [$activeQuestionCount])
            ->pluck('application_id');

        if ($completedApplicationIds->isEmpty()) {
            return;
        }

        DB::table('applications')
            ->whereIn('id', $completedApplicationIds)
            ->update([
                'feedback_completed_at' => DB::raw(
                    '(SELECT MAX(created_at) FROM application_feedbacks'
                    .' WHERE application_feedbacks.application_id = applications.id)'
                ),
            ]);
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn('feedback_completed_at');
        });
    }
};
