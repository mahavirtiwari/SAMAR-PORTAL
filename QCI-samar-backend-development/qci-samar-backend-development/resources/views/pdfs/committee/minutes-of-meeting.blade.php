<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Minutes of Meeting - {{ $meeting->title ?? '' }}</title>
    <style>
        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10px;
            color: #333;
            margin: 0;
            padding: 0;
        }

        .header {
            width: 100%;
            margin-bottom: 5px;
        }

        .header td {
            vertical-align: middle;
        }

        .header .logo-left {
            text-align: left;
            width: 30%;
        }

        .header .logo-center {
            text-align: center;
            width: 40%;
        }

        .header .logo-right {
            text-align: right;
            width: 30%;
        }

        /* SAMAR is a square emblem; DRDO/QCI are wide wordmarks. Equal height leaves
           the square badge with far less visual mass, so it needs a larger height to
           read as balanced and legible alongside them. Keep width:auto to preserve
           each source PNG's aspect ratio. */
        .header .logo-left img {
            height: 56px;
            width: auto;
        }

        .header .logo-center img {
            height: 90px;
            width: auto;
        }

        /* QCI is a wide wordmark that reads visually smaller than the DRDO/SAMAR
           seals at equal height, so give it a larger height to balance the row.
           max-width keeps the wider mark from crowding the right page margin. */
        .header .logo-right img {
            height: 68px;
            width: auto;
            max-width: 100%;
        }

        .blue-line {
            width: 100%;
            height: 3px;
            background-color: #2B4C7E;
            margin: 8px 0 20px 0;
        }

        .main-title {
            text-align: center;
            font-size: 22px;
            font-weight: bold;
            color: #333;
            margin-bottom: 6px;
        }

        .sub-title {
            text-align: center;
            font-size: 14px;
            font-weight: bold;
            color: #333;
            margin-bottom: 18px;
        }

        .meeting-info {
            width: 100%;
            margin-bottom: 20px;
            font-size: 11px;
        }

        .meeting-info td {
            vertical-align: top;
            padding: 3px 0;
        }

        .meeting-info .label {
            color: #666;
            padding-right: 6px;
            white-space: nowrap;
        }

        .meeting-info .value {
            font-weight: bold;
            color: #333;
        }

        .meeting-info .icon {
            width: 18px;
            text-align: center;
            color: #2B4C7E;
            font-size: 13px;
        }

        .icon-calendar {
            display: inline-block;
            width: 14px;
            height: 13px;
            border: 1.5px solid #2B4C7E;
            border-radius: 2px;
            position: relative;
            background-color: #fff;
        }
        .icon-calendar::before {
            content: '';
            display: block;
            width: 100%;
            height: 4px;
            background-color: #2B4C7E;
            border-radius: 1px 1px 0 0;
        }

        .icon-location {
            display: inline-block;
            width: 10px;
            height: 10px;
            background-color: #2B4C7E;
            border-radius: 50%;
        }

        .icon-person svg, .icon-people svg {
            vertical-align: middle;
        }

        .section-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            table-layout: fixed;
        }

        .section-header {
            background-color: #f5f5f5;
            text-align: center;
            font-weight: bold;
            font-size: 12px;
            padding: 8px;
            border: 1px solid #ddd;
            border-bottom: none;
            text-transform: uppercase;
            margin-top: 15px;
        }

        .section-table thead th {
            background-color: #2B4C7E;
            color: #FFFFFF;
            font-size: 8px;
            font-weight: bold;
            text-transform: uppercase;
            padding: 7px 4px;
            text-align: center;
            vertical-align: middle;
            border: 1px solid #1a3a5c;
            word-wrap: break-word;
        }

        .section-table tbody td {
            padding: 6px 4px;
            vertical-align: top;
            border: 1px solid #ccc;
            font-size: 9px;
            word-wrap: break-word;
            line-height: 1.4;
            text-align: center;
        }

        .section-table tbody tr:nth-child(even) {
            background-color: #f9f9f9;
        }

        .col-sno { width: 3%; }
        .col-appno { width: 11%; }
        .col-enterprise { width: 13%; }
        .col-classification { width: 9%; }
        .col-state { width: 10%; }
        .col-address { width: 16%; }
        .col-assessor-score { width: 8%; }
        .col-final-score { width: 7%; }
        .col-rating { width: 7%; }
        .col-clarification { width: 14%; }

        .clarification-badge {
            display: inline-block;
            background-color: #FFF3E0;
            color: #E65100;
            font-size: 7px;
            padding: 2px 5px;
            border-radius: 3px;
            margin-top: 3px;
            font-weight: bold;
        }

        .clarification-icon {
            display: inline-block;
            width: 12px;
            height: 12px;
            background-color: #E65100;
            color: white;
            border-radius: 50%;
            text-align: center;
            line-height: 12px;
            font-size: 8px;
            font-weight: bold;
            margin-right: 2px;
            vertical-align: middle;
        }

        .minutes-section {
            margin-top: 25px;
            border: 1px solid #ddd;
            padding: 20px 25px;
        }

        .minutes-title {
            text-align: center;
            font-size: 13px;
            font-weight: bold;
            margin-bottom: 12px;
            text-transform: uppercase;
        }

        .minutes-text {
            font-size: 10px;
            line-height: 1.6;
            color: #444;
            text-align: center;
        }

        .footer-text {
            text-align: center;
            font-size: 8px;
            color: #999;
            margin-top: 15px;
            font-style: italic;
        }
    </style>
