<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Summary Sheet - {{ $meeting->title ?? '' }}</title>
    <style>
        * { box-sizing: border-box; }

        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 9px;
            color: #2c3e50;
            margin: 0;
            padding: 0;
            line-height: 1.4;
        }

        .header {
            border-bottom: 1px solid #d5dde5;
            padding-bottom: 12px;
            margin-bottom: 16px;
        }

        .header .title {
            font-size: 22px;
            font-weight: 700;
            color: #1e3a5f;
            letter-spacing: 0.4px;
            margin: 0;
            padding: 0;
        }

        .header .accent {
            display: block;
            width: 56px;
            height: 3px;
            background: #1e3a5f;
            margin-top: 6px;
            margin-bottom: 10px;
        }

        .header .meta {
            font-size: 10px;
            color: #5a6b7d;
        }

        .header .meta strong {
            color: #1e3a5f;
            font-weight: 600;
        }

        .header .meta .sep {
            color: #aab5c0;
            margin: 0 8px;
        }

        table.summary-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            border: 1px solid #d5dde5;
        }

        table.summary-table thead th {
            background-color: #1e3a5f;
            color: #ffffff;
            font-size: 8px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            padding: 9px 5px;
            text-align: center;
            vertical-align: middle;
            border-right: 1px solid #2c4f7c;
            line-height: 1.3;
        }

        table.summary-table thead th:last-child {
            border-right: none;
        }

        table.summary-table tbody td {
            padding: 8px 6px;
            vertical-align: middle;
            text-align: center;
            border-bottom: 1px solid #eaeff4;
            border-right: 1px solid #eaeff4;
            font-size: 9px;
            color: #2c3e50;
            word-wrap: break-word;
            line-height: 1.45;
        }

        table.summary-table tbody td:last-child {
            border-right: none;
        }

        table.summary-table tbody tr:nth-child(even) td {
            background-color: #f7f9fb;
        }

        /* Named by position, not by which name goes there: the enterprise name leads and
           the unit name sits under it, matching the Minutes sheet. */
        .name-cell .primary {
            font-weight: 600;
            color: #1e3a5f;
            font-size: 9.5px;
            display: block;
            margin-bottom: 2px;
        }

        .name-cell .secondary {
            color: #6c7a89;
            font-size: 8.5px;
            display: block;
        }

        .badge {
            display: inline-block;
            padding: 2px 7px;
            border-radius: 3px;
            font-size: 8px;
            font-weight: 600;
            letter-spacing: 0.3px;
        }
        .badge-yes { background: #d4edda; color: #1a6c2e; }
        .badge-no  { background: #f3f4f6; color: #57606a; }

        .score-value {
            font-weight: 700;
            color: #1e3a5f;
            font-size: 10px;
        }

        .rating-pill {
            display: inline-block;
            padding: 2px 7px;
            border-radius: 10px;
            font-size: 8px;
            font-weight: 700;
            color: #ffffff;
            background: #1e3a5f;
            white-space: nowrap;
        }
        .rating-l1 { background: #6c757d; }
        .rating-l2 { background: #d97706; }
        .rating-l3 { background: #2563eb; }
        .rating-l4 { background: #16a34a; }
        .rating-l5 { background: #047857; }

        .col-sno           { width: 3%;  }
        .col-name          { width: 11%; }
        .col-classification{ width: 6%;  }
        .col-category      { width: 8%;  }
        .col-employees     { width: 5%;  }
        .col-drdo          { width: 5%;  }
        .col-state         { width: 7%;  }
        .col-commencement  { width: 7%;  }
        .col-products      { width: 10%; }
        .col-process       { width: 7%;  }
        .col-outsourced    { width: 7%;  }
        .col-customers     { width: 8%;  }
        .col-parameters    { width: 5%;  }
        .col-score         { width: 6%;  }
        .col-rating        { width: 5%;  }

        .section-title {
            font-size: 12px;
            font-weight: 700;
            color: #1e3a5f;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0 0 6px 0;
            padding: 0;
        }

        table.summary-table + .section-title {
            margin-top: 18px;
        }

        .no-data {
            text-align: center;
            padding: 40px 20px;
            color: #6c7a89;
            font-size: 12px;
            background: #f7f9fb;
            border: 1px dashed #d5dde5;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="title">Summary Sheet</h1>
        <span class="accent"></span>
        @if(!empty($meeting->title) || $meeting->scheduled_at)
        <div class="meta">
            @if(!empty($meeting->title))
                <strong>Meeting:</strong> {{ $meeting->title }}
            @endif
            @if($meeting->scheduled_at)
                @if(!empty($meeting->title))<span class="sep">|</span>@endif
                <strong>Date:</strong> {{ $meeting->scheduled_at->format('d-m-Y') }}
            @endif
        </div>
        @endif
    </div>

    @php
        $sectorLabels = [
            'manufacturing' => [
                'title' => 'Manufacturing',
                'products' => 'Name of the Products',
                'key' => 'Key Processes',
                'outsourced' => 'Outsourced Processes',
                'score' => 'SA Score',
            ],
            'service' => [
                'title' => 'Services',
                'products' => 'Name of the Services',
                'key' => 'Key Services',
                'outsourced' => 'Outsourced Services',
                'score' => 'RA Score',
            ],
        ];
        // A single-sector meeting needs no heading to tell its tables apart, and
        // suppressing it keeps those sheets identical to how they have always read.
        $showSectionTitles = count($sections) > 1;
    @endphp

    @if(count($sections) > 0)
    @foreach($sections as $section)
    @php
        $labels = $sectorLabels[$section['sector']];
    @endphp
    @if($showSectionTitles)
    <h2 class="section-title">{{ $labels['title'] }}</h2>
    @endif
    <table class="summary-table">
        <thead>
            <tr>
                <th class="col-sno">S No.</th>
                <th class="col-name">Enterprise/Unit Name</th>
                <th class="col-classification">Enterprise Classification</th>
                <th class="col-category">Category</th>
                <th class="col-employees">No. of Employees</th>
                <th class="col-drdo">DRDO Vendor</th>
                <th class="col-state">State</th>
                <th class="col-commencement">Date of Commencement</th>
                <th class="col-products">{{ $labels['products'] }}</th>
                <th class="col-process">{{ $labels['key'] }}</th>
                <th class="col-outsourced">{{ $labels['outsourced'] }}</th>
                <th class="col-customers">Customers</th>
                <th class="col-parameters">No. of Parameters</th>
                <th class="col-score">{{ $labels['score'] }}</th>
                <th class="col-rating">Rating</th>
            </tr>
        </thead>
        <tbody>
            @foreach($section['rows'] as $index => $row)
            <tr>
                <td>{{ $index + 1 }}</td>
                <td class="name-cell">
                    <span class="primary">{{ $row['enterprise_name'] }}</span>
                    <span class="secondary">{{ $row['unit_name'] }}</span>
                </td>
                <td>{{ $row['enterprise_classification'] }}</td>
                <td>{{ $row['category'] }}</td>
                <td>{{ $row['total_employees'] }}</td>
                <td>
                    @if($row['drdo_vendor'] === 'Yes')
                        <span class="badge badge-yes">Yes</span>
                    @else
                        <span class="badge badge-no">No</span>
                    @endif
                </td>
                <td>{{ $row['state'] }}</td>
                <td>{{ $row['commencement_date'] }}</td>
                <td>{{ $row['products'] }}</td>
                <td>{{ $row['key_processes'] }}</td>
                <td>{{ $row['outsourced_processes'] }}</td>
                <td>{{ $row['customers'] }}</td>
                <td>{{ $row['parameters_count'] }}</td>
                <td><span class="score-value">{{ $row['score'] }}</span></td>
                <td>
                    @php
                        $rating = $row['rating'];
                        $level = (is_string($rating) && preg_match('/Level (\d)/', $rating, $m)) ? $m[1] : null;
                    @endphp
                    @if($level)
                        <span class="rating-pill rating-l{{ $level }}">{{ $rating }}</span>
                    @else
                        {{ $rating }}
                    @endif
                </td>
            </tr>
            @endforeach
        </tbody>
    </table>
    @endforeach
    @else
    <div class="no-data">No assessments found for this meeting.</div>
    @endif
</body>
</html>
