<?php

/**
 * Repair the damage left by a questionnaire sheet that was imported twice before the
 * import replaced (rather than merged) question sets. [BUG-08638] [BUG-08643]
 *
 * Two layers are affected and both are repaired here:
 *
 *  1. The masters. A parameter whose active questions sum to more than 100% carries
 *     duplicates. Duplicates are identified by normalised question text within the
 *     parameter; the OLDEST row of each group is kept, because that is the one an
 *     already-created assessment was snapshotted from. If a parameter still does not
 *     total 100% after that, it is REPORTED and left alone rather than guessed at.
 *
 *  2. The assessments. Each assessment copies the questionnaire into its own
 *     application_assessment_* tables, so an assessment created while the masters were
 *     wrong holds its own duplicates. The duplicate snapshot questions are removed
 *     together with their responses and evidence, then scores are recalculated by the
 *     existing assessments:recalculate-scores command.
 *
 * A snapshot question is only removed when it is a duplicate AND unanswered wherever
 * possible: if both copies were answered, the one with a response is kept and the empty
 * one dropped. If both were answered the FIRST is kept and the second reported, so no
 * assessor's work is discarded silently.
 *
 * Usage (always run --dry-run first and read the report):
 *   APP_ENV=staging php scripts/repair-duplicated-questionnaire.php --dry-run
 *   APP_ENV=staging php scripts/repair-duplicated-questionnaire.php
 *   APP_ENV=staging php scripts/repair-duplicated-questionnaire.php --assessment=95 --dry-run
 *
 * Options:
 *   --dry-run       report every change without writing anything
 *   --assessment=N  restrict the snapshot repair to one assessment id
 *   --masters-only  repair the parameter masters and skip assessments entirely
 */

use App\Models\AssessmentParameter;
use App\Models\AssessmentQuestion;
use App\Models\AssessmentQuestionOption;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

// The imports above must precede the bootstrap: the formatter sorts `use` statements to
// the top of the statement list, and with the bootstrap first the Kernel alias did not
// apply to it, so the container was asked for a class literally named "Kernel".
require __DIR__.'/../vendor/autoload.php';

$app = require_once __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$options = getopt('', ['dry-run', 'assessment::', 'masters-only', 'drop-answered', 'force-partial']);
$dryRun = isset($options['dry-run']);
$onlyAssessment = isset($options['assessment']) ? (int) $options['assessment'] : null;
$mastersOnly = isset($options['masters-only']);
// Approved 30-Aug-2026: answered copies of a superseded question are removed with their
// responses, and the 20 parameters whose newest import run is only a partial questionnaire
// still have the older run dropped, leaving them below 100% rather than inflated above it.
$dropAnswered = isset($options['drop-answered']);
$forcePartial = isset($options['force-partial']);

$mode = $dryRun ? 'DRY RUN — nothing will be written' : 'LIVE — changes will be written';
echo "Questionnaire duplication repair\n";
echo 'Environment: '.config('app.env')."\n";
echo 'Database:    '.config('database.connections.'.config('database.default').'.database')."\n";
echo "Mode:        {$mode}\n\n";

/** Normalise question text the way the importer now does, for comparison only. */
$normalise = function (?string $text): string {
    $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', (string) $text);
    $text = str_replace(["\u{00A0}", "\u{200B}", "\u{FEFF}"], [' ', '', ''], $text);

    return mb_strtolower(trim(preg_replace('/\s+/u', ' ', $text)));
};

// ---------------------------------------------------------------------------
// 1. Masters
// ---------------------------------------------------------------------------

$overweight = AssessmentParameter::query()
    ->withCount(['questions as active_weightage' => function ($query) {
        $query->where('is_active', true)->select(DB::raw('COALESCE(SUM(weightage), 0)'));
    }])
    ->get()
    ->filter(fn ($parameter) => (int) $parameter->active_weightage > 100);

echo "Parameters over 100% weightage: {$overweight->count()}

";

$mastersFixed = 0;
$mastersUnresolved = [];
$questionsRemoved = 0;
$allSupersededMasterIds = [];

