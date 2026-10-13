{{-- Assessment Findings --}}

{{-- PAGE: Methodology + Photos --}}
<div class="pdf-page">
    <div class="pdf-page-content">
        <div class="pdf-section-bar" style="margin-bottom: 20px;"></div>

        <div class="pdf-section-title">ASSESSMENT FINDINGS</div>

        <div class="subheading" style="text-align: center;margin-top: 30px;margin-bottom: 0px;">Methodology</div>
        <br />
        <div class="small-content" style="margin-top: 30px;">
            <p>
                To ensure transparency in the site assessment process, all site-assessment components are monitored electronically and the
                entire process (documents, photographs, comments etc.) is captured on a secure mobile application by the assessors. The data
                captured during site-assessment is not shared externally with anyone except the relevant stakeholders involved for award of
                score/rating.
            </p>
        </div>
        <br />

        <div class="site-evidence">
            <table class="evidence-table">
                <tr>
                    @php
                        $photoLabels = [
                            'site_exterior' => 'Site Exterior Picture',
                            'site_interior' => 'Site Interior Picture',
                            'opening_meeting' => 'Opening Meeting',
                            'closing_meeting' => 'Closing Meeting',
                        ];
                        $photoCount = 0;
                    @endphp

                    @foreach($photoLabels as $key => $label)
                        @if(!empty($photos[$key]))
                            @if($photoCount > 0 && $photoCount % 2 == 0)
                                </tr><tr>
                            @endif

                            <td style="position: relative;">
                                <div style="position: relative; display: inline-block; width:350px;">
                                    <img style="width:100%; height:300px;" src="{{ $photos[$key]['image'] ?? '' }}" alt="{{ $label }}">
                                    <div style="position: absolute; bottom:0px; top:auto; color: white; background: rgba(0, 0, 0, 0.5); height:auto; right:0px; width:100%;">
                                        <div>LAT: {{ $photos[$key]['latitude'] ?? 'N/A' }} LONG: {{ $photos[$key]['longitude'] ?? 'N/A' }}</div>
                                        <div>TIME: {{ $photos[$key]['timestamp'] ?? 'N/A' }}</div>
                                    </div>
                                </div>
                                <p><b>{{ $label }}</b></p>
                            </td>

                            @php $photoCount++; @endphp
                        @endif
                    @endforeach
                </tr>
            </table>
        </div>
    </div>

    @include('pdfs.assessment.partials.footer')
</div>

{{-- FLOW: Parameter score table, paginated by measured height --}}
<div class="pdf-flow">
    <div class="pdf-block">
        <div class="subheading">Performance on Individual Parameters</div>
        <br />
    </div>

    <div class="pdf-block pdf-splittable">
        <div class="small-content">
            <table class="report_table">
                <thead>
                    <tr>
                        <th style="width:8%; white-space: nowrap;">S NO</th>
                        <th>Name of Parameter</th>
                        <th>Score</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($parameterScores as $index => $parameter)
                        <tr>
                            <td style="width:8%">{{ $index + 1 }}</td>
                            <td>{{ $parameter['name'] ?? 'N/A' }}</td>
                            <td>{{ $parameter['score'] ?? '-' }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </div>

    <div class="pdf-block">
        <br />
        <div class="small-content">
            <p>
                The scores obtained on the above parameters are a weighted average of the unit's performance as assessed on the relevant
                SAMAR Maturity Assessment Model. The key purpose of this assessment is to objectively measure the performance of the unit's
                processes and systems on a maturity scale of 1 to 5. This is intended for the applicant enterprise to identify and address areas of
                concern and subsequently improve the current performance to higher maturity levels thereby enhancing its capabilities and
                competitiveness.
            </p>
        </div>
    </div>
</div>
