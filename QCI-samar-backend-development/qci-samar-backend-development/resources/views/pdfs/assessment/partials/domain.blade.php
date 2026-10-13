{{-- SAMAR Rating Page --}}
<div class="pdf-page">
    <div class="pdf-page-content">
        <div class="pdf-section-bar"></div>
        <div class="pdf-section-title">SAMAR RATING</div>

        @php
            $hasRating = $ratingLevel !== null && $ratingLevel !== '-' && $ratingLevel !== '';
        @endphp

        <div style="text-align: center; margin: 30px 0;">
            <div style="display: inline-block; text-align: center;">
                <span style="font-size: 48pt; font-weight: bold; color: #0066cc;">LEVEL <span
                        style="font-size:120px">{{ $hasRating ? $ratingLevel : '-' }}</span></span>
                @if($hasRating)
                <img style="width: 450px; height: auto; vertical-align: middle; margin-left: 30px;"
                    src="{{ str_replace('\\', '/', public_path('images/assessment-report/level-' . $ratingLevel . '.png')) }}"
                    alt="SAMAR Level {{ $ratingLevel }}">
                @endif
            </div>
        </div>

        <div class="small-content" style="margin-top: 30px;">
            @php
                $totalCount = $mandatoryCount + $optionalCount;
                $totalAvg = $totalScore !== '-' ? $totalScore : '-';
            @endphp

            <table class="report_table">
                <tr>
                    <th>HEAD</th>
                    <th>MANDATORY PARAMETER</th>
                    <th>OPTIONAL PARAMETER</th>
                    <th>TOTAL</th>
                    <th>SCORE</th>
                    <th>RATING</th>
                </tr>
                <tr>
                    <td style="font-weight: bold;">Number</td>
                    <td style="text-align: center;">{{ $mandatoryCount }}</td>
                    <td style="text-align: center;">{{ $optionalCount }}</td>
                    <td style="text-align: center;">{{ $totalCount }}</td>
                    <td style="text-align: center;" rowspan="2">{{ $hasRating ? $ratingLevel : '-' }}</td>
                    <td style="text-align: center;" rowspan="2">{{ $hasRating ? 'Level ' . $ratingLevel : '-' }}</td>
                </tr>
                <tr>
                    <td style="font-weight: bold;">Score</td>
                    <td style="text-align: center;">{{ $mandatoryAvg }}</td>
                    <td style="text-align: center;">{{ $optionalAvg }}</td>
                    <td style="text-align: center;">{{ $totalAvg }}</td>
                </tr>
            </table>

            <p style="margin-top: 20px; font-size: 9pt; line-height: 1.5; text-align: justify;">
                The scores obtained on the above parameters are a weighted average of the unit's performance as assessed
                on
                the relevant SAMAR Maturity Assessment Model. The key purpose of this assessment is to objectively
                measure the
                performance of the unit's processes and systems on a maturity scale of 1 to 5. This is intended for the
                applicant
                enterprise to identify and address areas of concern and subsequently improve the current performance to
                higher
                maturity levels thereby enhancing its capabilities and competitiveness.
            </p>
        </div>
    </div>

    @include('pdfs.assessment.partials.footer')
</div>
