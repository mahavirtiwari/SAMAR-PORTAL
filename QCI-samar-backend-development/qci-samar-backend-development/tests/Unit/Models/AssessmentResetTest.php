<?php

namespace Tests\Unit\Models;

use App\Models\Assessment;
use Tests\TestCase;

class AssessmentResetTest extends TestCase
{
    public function test_resettable_while_allocation_pending(): void
    {
        $assessment = new Assessment;
        $assessment->status = Assessment::STATUS_ALLOCATION_PENDING;

        $this->assertTrue($assessment->canResetExecutionData());
    }

    public function test_resettable_while_scheduled(): void
    {
        $assessment = new Assessment;
        $assessment->status = Assessment::STATUS_SCHEDULED;

        $this->assertTrue($assessment->canResetExecutionData());
    }

    public function test_resettable_while_in_progress(): void
    {
        $assessment = new Assessment;
        $assessment->status = Assessment::STATUS_IN_PROGRESS;

        $this->assertTrue($assessment->canResetExecutionData());
    }

    public function test_not_resettable_once_mobile_complete(): void
    {
        $assessment = new Assessment;
        $assessment->status = Assessment::STATUS_MOBILE_COMPLETE;

        $this->assertFalse($assessment->canResetExecutionData());
    }

    public function test_not_resettable_once_submitted_for_qc(): void
    {
        $assessment = new Assessment;
        $assessment->status = Assessment::STATUS_SUBMITTED_FOR_QC;

        $this->assertFalse($assessment->canResetExecutionData());
    }

    public function test_not_resettable_once_certified(): void
    {
        $assessment = new Assessment;
        $assessment->status = Assessment::STATUS_CERTIFIED;

        $this->assertFalse($assessment->canResetExecutionData());
    }
}
