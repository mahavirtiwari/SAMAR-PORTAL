<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Backfill feedback_completed_at for applications that were already complete
     * before a later question was added. The original backfill (2026_07_28_000001)
     * stamped only where answered_count >= current active-question count, so an
     * application that answered every then-active question and then had a new
     * question added is left NULL and still reads as "pending".
     *
     * Correct rule (point-in-time completion): an application is complete iff every
     * currently-active question it did NOT answer was created AFTER its last answer,
     * i.e. the only gaps are questions introduced once it had already finished.
     */
    public function up(): void
    {
        $activeQuestions = DB::table('feedback_questions')
            ->whereNull('deleted_at')
            ->where('is_active', true)
            ->get(['id', 'created_at']);

        $appIds = DB::table('application_feedbacks')
            ->distinct()
            ->pluck('application_id');

        foreach ($appIds as $appId) {
            $app = DB::table('applications')->where('id', $appId)->first(['id', 'feedback_completed_at']);
            if (! $app || $app->feedback_completed_at !== null) {
                continue;
            }

            $answers = DB::table('application_feedbacks')
                ->where('application_id', $appId)
                ->get(['feedback_question_id', 'created_at']);

            $answeredIds = $answers->pluck('feedback_question_id')->filter()->all();
            $lastAnswer = $answers->max('created_at');
            if ($lastAnswer === null) {
                continue;
            }

            $wasComplete = true;
            foreach ($activeQuestions as $question) {
                $unanswered = ! in_array($question->id, $answeredIds, true);
                $existedAtCompletion = $question->created_at !== null && $question->created_at <= $lastAnswer;
                if ($unanswered && $existedAtCompletion) {
                    $wasComplete = false;
                    break;
                }
            }

            if ($wasComplete) {
                DB::table('applications')
                    ->where('id', $appId)
                    ->update(['feedback_completed_at' => $lastAnswer]);
            }
        }
    }

    /**
     * Data-correction backfill — intentionally irreversible. The prior migration
     * already stamped a subset of rows, and on rollback we cannot distinguish those
     * from the ones stamped here, so reversing would risk clearing legitimately
     * completed feedback. No-op by design.
     */
    public function down(): void
    {
        // no-op
    }
};