</head>
<body>
    {{-- Header with Logos --}}
    <table class="header">
        <tr>
            <td class="logo-left">
                @if(!empty($drdoLogo))
                    <img src="{{ $drdoLogo }}" alt="DRDO">
                @endif
            </td>
            <td class="logo-center">
                @if(!empty($samarLogo))
                    <img src="{{ $samarLogo }}" alt="SAMAR">
                @endif
            </td>
            <td class="logo-right">
                @if(!empty($qciLogo))
                    <img src="{{ $qciLogo }}" alt="QCI">
                @endif
            </td>
        </tr>
    </table>

    <div class="blue-line"></div>

    {{-- Title --}}
    <div class="main-title">Minutes Of Meeting</div>
    <div class="sub-title">{{ $meeting->title ?? '' }}</div>

    {{-- Meeting Info --}}
    <table class="meeting-info">
        <tr>
            <td style="width: 50%; vertical-align: top;">
                <table style="width: 100%;">
                    <tr>
                        <td class="icon"><span class="icon-calendar"></span></td>
                        <td class="label">Start Date:</td>
                        <td class="value">{{ $startDate }}</td>
                    </tr>
                    <tr>
                        <td class="icon"><span class="icon-calendar"></span></td>
                        <td class="label">End Date:</td>
                        <td class="value">{{ $endDate }}</td>
                    </tr>
                    <tr>
                        <td class="icon"><span class="icon-location"></span></td>
                        <td class="label">Venue:</td>
                        <td class="value">{{ $venue }}</td>
                    </tr>
                </table>
            </td>
            <td style="width: 50%; vertical-align: top;">
                <table style="width: 100%;">
                    <tr>
                        <td class="icon"><span class="icon-person"><svg width="13" height="13" viewBox="0 0 24 24" fill="#2B4C7E"><circle cx="12" cy="7" r="5"/><path d="M2 21c0-5.5 4.5-10 10-10s10 4.5 10 10"/></svg></span></td>
                        <td class="label">Chair:</td>
                        <td class="value">{{ $chairName }}</td>
                    </tr>
                    <tr>
                        <td class="icon"><span class="icon-person"><svg width="13" height="13" viewBox="0 0 24 24" fill="#2B4C7E"><circle cx="12" cy="7" r="5"/><path d="M2 21c0-5.5 4.5-10 10-10s10 4.5 10 10"/></svg></span></td>
                        <td class="label">Convener:</td>
                        <td class="value">{{ $convenorName }}</td>
                    </tr>
                    <tr>
                        <td class="icon"><span class="icon-people"><svg width="16" height="13" viewBox="0 0 32 24" fill="#2B4C7E"><circle cx="10" cy="7" r="4.5"/><path d="M0 21c0-5 4-9 10-9s10 4 10 9"/><circle cx="22" cy="7" r="4.5"/><path d="M14 21c0-5 4-9 10-9s10 4 10 9" opacity="0.7"/></svg></span></td>
                        <td class="label">Member Name:</td>
                        <td class="value">{{ $memberNames }}</td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

    {{-- Certified Table --}}
    @if(count($certifiedRows) > 0)
    <div class="section-header">Certified</div>
    <table class="section-table">
        <thead>
            <tr>
                <th class="col-sno">S No.</th>
                <th class="col-appno">Application No.</th>
                <th class="col-enterprise">Enterprise/Unit Name</th>
                <th class="col-classification">Classification</th>
                <th class="col-state">State</th>
                <th class="col-address">Unit/Work Address</th>
                <th class="col-assessor-score">SA/RA Score</th>
                <th class="col-final-score">RC Score</th>
                <th class="col-rating">Rating</th>
            </tr>
        </thead>
        <tbody>
            @foreach($certifiedRows as $index => $row)
            <tr>
                <td style="text-align: center;">{{ $index + 1 }}</td>
                <td>{{ $row['application_number'] }}</td>
                <td>
                    {{ $row['enterprise_name'] }}
                    @if(!empty($row['unit_name']) && $row['unit_name'] !== '-')
                        <br><span style="color: #666; font-size: 8px;">{{ $row['unit_name'] }}</span>
                    @endif
                </td>
                <td>{{ $row['classification'] }}</td>
                <td>{{ $row['state'] }}</td>
                <td>{{ $row['unit_address'] }}</td>
                <td style="text-align: center;">{{ $row['assessor_score'] }}</td>
                <td style="text-align: center;">{{ $row['final_score'] }}</td>
                <td style="text-align: center;">{{ $row['rating'] }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
    @endif

    {{-- Clarification Required Table --}}
    @if(count($feedbackRows) > 0)
    <div class="section-header">Clarification Required</div>
    <table class="section-table">
        <thead>
            <tr>
                <th class="col-sno">S No.</th>
                <th class="col-appno">Application No.</th>
                <th class="col-enterprise">Enterprise/Unit Name</th>
                <th class="col-classification">Classification</th>
                <th class="col-state">State</th>
                <th class="col-address">Unit/Work Address</th>
                <th class="col-clarification">Clarification on Parameter</th>
                <th class="col-assessor-score">SA/RA Score</th>
                <th class="col-final-score">RC Score</th>
            </tr>
        </thead>
        <tbody>
            @foreach($feedbackRows as $index => $row)
            <tr>
                <td style="text-align: center;">{{ $index + 1 }}</td>
                <td>{{ $row['application_number'] }}</td>
                <td>
                    {{ $row['enterprise_name'] }}
                    @if(!empty($row['unit_name']) && $row['unit_name'] !== '-')
                        <br><span style="color: #666; font-size: 8px;">{{ $row['unit_name'] }}</span>
                    @endif
                </td>
                <td>{{ $row['classification'] }}</td>
                <td>{{ $row['state'] }}</td>
                <td>{{ $row['unit_address'] }}</td>
                <td>
                    {{ $row['clarification_parameter'] }}
                    <br>
                    <span class="clarification-badge">
                        <span class="clarification-icon">!</span> Clarification Required
                    </span>
                </td>
                <td style="text-align: center;">{{ $row['assessor_score'] }}</td>
                <td style="text-align: center;">{{ $row['final_score'] }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
    @endif

    {{-- Minutes of Meeting Section --}}
    <div class="minutes-section">
        <div class="minutes-title">Minutes of Meeting</div>
        <div class="minutes-text">
            {!! nl2br(e($meeting->minutes ?? 'The certification framework has been developed by the Quality Council of India and is based on a maturity assessment framework and is applicable to all defence Manufacturing and Service enterprises, i.e., Start-Up, micro, small, medium and large enterprises. SAMAR is an outcome of the collaboration between DRDO and QCI to strengthen the \'defence Manufacturing and Service\' ecosystem in the country with an objective to further the vision of making India self-reliant in defence Sector.')) !!}
        </div>
    </div>

    {{-- Footer --}}
    <div class="footer-text">
        This is a computer generated document and doesn't require signature.
    </div>
</body>
</html>
