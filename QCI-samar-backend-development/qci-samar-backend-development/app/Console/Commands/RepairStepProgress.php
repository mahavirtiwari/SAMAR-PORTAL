<?php

namespace App\Console\Commands;

use App\Models\Assessment;
use Illuminate\Console\Command;

class RepairStepProgress extends Command
{
    protected $signature = 'assessments:repair-step-progress
                            {--id= : Repair a single assessment ID}
                            {--status=in_progress : Limit to assessments with this status (use "all" for any)}
                            {--dry-run : Show stale assessments without writing}';

    protected $description = 'Recompute step_progress for assessments whose persisted status disagrees with the current completeness checks.';

    public function handle(): int
    {
        $dry = $this->option('dry-run');
        $id = $this->option('id');
        $status = $this->option('status');

        $query = Assessment::query();
        if ($id) {
            $query->where('id', $id);
        } elseif ($status !== 'all') {
            $query->where('status', $status);
        }

        $total = 0;
        $changed = 0;

        $query->chunkById(100, function ($chunk) use (&$total, &$changed, $dry) {
            foreach ($chunk as $assessment) {
                $total++;
                $before = $assessment->step_progress ?? [];
                $after = $this->expectedProgress($assessment);

                if ($before == $after) {
                    continue;
                }

                $diff = $this->diff($before, $after);
                $this->line("#{$assessment->id}: ".json_encode($diff));

                if (! $dry) {
                    $assessment->recalculateStepProgress();
                }
                $changed++;
            }
        });

        $this->info(($dry ? '[dry-run] ' : '')."scanned: {$total}, stale: {$changed}");

        return self::SUCCESS;
    }

    private function expectedProgress(Assessment $assessment): array
    {
        $assessment->loadMissing([
            'openingMeeting',
            'closingMeeting',
            'basicInformation',
            'sitePictures',
            'siteTourPictures',
            'parameters.questions',
            'responses',
        ]);

        return [
            Assessment::STEP_PARAMETER_ALLOCATION => $this->flag($assessment->isParameterAllocationComplete()),
            Assessment::STEP_SITE_PICTURES => $this->flag($assessment->isSitePicturesComplete()),
            Assessment::STEP_OPENING_MEETING => $this->flag($assessment->isOpeningMeetingComplete()),
            Assessment::STEP_SITE_TOUR => $this->flag($assessment->isSiteTourComplete()),
            Assessment::STEP_BASIC_INFORMATION => $this->flag($assessment->isBasicInformationComplete()),
            Assessment::STEP_ASSESSMENT_PARAMETERS => $this->flag($assessment->isAssessmentParametersComplete()),
            Assessment::STEP_CLOSING_MEETING => $this->flag($assessment->isClosingMeetingComplete()),
        ];
    }

    private function flag(bool $ok): string
    {
        return $ok ? Assessment::STEP_STATUS_COMPLETED : Assessment::STEP_STATUS_PENDING;
    }

    private function diff(array $before, array $after): array
    {
        $diff = [];
        foreach ($after as $step => $expected) {
            $actual = $before[$step] ?? null;
            if ($actual !== $expected) {
                $diff[$step] = ($actual ?? 'null').' -> '.$expected;
            }
        }

        return $diff;
    }
}
