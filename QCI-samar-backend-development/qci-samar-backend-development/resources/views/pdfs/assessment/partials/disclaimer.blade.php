{{-- Disclaimer Section with Background --}}
<div class="pdf-page">
    <img class="pdf-page-background" src="{{ str_replace('\\', '/', public_path('images/assessment-report/disclaimer-page.png')) }}" alt="Page 3">

    <div class="pdf-page-content">
        <div class="pdf-section-bar"></div>

        <div class="pdf-section-title">DISCLAIMER</div>

        <div class="small-content" style="margin-top: 30px;">
            <p>
                This disclaimer governs the use of this report. By using this report, the organisation accepts this
                disclaimer in full.
            </p>
            <ol>
                <li>
                    <p>This is an electronically generated report/transcript and is authenticated by the Quality
                        Council of India (QCI). It does not
                        require any signature.</p>
                </li>
                <li>
                    <p>The rating and certification provided, pertains only to the processes and systems of the unit
                        for which assessment is
                        conducted.</p>
                </li>
                <li>
                    <p>The applicant enterprise has understood fully that it needs to ensure compliance to all
                        legal, statutory and regulatory
                        requirements. Any deviation or non-fulfilment of compliances may result in withdrawal of the
                        rating and certification.</p>
                </li>
                <li>
                    <p>The rating & certification provided is valid only for a period of 2 years from the date of
                        issue as mentioned on the
                        Certificate.</p>
                </li>
                <li>
                    <p>This report contains a summary of critically evaluated assessment findings as observed during
                        the assessment and
                        represents the final rating and certification, validated by the Rating Committee, based on
                        the relevant SAMAR Maturity
                        Assessment model.</p>
                </li>
                <li>
                    <p>This report is meant for the use and benefit of the applicant enterprise and DRDO/QCI shall
                        not accept any liability that may
                        arise if this report is used for any alternative purpose.</p>
                </li>
                <li>
                    <p>Information not disclosed by the applicant enterprise may alter the findings outlined in this
                        report. In such situations, QCI
                        reserves the right to withdraw or amend its rating and conclusions.</p>
                </li>
            </ol>
        </div>
    </div>

    @include('pdfs.assessment.partials.footer')
</div>
