<?php

namespace App\Observers;

use App\Models\AssessmentQuestion;

/**
 * Keeps the parameter-level invariant (an active parameter's active questions total
 * exactly 100%) true after ANY change to a question, not only the two controller
 * actions that used to remember to check. Import, bulk update, and every future path
 * that saves or removes a question model gets the guard for free.
 *
 * Mass query-builder writes fire no model events, so a path that bulk-deletes or
 * bulk-inserts questions must still verify the total itself (the importer does).
 */
class AssessmentQuestionObserver
{
    public function saved(AssessmentQuestion $question): void
    {
        $this->reconcileParameter($question);
    }

    public function deleted(AssessmentQuestion $question): void
    {
        $this->reconcileParameter($question);
    }

    public function restored(AssessmentQuestion $question): void
    {
        $this->reconcileParameter($question);
    }

    public function forceDeleted(AssessmentQuestion $question): void
    {
        $this->reconcileParameter($question);
    }

    private function reconcileParameter(AssessmentQuestion $question): void
    {
        // Read the parameter from the database rather than a relation that may have been
        // loaded before this question changed.
        $question->parameter()->first()?->autoDeactivateIfNeeded();
    }
}