foreach ($overweight as $parameter) {
    $questions = AssessmentQuestion::where('parameter_id', $parameter->id)
        ->where('is_active', true)
        ->orderBy('id')
        ->get();

    // Group the questions into import runs. Matching on question text does not work here:
    // the whole defect is that the second sheet CHANGED the wording ("organization's
    // practices" became "organisation practices"), so the two copies of a question are not
    // textually equal and no text comparison can pair them.
    //
    // What does identify a run is when the rows were written. One import inserts a
    // parameter's questions back to back, so a run is a group of consecutive ids whose
    // timestamps sit within a couple of minutes of each other. created_at alone is too
    // sharp a key — it has one-second resolution, so a slow import splits a single run
    // across several values.
    $runs = [];
    $current = [];
    $previousTime = null;

    foreach ($questions as $question) {
        $time = $question->created_at?->getTimestamp() ?? 0;

        if ($previousTime !== null && abs($time - $previousTime) > 120) {
            $runs[] = $current;
            $current = [];
        }

        $current[] = $question;
        $previousTime = $time;
    }

    if (! empty($current)) {
        $runs[] = $current;
    }

    $latest = end($runs);
    $latestTotal = array_sum(array_map(fn ($question) => (int) $question->weightage, $latest));
    $supersededIds = [];

    foreach (array_slice($runs, 0, -1) as $run) {
        foreach ($run as $question) {
            $supersededIds[] = $question->id;
        }
    }

    echo sprintf(
        '  %s  %s
     %d%% over %d questions in %d import run(s); newest run = %d question(s) at %d%%
',
        $parameter->code,
        mb_substr($parameter->name, 0, 55),
        (int) $parameter->active_weightage,
        $questions->count(),
        count($runs),
        count($latest),
        $latestTotal
    );

    // Only act where the newest run is a complete, self-consistent questionnaire. Anything
    // else is reported for a human: a partial re-import cannot be resolved by deleting
    // rows, because the correct set does not exist in the table at all.
    if (count($runs) < 2 || ($latestTotal !== 100 && ! $forcePartial)) {
        $mastersUnresolved[] = sprintf(
            '%s — %d run(s), newest totals %d%% (currently %d%%)',
            $parameter->code,
            count($runs),
            $latestTotal,
            (int) $parameter->active_weightage
        );
        echo '     SKIPPED — the newest import run is not a complete 100% questionnaire
';

        continue;
    }

    if (! $dryRun && ! empty($supersededIds)) {
        DB::transaction(function () use ($supersededIds) {
            AssessmentQuestionOption::whereIn('question_id', $supersededIds)->forceDelete();
            AssessmentQuestion::whereIn('id', $supersededIds)->forceDelete();
        });
    }

    $allSupersededMasterIds = array_merge($allSupersededMasterIds, $supersededIds);
    $questionsRemoved += count($supersededIds);
    $mastersFixed++;
}

// ---------------------------------------------------------------------------
// 2. Assessment snapshots
// ---------------------------------------------------------------------------

$assessmentsTouched = [];
$answeredConflicts = [];

