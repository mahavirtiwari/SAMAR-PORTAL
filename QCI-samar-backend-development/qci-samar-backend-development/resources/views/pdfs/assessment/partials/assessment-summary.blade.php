{{-- Assessment Summary with Background --}}
<div class="pdf-page">
    <img class="pdf-page-background" src="{{ str_replace('\\', '/', public_path('images/assessment-report/page-4.png')) }}" alt="Page 4">

    <div class="pdf-page-content">

        <div class="pdf-section-bar"></div>

        <div class="pdf-section-title">ASSESSMENT SUMMARY</div>


        <div class="small-content" style="margin-top: 30px;">
            <table class="report_table">
                <tr>
                    <th>UNIT NAME</th>
                    <th>ADDRESS OF THE UNIT ASSESSED</th>
                    <th>ASSESSMENT DATES</th>
                    <th>DATE OF CERTIFICATE AWARDED</th>
                </tr>
                <tr>
                    <td>{{ $application->unit_name ?? 'N/A' }}</td>
                    <td>{{ $unitAddress ?? 'N/A' }}</td>
                    <td>
                        @if($assessmentStartDate && $assessmentEndDate)
                            Start date: {{ $assessmentStartDate }}<br>End Date: {{ $assessmentEndDate }}
                        @else
                            {{ $assessmentStartDate ?? 'N/A' }}
                        @endif
                    </td>
                    <td>{{ $certificateDate ?? 'N/A' }}</td>
                </tr>
            </table>
        </div>
        <br />
        <div class="small-content">
            <table class="report_table">
                <tr>
                    <th style="width: 200px;">OVERVIEW</th>
                    <th>NAME</th>
                </tr>
                <tr>
                    <td>Category</td>
                    <td>
                        @if($application->vendor_category)
                            {{ $application->vendor_category }}
                        @else
                            N/A
                        @endif
                    </td>
                </tr>
                <tr>
                    <td>{{ ($application->sector ?? '') === 'service' ? 'Services' : 'Stores' }}</td>
                    <td>
                        @if(!empty($storesCategories['stores']))
                            @php
                                $stores = [];
                                foreach ($storesCategories['stores'] as $store) {
                                    if (!empty($store['category'])) {
                                        $stores[] = $store['category'];
                                    }
                                }
                                echo implode(', ', array_unique(array_slice($stores, 0, 5))) ?: 'N/A';
                            @endphp
                        @else
                            N/A
                        @endif
                    </td>
                </tr>
                <tr>
                    <td>{{ ($application->sector ?? '') === 'service' ? 'Key Service(s)' : 'Key Products' }}</td>
                    <td>
                        @if(!empty($storesCategories['products']))
                            @php
                                $products = [];
                                foreach ($storesCategories['products'] as $product) {
                                    if (!empty($product['category'])) {
                                        $products[] = $product['category'];
                                    }
                                }
                                echo implode(', ', array_unique(array_slice($products, 0, 5))) ?: 'N/A';
                            @endphp
                        @else
                            N/A
                        @endif
                    </td>
                </tr>
            </table>
        </div>
    </div>

    @include('pdfs.assessment.partials.footer')
</div>
