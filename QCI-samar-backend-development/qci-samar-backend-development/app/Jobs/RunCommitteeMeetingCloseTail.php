<?php

namespace App\Jobs;

use App\Http\Controllers\Api\V1\CommitteeMeetingController;
use App\Models\CommitteeMeeting;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

/**
 * After a committee meeting is completed: render the MoM PDF and send the
 * meeting-closed and per-decision emails (certificates and report PDFs for
 * certified units). Minutes of wkhtmltopdf and SMTP work for a large meeting,
 * so it runs on the queue worker instead of a PHP-FPM worker.
 *
 * Not retried: a partial run has already sent some emails and would resend
 * them. Failures are logged per step by the controller.
 */
class RunCommitteeMeetingCloseTail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 1;

    public int $timeout = 1800;

    public function __construct(public int $meetingId)
    {
        $this->afterCommit();
    }

    public function handle(CommitteeMeetingController $controller): void
    {
        $meeting = CommitteeMeeting::find($this->meetingId);
        if ($meeting) {
            $controller->runCloseTail($meeting);
        }
    }
}
