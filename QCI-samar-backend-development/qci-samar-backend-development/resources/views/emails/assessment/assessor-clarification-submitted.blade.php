@extends('emails.layouts.base')

@section('title', 'Submission of Clarification by Assessor')


@section('content')
@include('emails.components.greeting', ['name' => 'Team'])

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        The requested clarifications for the assessment under the SAMAR Scheme have been submitted by the assessor.
    </td>
</tr>

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:600; color:#071437; font-family:Inter, sans-serif;">
        Please find the details below:
    </td>
</tr>

<tr><td height="16"></td></tr>

@include('emails.components.info-table', [
    'items' => [
        ['label' => 'Application ID', 'value' => $application_number ?? 'N/A'],
        ['label' => 'Enterprise Name', 'value' => $organization_name ?? 'N/A'],
        ['label' => 'Assessor Name', 'value' => $assessor_name ?? 'N/A'],
        ['label' => 'Clarification Submission Date', 'value' => $clarification_submission_date ?? 'N/A'],
    ]
])

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Kindly review the updated assessment and proceed with the next steps in the certification process.
    </td>
</tr>


@include('emails.components.signature')
@endsection
