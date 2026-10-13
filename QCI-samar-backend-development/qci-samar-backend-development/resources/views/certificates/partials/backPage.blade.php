<div style="padding-top: 81.45mm; padding-left: 5%; padding-right: 5%;">
    @php
        // Stores/domains source differs by sector:
        //   manufacturing -> mfg_drdo_vendor_stores [{store_name}]
        //   service       -> svc_drdo_vendor_labs   [{lab_name}]
        if ($application->sector === 'service') {
            $rawItems = $application->svc_drdo_vendor_labs ?? [];
            $nameKey = 'lab_name';
            $columnLabel = 'Services';
        } else {
            $rawItems = $application->mfg_drdo_vendor_stores ?? [];
            $nameKey = 'store_name';
            $columnLabel = 'Stores';
        }

        $names = [];
        foreach (is_array($rawItems) ? $rawItems : [] as $item) {
            $name = is_array($item) ? ($item[$nameKey] ?? '') : (is_string($item) ? $item : '');
            $name = trim((string) $name);
            if ($name !== '') {
                $names[] = $name;
            }
        }

        // Limit to maximum 40 entries, split into two columns (first 20, next 20)
        $names = array_slice($names, 0, 40);
        $namesFirst = array_slice($names, 0, 20);
        $namesSecond = array_slice($names, 20, 20);
    @endphp

    @if(!empty($names))
        <table class="report_table">
            <tr>
                <th style="width: 5%;">S.No</th>
                <th>{{ $columnLabel }}</th>
                @if(!empty($namesSecond))
                    <th style="width: 5%;">S.No</th>
                    <th>{{ $columnLabel }}</th>
                @endif
            </tr>

            @foreach($namesFirst as $key => $name)
                <tr>
                    <td style="width: 5%;">{{ $key + 1 }}</td>
                    <td>{{ $name }}</td>

                    @if(!empty($namesSecond))
                        @if(isset($namesSecond[$key]))
                            <td style="width: 5%;">{{ $key + 21 }}</td>
                            <td>{{ $namesSecond[$key] }}</td>
                        @else
                            <td style="width: 5%;"></td>
                            <td></td>
                        @endif
                    @endif
                </tr>
            @endforeach
        </table>
        <br />
        <p>Note: For Information on further {{ strtolower($columnLabel) }}, please contact the organization</p>
    @else
        <p style="text-align: center; color: #666;">No {{ strtolower($columnLabel) }}/domains information available.</p>
    @endif
</div>
