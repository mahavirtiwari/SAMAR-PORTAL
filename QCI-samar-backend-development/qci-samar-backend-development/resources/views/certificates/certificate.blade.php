<html>

<head>
<meta http-equiv=Content-Type content="text/html; charset=utf-8">
<meta name=Generator content="Microsoft Word 15 (filtered)">
@php
    // Certificate template artwork is sector-specific: the "Stores/Domain" vs
    // "Services/Domain" labels are baked into the background JPGs, so Service
    // certificates use their own front/back artwork.
    $isService = ($application->sector ?? null) === 'service';
    $frontUrl = str_replace('\\', '/', public_path($isService ? 'pdf/certificate_front_service.jpg' : 'pdf/certificate_front_new.jpg'));
    $backUrl = str_replace('\\', '/', public_path($isService ? 'pdf/certificate_back_service.jpg' : 'pdf/certificate_back_new.jpg'));
@endphp
<style>
    /*
     * Authored on a 270mm-wide canvas that wkhtmltopdf smart-shrinks onto A4 (scale 210/270),
     * so one printed page is 270mm x 381.857mm in canvas units. Both pages are exactly that
     * size so the artwork meets every page edge; the label offsets below are tuned to the
     * artwork at this size. The body margin must stay 0: any margin widens the canvas and
     * changes the shrink factor.
     */
    body {
        margin: 0;
        padding: 0;
    }
    .frontPage, .backPage {
        position: relative;
        width: 270mm;
        height: 381.85mm;
        box-sizing: border-box;
        overflow: hidden;
        background-repeat: no-repeat;
        background-size: 270mm 381.85mm;
    }
    .frontPage {
        page-break-after: always;
        background-image: url("{{ $frontUrl }}");
    }
    .backPage {
        background-image: url("{{ $backUrl }}");
    }
    .score {
            position: absolute;
            top: 129.6mm;
            left: 126.8mm;
			font-size:13pt;
            letter-spacing: 0.5;
            font-weight: bold;
            font-family: "Arial";
            color: white;
        }

        .unit-name {
            position: absolute;
            top: 195.9mm;
            left: 28.7mm;
			font-size:14pt;
            font-weight: bold;
            font-family: "Arial";
			width:80%;
			text-align:center;
			text-transform: uppercase;
        }

        .unit-address {
            position: absolute;
            top: 231.1mm;
            left: 28.7mm;
            font-size:14pt;
            font-weight: bold;
            font-family: "Arial";
            width:80%;
			text-align:center;
            text-transform: uppercase;
        }
		.unit-address-sec{
			position: absolute;
            top: 261.3mm;
            left: 28.7mm;
            font-size:14pt;
            font-weight: bold;
            font-family: "Arial";
            width:80%;
			text-align:center;
			text-transform: uppercase;
		}

        .store_domain{
            position: absolute;
            top: 282.4mm;
            left: 139.9mm;
            font-size:10pt;
            font-weight: bold;
            font-family: "Arial";
        }

        .date-issue {
            position: absolute;
            top: 331.1mm;
            left: 65.9mm;
            font-size:11pt;
            font-weight: bold;
            font-family: "Arial";
        }

        .validity {
            position: absolute;
            top: 342.9mm;
            left: 50.9mm;
             font-weight: bold;
            font-family: "Arial";

        }
		table.report_table td, table.report_table th{
            border: 1px solid #ddd;
            padding: 8px;
        }
        table.report_table th{
            padding-top: 12px;
            padding-bottom: 12px;
            text-align: left;
            background-color: #A9D08E;
            color: white;
        }
        .qr-code-container {
        position: absolute;
        bottom: 120px;
        right: 127px;
        }
        .certificate-id {
            position: absolute;
            bottom: 97px;
            right: 95px;
            text-align: right;
            font-size: 16px;
        }
</style>
</head>

<body lang=EN-US link="#0563C1" vlink="#954F72" style='word-wrap:break-word'>

<div class=WordSection1>
        @if(!empty($pages))
            @foreach($pages as $page)
            <div class="{{$page}}" style="font-family: 'Cambria'">
                @include("certificates.partials.{$page}")
            </div>
            @endforeach
        @endif
</div>

</body>

</html>
