<?php

namespace Tests\Unit\Models;

use App\Models\Assessment;
use Tests\TestCase;

class AssessmentAllocationLockTest extends TestCase
{
    public function test_unlocked_when_step_progress_is_null(): void
    {
        $assessment = new Assessment;

        $this->assertFalse($assessment->isAllocationLocked());
    }

    public function test_unlocked_when_opening_meeting_pending(): void
    {
        $assessment = new Assessment;
        $assessment->step_progress = [
            Assessment::STEP_OPENING_MEETING => Assessment::STEP_STATUS_PENDING,
        ];

        $this->assertFalse($assessment->isAllocationLocked());
    }

    public function test_unlocked_when_opening_meeting_in_progress(): void
    {
        $assessment = new Assessment;
        $assessment->step_progress = [
            Assessment::STEP_OPENING_MEETING => Assessment::STEP_STATUS_IN_PROGRESS,
        ];

        $this->assertFalse($assessment->isAllocationLocked());
    }

    public function test_locked_when_opening_meeting_completed(): void
    {
        $assessment = new Assessment;
        $assessment->step_progress = [
            Assessment::STEP_OPENING_MEETING => Assessment::STEP_STATUS_COMPLETED,
        ];

        $this->assertTrue($assessment->isAllocationLocked());
    }

    public function test_lock_is_independent_of_other_step_statuses(): void
    {
        $assessment = new Assessment;
        $assessment->step_progress = [
            Assessment::STEP_PARAMETER_ALLOCATION => Assessment::STEP_STATUS_COMPLETED,
            Assessment::STEP_SITE_PICTURES => Assessment::STEP_STATUS_COMPLETED,
            Assessment::STEP_OPENING_MEETING => Assessment::STEP_STATUS_PENDING,
            Assessment::STEP_CLOSING_MEETING => Assessment::STEP_STATUS_COMPLETED,
        ];

        $this->assertFalse($assessment->isAllocationLocked());
    }

    public function test_locked_on_save_when_allocation_locked_at_set(): void
    {
        $assessment = new Assessment;
        // Allocation saved by the lead, but the opening meeting has not happened yet.
        $assessment->allocation_locked_at = now();
        $assessment->step_progress = [
            Assessment::STEP_OPENING_MEETING => Assessment::STEP_STATUS_PENDING,
        ];

        $this->assertTrue($assessment->isAllocationLocked());
    }

    public function test_unlocked_when_allocation_locked_at_is_null(): void
    {
        $assessment = new Assessment;
        $assessment->allocation_locked_at = null;

        $this->assertFalse($assessment->isAllocationLocked());
    }
}