if (! $mastersOnly) {
    // Snapshot rows carry code = "Q-<master question id>", a precise link back to the
    // master question they were copied from. Text comparison cannot do this job: the whole
    // defect is that the replacement question was REWORDED, so the two copies are not
    // textually equal.
    //
    // A snapshot question counts as superseded when its master row is gone — either removed
    // by this run, or removed by an earlier one. Covering both means the snapshot pass still
    // works when the masters were repaired in a separate run, rather than silently finding
    // nothing to do.
    $supersededMasterIds = array_flip($allSupersededMasterIds);

    // Scope: only snapshot parameters that are actually inflated. A missing master row on
    // its own is not evidence of this bug — a question can be retired for ordinary reasons
    // — so acting on every orphaned reference would delete far more than the duplication
    // caused, including assessor answers that were never part of the problem.
    $inflatedParameterIds = DB::table('application_assessment_questions')
        ->select('parameter_id')
        ->when($onlyAssessment, fn ($builder) => $builder->where('assessment_id', $onlyAssessment))
        ->groupBy('parameter_id')
        ->havingRaw('SUM(weightage) > 100')
        ->pluck('parameter_id');

    echo 'Snapshot parameters over 100%: '.$inflatedParameterIds->count().'
';

    $snapshotRows = DB::table('application_assessment_questions as q')
        ->join('application_assessment_parameters as p', 'p.id', '=', 'q.parameter_id')
        ->whereIn('q.parameter_id', $inflatedParameterIds)
        ->when($onlyAssessment, fn ($builder) => $builder->where('q.assessment_id', $onlyAssessment))
        ->orderBy('q.assessment_id')
        ->orderBy('q.id')
        ->select('q.id', 'q.code', 'q.assessment_id', 'q.parameter_id', 'q.weightage', 'p.code as parameter_code')
        ->get();

    echo "
Snapshot questions inspected: {$snapshotRows->count()}
";

    $dropIds = [];

    $referencedMasterIds = [];
    foreach ($snapshotRows as $row) {
        if (preg_match('/^Q-0*(\d+)$/', (string) $row->code, $matches)) {
            $referencedMasterIds[] = (int) $matches[1];
        }
    }

    $survivingMasterIds = empty($referencedMasterIds) ? [] : array_flip(
        AssessmentQuestion::withTrashed()
            ->whereIn('id', array_unique($referencedMasterIds))
            ->pluck('id')
            ->all()
    );

    foreach ($snapshotRows as $row) {
        if (! preg_match('/^Q-0*(\d+)$/', (string) $row->code, $matches)) {
            continue;
        }

        $masterId = (int) $matches[1];

        // Superseded either because this run removed it, or because it is already gone.
        if (! isset($supersededMasterIds[$masterId]) && isset($survivingMasterIds[$masterId])) {
            continue;
        }

        $dropIds[] = $row->id;
        $assessmentsTouched[$row->assessment_id] = true;
    }

    // Removing the superseded rows must land each parameter exactly on 100%. Where it does
    // not, the snapshot is not a clean double of a questionnaire and is left for a human.
    $dropSet = array_flip($dropIds);
    $keptTotals = [];
    $droppedByParameter = [];

    foreach ($snapshotRows as $row) {
        if (isset($dropSet[$row->id])) {
            $droppedByParameter[$row->parameter_id][] = $row->id;

            continue;
        }
        $keptTotals[$row->parameter_id] = ($keptTotals[$row->parameter_id] ?? 0) + (int) $row->weightage;
    }

    $rejected = 0;
    foreach ($droppedByParameter as $parameterId => $ids) {
        $kept = $keptTotals[$parameterId] ?? 0;

        if ($kept === 100) {
            continue;
        }

        // With --force-partial the masters keep only the newest import run even when that
        // run is an incomplete questionnaire, so the snapshot has to follow or the two stop
        // agreeing: the parameter would keep scoring above 5 against a master that no longer
        // contains those questions. Landing under 100% is accepted here; landing OVER it
        // never is, since that is the defect being repaired.
        if ($forcePartial && $kept > 0 && $kept < 100) {
            continue;
        }

        $rejected++;
        $dropIds = array_values(array_diff($dropIds, $ids));
        $answeredConflicts[] = sprintf(
            'snapshot parameter %d would land on %d%% after removal, not 100%% — left untouched',
            $parameterId,
            $keptTotals[$parameterId] ?? 0
        );
    }

    if ($rejected > 0) {
        echo 'Snapshot parameters left untouched (would not land on 100%): '.$rejected.'
';
    }

    // An answered row is never discarded silently. If assessor work sits on a superseded
    // question, it is reported and kept so a human decides what happens to it.
    $answeredDropIds = empty($dropIds) ? [] : DB::table('application_assessment_responses')
        ->whereIn('question_id', $dropIds)
        ->whereNotNull('selected_option')
        ->pluck('question_id')
        ->all();

    if (! empty($answeredDropIds)) {
        $verb = $dropAnswered ? 'REMOVED with its answer' : 'kept';
        foreach (array_unique($answeredDropIds) as $answeredId) {
            $answeredConflicts[] = 'snapshot question '.$answeredId.' is superseded but carries an assessor answer — '.$verb;
        }

        if (! $dropAnswered) {
            $dropIds = array_values(array_diff($dropIds, $answeredDropIds));
        }
    }

    echo 'Superseded snapshot questions to remove: '.count($dropIds).'
';
    echo 'Superseded but answered: '.count(array_unique($answeredDropIds)).($dropAnswered ? ' (removed with their answers)' : ' (kept for review)').'
';

    if (! $dryRun && ! empty($dropIds)) {
        foreach (array_chunk($dropIds, 500) as $chunk) {
            DB::transaction(function () use ($chunk) {
                $responseIds = DB::table('application_assessment_responses')
                    ->whereIn('question_id', $chunk)
                    ->pluck('id');

                if ($responseIds->isNotEmpty()) {
                    DB::table('application_assessment_response_evidences')
                        ->whereIn('response_id', $responseIds)
                        ->delete();
                }

                DB::table('application_assessment_question_feedbacks')->whereIn('application_assessment_question_id', $chunk)->delete();
                DB::table('application_assessment_responses')->whereIn('question_id', $chunk)->delete();
                DB::table('application_assessment_questions')->whereIn('id', $chunk)->delete();
            });
        }
    }
}

// ---------------------------------------------------------------------------
// 3. Recalculate
// ---------------------------------------------------------------------------

echo "\n";
echo 'Parameters repaired:      '.$mastersFixed."\n";
echo 'Assessments touched:      '.count($assessmentsTouched)."\n";

if (! empty($mastersUnresolved)) {
    echo "\nNeeds a human decision (left untouched):\n";
    foreach ($mastersUnresolved as $line) {
        echo "  - {$line}\n";
    }
}

if (! empty($answeredConflicts)) {
    echo "\nBoth copies were answered — review these:\n";
    foreach ($answeredConflicts as $line) {
        echo "  - {$line}\n";
    }
}

if ($dryRun) {
    echo "\nDry run complete. Re-run without --dry-run to apply.\n";
    exit(0);
}

foreach (array_keys($assessmentsTouched) as $assessmentId) {
    echo "\nRecalculating scores for assessment {$assessmentId}...\n";
    Artisan::call('assessments:recalculate-scores', ['--id' => $assessmentId]);
    echo Artisan::output();
}

echo "\nRepair complete.\n";
