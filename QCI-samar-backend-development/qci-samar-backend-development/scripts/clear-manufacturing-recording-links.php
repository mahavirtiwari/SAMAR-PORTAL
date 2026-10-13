<?php

/**
 * Null out meeting recording links stored against non-service (manufacturing)
 * closing meetings.
 *
 * Background: recording links were previously captured for every closing meeting
 * regardless of sector. The feature is now service-sector only (see TASK-05701);
 * the API no longer accepts or returns them for manufacturing assessments. This
 * script clears any leftover data so none remains in the database.
 *
 * Only the recording_links JSON column is cleared — meeting rows, photos,
 * participants and comments are untouched. Service-sector closing meetings are
 * never modified.
 *
 * Usage:
 *   APP_ENV=staging php scripts/clear-manufacturing-recording-links.php           # dry-run
 *   APP_ENV=staging php scripts/clear-manufacturing-recording-links.php --apply   # write
 */

use App\Models\ApplicationAssessmentMeeting;
use Illuminate\Contracts\Console\Kernel;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$apply = in_array('--apply', $argv, true);

$meetings = ApplicationAssessmentMeeting::query()
    ->where('type', ApplicationAssessmentMeeting::TYPE_CLOSING)
    ->whereNotNull('recording_links')
    ->with('assessment.application')
    ->orderBy('id')
    ->get();

echo 'Mode: '.($apply ? 'APPLY' : 'DRY-RUN')."\n";
echo 'Closing meetings with recording links: '.$meetings->count()."\n\n";

$cleared = 0;
$keptService = 0;

foreach ($meetings as $meeting) {
    $sector = $meeting->assessment?->application?->sector;
    $linkCount = is_array($meeting->recording_links) ? count($meeting->recording_links) : 0;

    if ($sector === 'service') {
        echo "meeting={$meeting->id}  KEEP     assessment={$meeting->assessment_id} sector=service links={$linkCount}\n";
        $keptService++;

        continue;
    }

    echo "meeting={$meeting->id}  CLEAR    assessment={$meeting->assessment_id} sector=".($sector ?? 'null')." links={$linkCount}\n";

    if ($apply) {
        $meeting->update(['recording_links' => null]);
    }

    $cleared++;
}

echo "\n";
echo "Cleared (non-service): $cleared\n";
echo "Kept (service):        $keptService\n";
echo $apply ? "Changes committed.\n" : "Dry-run only. Re-run with --apply to commit.\n";
