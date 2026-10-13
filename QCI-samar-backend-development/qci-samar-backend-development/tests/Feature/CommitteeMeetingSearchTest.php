<?php

namespace Tests\Feature;

use App\Models\CommitteeMeeting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommitteeMeetingSearchTest extends TestCase
{
    use RefreshDatabase;

    private function makeMeeting(string $number, string $title): CommitteeMeeting
    {
        return CommitteeMeeting::create([
            'meeting_number' => $number,
            'title' => $title,
            'scheduled_at' => now()->addDay(),
            'meeting_type' => 'virtual',
            'status' => 'scheduled',
        ]);
    }

    public function test_title_search_returns_only_matching_meetings(): void
    {
        $this->makeMeeting('COM-2026-0001', 'First Committee Meeting');
        $this->makeMeeting('COM-2026-0002', 'Renewal review');

        $this->assertSame(['COM-2026-0002'], CommitteeMeeting::search('renewal')->pluck('meeting_number')->all());
        $this->assertSame(['COM-2026-0001'], CommitteeMeeting::search(' First Committee ')->pluck('meeting_number')->all());
    }

    public function test_meeting_number_search_matches_too(): void
    {
        $this->makeMeeting('COM-2026-0001', 'First Committee Meeting');
        $this->makeMeeting('COM-2026-0002', 'Renewal review');

        $this->assertSame(['COM-2026-0002'], CommitteeMeeting::search('0002')->pluck('meeting_number')->all());
    }

    public function test_blank_search_returns_everything(): void
    {
        $this->makeMeeting('COM-2026-0001', 'First Committee Meeting');
        $this->makeMeeting('COM-2026-0002', 'Renewal review');

        $this->assertSame(2, CommitteeMeeting::search('  ')->count());
        $this->assertSame(2, CommitteeMeeting::search(null)->count());
    }
}
