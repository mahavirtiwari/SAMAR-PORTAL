{{-- About SAMAR Assessment with Background --}}
<div class="pdf-page">
    <img class="pdf-page-background" src="{{ str_replace('\\', '/', public_path('images/assessment-report/page-2.png')) }}" alt="Page 2">

    <div class="pdf-page-content">

        <div class="small-content" style="position: relative;max-width: 400px;top: 40mm;">

            <div class="pdf-section-bar"></div>
            <div class="pdf-section-title">ABOUT</div>
            <div style="font-size: 25pt; font-weight: bold; color: #003d7a; margin-bottom: 5px;">SAMAR ASSESSMENT</div>
            {{-- Editable in Settings → Content & Disclaimers ("assessment_report_about"); sanitised on save. --}}
            {!! \App\Models\ContentBlock::bodyFor('assessment_report_about') !!}
            <br />

        </div>

        <table class="report_table" style="position: relative; top: 50mm;">

            <tr>
                <th style="width:150px">SCORE</th>
                <th style="width:150px"> MATURITY LEVEL</th>
                <th>ORGANIZATIONAL ATTRIBUTE</th>
            </tr>
            <tr>
                <td>Upto 1.5</td>
                <td>Level 1</td>
                <td>Largely Ad hoc processes</td>
            </tr>
            <tr>
                <td>>1.5-2.5</td>
                <td>Level 2</td>
                <td>Process of standardization has just begun</td>
            </tr>
            <tr>
                <td>>2.5-3.5</td>
                <td>Level 3</td>
                <td>Processes are standardized</td>
            </tr>
            <tr>
                <td>>3.5-4.5</td>
                <td>Level 4</td>
                <td>Processes are standardized, measured and controlled</td>
            </tr>
            <tr>
                <td>>4.5-5.0</td>
                <td>Level 5</td>
                <td>Processes are standardized, measured and continually improved for optimization</td>
            </tr>
        </table>
        <br /><br />
    </div>

    @include('pdfs.assessment.partials.footer')
</div>
