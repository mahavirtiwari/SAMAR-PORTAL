<?php

namespace Tests\Feature;

use App\Models\CommitteeMeeting;
use Illuminate\Support\Facades\View;
use Tests\TestCase;

/**
 * Column headers and the name cell on the Minutes of Meeting and Summary Sheet PDFs.
 * The templates are rendered as HTML here, which exercises the same Blade the PDF
 * pipeline loads without needing wkhtmltopdf. [TASK-08009]
 */
class CommitteeSheetLabelsTest extends TestCase
{
    private function meeting(): CommitteeMeeting
    {
        return new CommitteeMeeting([
            'title' => 'Committee Review',
            'venue' => 'QCI Delhi',
        ]);
    }

    private function summaryRow(): array
    {
        return [
            'enterprise_name' => 'Acme Defence Private Limited',
            'unit_name' => 'Pune Plant',
            'enterprise_classification' => 'Large',
            'category' => 'Category 1',
            'total_employees' => 250,
            'drdo_vendor' => 'Yes',
            'state' => 'Maharashtra',
            'commencement_date' => '01-01-2020',
            'products' => 'Widgets',
            'key_processes' => 'Machining',
            'outsourced_processes' => 'Plating',
            'customers' => 'DRDO',
            'parameters_count' => 12,
            'score' => '4.20',
            'rating' => 'Gold',
        ];
    }

    private function renderSummary(string $sector): string
    {
        return View::make('pdfs.committee.summary-sheet', [
            'meeting' => $this->meeting(),
            'sections' => [['sector' => $sector, 'rows' => [$this->summaryRow()]]],
        ])->render();
    }

    private function renderMinutes(): string
    {
        return View::make('pdfs.committee.minutes-of-meeting', [
            'meeting' => $this->meeting(),
            'startDate' => '01 Sep 2026',
            'endDate' => '02 Sep 2026',
            'venue' => 'QCI Delhi',
            'chairName' => 'Chair',
            'convenorName' => 'Convenor',
            'memberNames' => 'Member One, Member Two',
            'certifiedRows' => [[
                'application_number' => 'SAMAR-APP-1',
                'enterprise_name' => 'Acme Defence Private Limited',
                'unit_name' => 'Pune Plant',
                'classification' => 'Large',
                'state' => 'Maharashtra',
                'unit_address' => 'Plot 1, Industrial Area',
                'assessor_score' => '4.10',
                'final_score' => '4.20',
                'rating' => 'Gold',
            ]],
            'feedbackRows' => [],
            'drdoLogo' => '',
            'samarLogo' => '',
            'qciLogo' => '',
        ])->render();
    }

    public function test_the_minutes_sheet_names_the_enterprise_and_unit_column(): void
    {
        $html = $this->renderMinutes();

        $this->assertStringContainsString('Enterprise/Unit Name', $html);
        $this->assertStringNotContainsString('Unit &amp; Enterprise Name, Unit/Work Address', $html);
    }

    public function test_the_minutes_sheet_calls_the_address_column_unit_or_work_address(): void
    {
        $html = $this->renderMinutes();

        $this->assertStringContainsString('Unit/Work Address', $html);
        $this->assertStringNotContainsString('>Unit Address<', $html);
    }

    public function test_the_summary_sheet_names_the_enterprise_and_unit_column(): void
    {
        $html = $this->renderSummary('manufacturing');

        $this->assertStringContainsString('Enterprise/Unit Name', $html);
        $this->assertStringNotContainsString('Unit &amp; Enterprise Name', $html);
    }

    public function test_the_summary_sheet_puts_the_enterprise_name_above_the_unit_name(): void
    {
        $html = $this->renderSummary('manufacturing');

        $enterpriseAt = strpos($html, 'Acme Defence Private Limited');
        $unitAt = strpos($html, 'Pune Plant');

        $this->assertNotFalse($enterpriseAt);
        $this->assertNotFalse($unitAt);
        $this->assertLessThan(
            $unitAt,
            $enterpriseAt,
            'The enterprise name must come first in the cell, matching the Minutes sheet.',
        );
    }

    public function test_the_summary_score_header_follows_the_sector(): void
    {
        $manufacturing = $this->renderSummary('manufacturing');
        $service = $this->renderSummary('service');

        $this->assertStringContainsString('SA Score', $manufacturing);
        $this->assertStringNotContainsString('RA Score', $manufacturing);

        $this->assertStringContainsString('RA Score', $service);
        $this->assertStringNotContainsString('SA Score', $service);

        $this->assertStringNotContainsString('SA/RA Score', $manufacturing);
        $this->assertStringNotContainsString('SA/RA Score', $service);
    }

    public function test_the_minutes_score_header_is_deliberately_left_alone(): void
    {
        // The sector-specific header was asked for on the Summary sheet only.
        $this->assertStringContainsString('SA/RA Score', $this->renderMinutes());
    }
}
