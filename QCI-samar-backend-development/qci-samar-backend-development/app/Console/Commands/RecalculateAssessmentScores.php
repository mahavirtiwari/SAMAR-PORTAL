<?php

namespace App\Console\Commands;

use App\Models\Assessment;
use Illuminate\Console\Command;

class RecalculateAssessmentScores extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'assessments:recalculate-scores
                            {--id= : Recalculate for a specific assessment ID}
                            {--status= : Recalculate only for assessments with this status}
                            {--dry-run : Show what would be recalculated without making changes}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Recalculate scores (ratings) for assessments including RC scores from committee. Formula: Sum of Parameter Scores / Number of Parameters';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $dryRun = $this->option('dry-run');
        $specificId = $this->option('id');
        $status = $this->option('status');

        $query = Assessment::query()
            ->whereHas('responses', function ($q) {
                $q->whereNotNull('selected_option');
            });

        if ($specificId) {
            $query->where('id', $specificId);
        }

        if ($status) {
            $query->where('status', $status);
        }

        $assessments = $query->get();

        if ($assessments->isEmpty()) {
            $this->warn('No assessments found matching the criteria.');

            return Command::SUCCESS;
        }

        $this->info(sprintf(
            '%s %d assessment(s)...',
            $dryRun ? 'Would recalculate' : 'Recalculating',
            $assessments->count()
        ));

        $this->newLine();

        $updated = 0;
        $errors = 0;

        foreach ($assessments as $assessment) {
            $oldScore = $assessment->total_score;

            try {
                if (! $dryRun) {
                    // Recalculate scores for all responses first
                    $assessment->responses()
                        ->with('question')
                        ->whereNotNull('selected_option')
                        ->each(function ($response) {
                            $response->calculateScores();
                            $response->save();
                        });

                    // Then recalculate assessment total
                    $assessment->calculateScore();
                    $assessment->refresh();
                }

                $newScore = $dryRun ? $this->previewScore($assessment) : $assessment->total_score;

                $this->line(sprintf(
                    '  [%s]: %s → %s',
                    $assessment->id,
                    $oldScore ?? 'NULL',
                    $newScore ?? 'NULL'
                ));

                $updated++;
            } catch (\Exception $e) {
                $this->error(sprintf(
                    '  [%s]: ERROR - %s',
                    $assessment->id,
                    $e->getMessage()
                ));
                $errors++;
            }
        }

        $this->newLine();

        if ($dryRun) {
            $this->warn('Dry run complete. No changes were made.');
            $this->info('Run without --dry-run to apply changes.');
        } else {
            $this->info(sprintf('Recalculation complete. Updated: %d, Errors: %d', $updated, $errors));
        }

        return $errors > 0 ? Command::FAILURE : Command::SUCCESS;
    }

    /**
     * Preview the score calculation without saving.
     * weighted_score = selected_score × (weightage / 100)
     */
    private function previewScore(Assessment $assessment): ?float
    {
        $responses = $assessment->responses()
            ->whereNotNull('selected_option')
            ->with('question')
            ->get();

        if ($responses->isEmpty()) {
            return null;
        }

        // Recalculate weighted scores from selected_score
        $responses->each(function ($response) {
            if ($response->question) {
                $response->selected_score = $response->question->getOptionScore($response->selected_option);
                $weightage = $response->question->weightage ?? 0;
                $response->weighted_score = $response->selected_score * ($weightage / 100);
            }
        });

        $parameterScores = $responses->groupBy(function ($response) {
            return $response->question->parameter_id ?? 0;
        })->map(function ($parameterResponses) {
            return $parameterResponses->sum('weighted_score');
        });

        $validParameterScores = $parameterScores->filter(fn ($score, $key) => $key !== 0);
        $numberOfParameters = $validParameterScores->count();

        if ($numberOfParameters === 0) {
            return null;
        }

        $sumOfParameterScores = $validParameterScores->sum();

        return round($sumOfParameterScores / $numberOfParameters, 2);
    }
}
