{{-- FLOW: Performance on individual parameters, paginated by measured height --}}
<div class="pdf-flow">
    <div class="pdf-block">
        <div class="pdf-section-bar"></div>
        <div class="pdf-section-title" style="margin-bottom: 15px;">PERFORMANCE ON INDIVIDUAL PARAMETERS</div>
    </div>

    @foreach($parameterDetails as $paramIndex => $param)
        <div class="pdf-block pdf-splittable">
            <div class="small-content">
                <div class="parameter-block">
                    <p class="parameter-title">
                        <strong class="pdf-contd">{{ $paramIndex + 1 }}. Parameter Name: {{ $param['name'] }}</strong>
                        <span class="parameter-score"><strong>Score: {{ $param['score'] }}</strong></span>
                        <span class="clear"></span>
                    </p>

                    <table class="report_table fixed-columns" style="margin-bottom: 20px;">
                        <thead>
                            <tr>
                                <th style="width: 8%; white-space: nowrap;">S NO</th>
                                <th style="width: 42%;">QUESTION</th>
                                <th style="width: 25%;">OPTION</th>
                                <th style="width: 25%;">ASSESSOR REMARK</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach($param['questions'] as $qIndex => $question)
                            <tr>
                                <td style="text-align: center;">{{ $qIndex + 1 }}</td>
                                <td>{{ $question['question_text'] }}</td>
                                <td>{{ $question['selected_option_text'] }}</td>
                                <td>{{ $question['assessor_remarks'] }}</td>
                            </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    @endforeach
</div>
