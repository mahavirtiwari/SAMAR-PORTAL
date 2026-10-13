<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta name="Generator" content="Quality Council of India">
    <title>Assessment Report - {{ $application->application_number ?? '' }}</title>

    @include('pdfs.assessment.partials.styles')
</head>

<body lang="EN-US" style="word-wrap: break-word;">
    <div class="pdf-document">
        {{-- Cover (no footer) --}}
        @include('pdfs.assessment.partials.cover-page')

        @include('pdfs.assessment.partials.about-us')

        @include('pdfs.assessment.partials.disclaimer')

        @include('pdfs.assessment.partials.assessment-summary')

        @include('pdfs.assessment.partials.domain')

        {{-- Photos page, then the parameter score table as a flow --}}
        @include('pdfs.assessment.partials.assessment-findings')

        {{-- Per-parameter detail as a flow --}}
        @include('pdfs.assessment.partials.detailed-performance')

        {{-- Last page (no footer) --}}
        @include('pdfs.assessment.partials.contact-us')

        {{-- Skeleton the paginator clones for every generated page; removed once pagination is done --}}
        <div id="pdf-page-template" class="pdf-page">
            <div class="pdf-page-body"></div>
            @include('pdfs.assessment.partials.footer')
        </div>
    </div>

    @include('pdfs.assessment.partials.paginate')
</body>
</html>
