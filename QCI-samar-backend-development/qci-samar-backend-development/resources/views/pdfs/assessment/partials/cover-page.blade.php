{{-- Cover Page with Background Image --}}
<div class="pdf-page">
    <img class="pdf-page-background" src="{{ str_replace('\\', '/', public_path('images/assessment-report/page-1.png')) }}" alt="Cover Page">

    <div class="cover-title">
        <h2>Assessment Report</h2>
        {{ $application->unit_name ? strtoupper($application->unit_name) : 'N/A' }}
        @if($application->unit_district || $application->unit_state)
            <br>({{ $application->unit_district ? strtoupper($application->unit_district) : '' }}{{ $application->unit_district && $application->unit_state ? ', ' : '' }}{{ $application->unit_state ? strtoupper($application->unit_state) : '' }})
        @endif
    </div>

    <div class="cover-coordinates">
        @if($latitude && $longitude)
            <span>LATITUDE: {{ number_format($latitude, 6) }}</span><br><span>LONGITUDE: {{ number_format($longitude, 6) }}</span>
        @endif
    </div>
</div>
