<?php

namespace Tests\Unit\Models;

use App\Models\ApplicationAssessmentResponse;
use Tests\TestCase;

/**
 * `assessed_by` is the remark's author and drives the "comment by <assessor>"
 * display. A co-assessor re-saving a question the lead remarked on (the mobile
 * echoes the loaded remark back even on a score-only change) must not re-stamp
 * the lead's text with the co-assessor's name.
 */
class ApplicationAssessmentResponseRemarkAttributionTest extends TestCase
{
    public function test_score_only_save_keeps_the_original_remark_and_author(): void
    {
        $response = new ApplicationAssessmentResponse;
        $response->assessor_remarks = 'Lead assessor remark';
        $response->assessed_by = 10; // lead user id

        // Co-assessor (id 20) only changes the score; the unchanged remark is
        // echoed back, so $attributeRemark is false.
        $response->setResponse(4, 'Lead assessor remark', 20, false);

        $this->assertSame('Lead assessor remark', $response->assessor_remarks);
        $this->assertSame(10, $response->assessed_by);
        $this->assertSame(4, $response->selected_option);
    }

    public function test_new_remark_text_attributes_to_its_author(): void
    {
        $response = new ApplicationAssessmentResponse;
        $response->assessor_remarks = 'Lead assessor remark';
        $response->assessed_by = 10;

        // Co-assessor writes their own remark, so authorship moves to them.
        $response->setResponse(4, 'Co assessor remark', 20, true);

        $this->assertSame('Co assessor remark', $response->assessor_remarks);
        $this->assertSame(20, $response->assessed_by);
    }
}
