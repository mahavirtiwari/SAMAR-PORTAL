<div style="font-family: 'Cambria'">
    <div style="opacity: 0; width: 2px; height: 2px;"></div>

    {{-- Score/Level Display --}}
    <div class="score">
        {{ !empty($ratingInfo) ? strtoupper($ratingInfo['rating']) : null }}
    </div>

    {{-- Unit Name --}}
    <div class="unit-name">
        {{ $application->unit_name ?? '' }}
    </div>

    {{-- Unit Address --}}
    <div class="unit-address">
        @php
            $addressParts = [];
            if (!empty($application->unit_address)) $addressParts[] = $application->unit_address;
            if (!empty($application->unit_district)) $addressParts[] = $application->unit_district;
            if (!empty($application->unit_state)) $addressParts[] = $application->unit_state;
        @endphp
        {{ implode(', ', $addressParts) }}
    </div>

    {{-- Vendor Category --}}
    <div class="unit-address-sec">
        {{ $application->vendor_category ?? 'Not Applicable' }}
    </div>

    {{-- Manufacturing Stores/Domain --}}
    <div class="store_domain">
        Refer overleaf
    </div>

    {{-- Issue Date --}}
    <div class="date-issue">
        {{ $certificate->issue_date ? $certificate->issue_date->format('d/m/Y') : now()->format('d/m/Y') }}
    </div>

    {{-- Validity Period --}}
    <div class="validity">{{ $validityYears ?? 3 }} </div>

    {{-- QR Code --}}
    <div class="qr-code-container">
        @if (!empty($qrCode))
            <img width="100px" src="{{ $qrCode }}" alt="QR Code">
        @endif
    </div>

    {{-- Certificate ID --}}
    <div class="certificate-id">
        {{ $certificate->certificate_number ?? '' }}
    </div>
</div>
