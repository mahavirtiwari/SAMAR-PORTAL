<?php

namespace App\Console\Commands;

use App\Models\ApplicationAssessmentSitePicture;
use App\Services\FileStorageService;
use Illuminate\Console\Command;

class DedupeSitePictures extends Command
{
    protected $signature = 'assessments:dedupe-site-pictures
                            {--id= : Limit to a single assessment ID}
                            {--dry-run : Show duplicates without deleting}';

    protected $description = 'Collapse duplicate assessor site pictures (a re-save bug created multiple interior/exterior rows per assessment). Keeps the newest capture per title, deletes the rest and their files.';

    public function __construct(protected FileStorageService $fileStorage)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');
        $id = $this->option('id');

        // Assessor captures only — applicant-uploaded pool pictures are a legit
        // many-to-select set and must not be touched.
        $query = ApplicationAssessmentSitePicture::query()->where('uploader_type', 'assessor');
        if ($id) {
            $query->where('assessment_id', $id);
        }

        // Newest first within each (assessment, title) group so the first row is
        // the keeper. Tie-break on id so a missing/equal captured_at is stable.
        $groups = $query
            ->orderBy('assessment_id')
            ->orderBy('title')
            ->orderByDesc('captured_at')
            ->orderByDesc('id')
            ->get()
            ->groupBy(fn ($p) => $p->assessment_id.'|'.$p->title);

        $scanned = 0;
        $deleted = 0;
        $groupsFixed = 0;

        foreach ($groups as $key => $pictures) {
            $scanned += $pictures->count();
            if ($pictures->count() <= 1) {
                continue;
            }

            $keep = $pictures->first();
            $losers = $pictures->slice(1);
            $groupsFixed++;
            $this->line("{$key}: keep #{$keep->id} ({$keep->captured_at}), drop ".$losers->pluck('id')->implode(','));

            foreach ($losers as $old) {
                if (! $dry) {
                    if ($old->file_path) {
                        $this->fileStorage->delete($old->file_path);
                    }
                    $old->delete();
                }
                $deleted++;
            }
        }

        $this->info(($dry ? '[dry-run] ' : '')."scanned: {$scanned}, groups deduped: {$groupsFixed}, rows deleted: {$deleted}");

        return self::SUCCESS;
    }
}
