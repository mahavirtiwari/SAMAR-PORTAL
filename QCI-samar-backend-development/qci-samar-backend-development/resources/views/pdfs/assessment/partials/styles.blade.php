{{-- Report Styles --}}
<style>
    @font-face { font-family: 'Inter'; font-style: normal; font-weight: 400; src: url("{{ str_replace('\\', '/', public_path('fonts/Inter-Regular.ttf')) }}") format('truetype'); }
    @font-face { font-family: 'Inter'; font-style: normal; font-weight: 500; src: url("{{ str_replace('\\', '/', public_path('fonts/Inter-Medium.ttf')) }}") format('truetype'); }
    @font-face { font-family: 'Inter'; font-style: normal; font-weight: 600; src: url("{{ str_replace('\\', '/', public_path('fonts/Inter-SemiBold.ttf')) }}") format('truetype'); }
    @font-face { font-family: 'Inter'; font-style: normal; font-weight: 700; src: url("{{ str_replace('\\', '/', public_path('fonts/Inter-Bold.ttf')) }}") format('truetype'); }
    @font-face { font-family: 'Inter'; font-style: normal; font-weight: 800; src: url("{{ str_replace('\\', '/', public_path('fonts/Inter-ExtraBold.ttf')) }}") format('truetype'); }

    /*
     * The report is authored on a 270mm-wide canvas that wkhtmltopdf smart-shrinks onto A4
     * (scale 210/270). One printed page is therefore 270mm x 381.857mm in canvas units; every
     * .pdf-page must be exactly that tall or the footer band no longer meets the page edge.
     * The document wrapper clips horizontal overflow so nothing can widen the canvas and change
     * the shrink factor.
     */
    body {
        margin: 0;
        padding: 0;
        font-family: 'Inter', Arial, sans-serif;
    }

    .pdf-document {
        width: 270mm;
        overflow: hidden;
    }

    .pdf-page {
        position: relative;
        width: 270mm;
        height: 381.85mm;
        margin: 0;
        padding: 0;
        overflow: hidden;
        page-break-after: always;
    }

    .pdf-page-last {
        page-break-after: auto;
    }

    .pdf-page-background {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        display: block;
    }

    .pdf-page-content {
        position: relative;
        padding: 65px 80px;
    }

    /* Generated pages: a fixed content box that stops above the footer, so the paginator can
       measure overflow against it. */
    .pdf-page-body {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 14mm;
        padding: 65px 80px 0 80px;
        overflow: hidden;
    }

    .pdf-flow {
        width: 270mm;
    }

    .pdf-section-bar {
        width: 180px;
        height: 4px;
        background-color: #0066cc;
        margin-bottom: 10px;
    }

    .pdf-section-title {
        font-size: 20pt;
        font-weight: bold;
        color: #003d7a;
        margin-bottom: 5px;
    }

    /* Cover Page Elements */
    .cover-title {
        position: absolute;
        top: 280mm;
        width: 100%;
        text-align: center;
        font-size: 20pt;
        font-weight: bold;
        color: white;
        font-family: 'Inter', Arial, sans-serif;
    }

    .cover-coordinates {
        position: absolute;
        top: 335mm;
        width: 100%;
        text-align: center;
        font-size: 14pt;
        font-weight: bold;
        color: white;
        font-family: 'Inter', Arial, sans-serif;
    }

    /* Headings */
    .heading {
        width: 98%;
        font-size: 20px;
        height: 38px;
        color: white;
        margin-bottom: 10px;
        padding-top: 15px;
        border-radius: 5px;
        font-weight: bold;
        background: #2EA08C;
        text-transform: uppercase;
        padding-left: 20px;
    }

    .subheading {
        width: 98%;
        height: 38px;
        font-size: 18px;
        padding-top: 15px;
        border-radius: 5px;
        background: #F2F2F2;
        padding-left: 20px;
    }

    /* Content */
    .small-content {
        font-size: 11pt;
        line-height: 1.5;
    }

    .small-content p {
        margin-top: 5px;
        margin-bottom: 10px;
        text-align: justify;
    }

    .small-content ol {
        margin-left: 20px;
    }

    .small-content ol li {
        margin-bottom: 8px;
    }

    /* Tables */
    .report_table {
        width: 100%;
        border-collapse: collapse;
        margin: 10px 0;
    }

    .report_table th,
    .report_table td {
        border: 1px solid #d1d5db;
        padding: 12px 16px;
        text-align: left;
        font-size: 11pt;
        word-wrap: break-word;
    }

    /* Column widths come from the header cells; a long unbroken string wraps inside its column
       instead of widening the table past the page edge. */
    .report_table.fixed-columns {
        table-layout: fixed;
    }

    /* A page-tall remark must not float its short question and option cells to mid-page. */
    .report_table.fixed-columns td {
        vertical-align: top;
    }

    .report_table th {
        background-color: #1e3a5f;
        color: white;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .report_table td {
        background-color: #ffffff;
    }

    .evidence-table {
        width: 100%;
        border-collapse: collapse;
    }

    .evidence-table td {
        padding: 10px;
        vertical-align: top;
    }

    .parameter-block {
        margin-bottom: 25px;
    }

    .parameter-title {
        margin-bottom: 10px;
        font-size: 11pt;
    }

    .parameter-title .parameter-score {
        float: right;
    }

    .parameter-title .clear {
        clear: both;
    }

    /* Page Footer */
    .page-footer {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background-color: #dfe4ea;
        padding: 10px 60px;
        font-size: 10pt;
        color: #1a3353;
        font-weight: 600;
        font-family: 'Inter', Arial, sans-serif;
    }

    .page-footer table {
        width: 100%;
        border-collapse: collapse;
    }

    .page-footer td {
        padding: 0;
        vertical-align: middle;
    }

    .page-footer .footer-application {
        text-align: left;
    }

    .page-footer .footer-page {
        text-align: right;
        white-space: nowrap;
        width: 30%;
    }
</style>
