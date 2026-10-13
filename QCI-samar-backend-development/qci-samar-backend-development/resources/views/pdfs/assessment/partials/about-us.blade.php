{{-- About SAMAR Assessment with Background --}}
<div class="pdf-page">
    <img class="pdf-page-background" src="{{ str_replace('\\', '/', public_path('images/assessment-report/page-2.png')) }}" alt="Page 2">

    <div class="pdf-page-content">

        <div class="small-content" style="position: relative;max-width: 400px;top: 40mm;">

            <div class="pdf-section-bar"></div>
            <div class="pdf-section-title">ABOUT</div>
            <div style="font-size: 25pt; font-weight: bold; color: #003d7a; margin-bottom: 5px;">SAMAR ASSESSMENT</div>
            <p>
                System for Advanced Maturity Assessment and Rating (SAMAR) Certification is a benchmark to measure the
                maturity of defence Manufacturing and Service enterprises.
            </p>
            <p>
                The certification framework has been developed by the Quality Council of India and is based on a
                maturity
                assessment framework and is applicable to all defence Manufacturing and Service enterprises, i.e.,
                Start-Up, micro, small, medium and large enterprises.
            </p>
            <p>
                SAMAR is an outcome of the collaboration between DRDO and QCI to strengthen the 'defence
                Manufacturing and Service' ecosystem in the country with an objective to further the vision of making India
                self-reliant in defence Sector.
            </p>
            <p>
                SAMAR Certification framework recognizes 5 levels of enterprise maturity in terms of the defined
                organizational attributes:
            </p>
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
