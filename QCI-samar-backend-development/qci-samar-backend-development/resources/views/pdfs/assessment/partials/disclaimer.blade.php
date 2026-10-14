{{-- Disclaimer Section with Background --}}
{{-- Text is editable in Settings → Content & Disclaimers (content block
     "assessment_report_disclaimer"); sanitised on save. --}}
<div class="pdf-page">
    <img class="pdf-page-background" src="{{ str_replace('\\', '/', public_path('images/assessment-report/disclaimer-page.png')) }}" alt="Page 3">

    <div class="pdf-page-content">
        <div class="pdf-section-bar"></div>

        <div class="pdf-section-title">DISCLAIMER</div>

        <div class="small-content" style="margin-top: 30px;">
            {!! \App\Models\ContentBlock::bodyFor('assessment_report_disclaimer') !!}
        </div>
    </div>

    @include('pdfs.assessment.partials.footer')
</div>
