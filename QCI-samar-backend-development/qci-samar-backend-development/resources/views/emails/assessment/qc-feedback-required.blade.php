@extends('emails.layouts.base')

@section('title', 'QC Review Required')


@section('content')
@include('emails.components.greeting', ['name' => $user_name ?? 'User'])

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        The assessment for Application No:
        <span style="font-family:Inter, sans-serif; font-weight:500; color:#252F4A;">
            {{ $application_number ?? 'N/A' }}
        </span>
        has been submitted and requires your quality control review.
    </td>
</tr>

<tr><td height="24"></td></tr>

@include('emails.components.info-table', [
    'items' => [
        ['label' => 'Organization:', 'value' => $organization_name ?? 'N/A'],
        ['label' => 'Unit Name:', 'value' => $unit_name ?? 'N/A'],
        ['label' => 'Assessor:', 'value' => $assessor_name ?? 'N/A'],
        ['label' => 'Submission Date:', 'value' => $qc_submission_date ?? now()->format('d M Y')]
    ]
])

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Please log in to the SAMAR Portal to review the assessment report and provide your feedback.
    </td>
</tr>

<tr><td height="24"></td></tr>

<tr>
    <td colspan="2">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
                <td>
                    <span style="font-size:14px; padding-right: 16px; font-weight:400; color:#78829D; font-family:Inter, sans-serif;">
                        Login Link:
                    </span>
                    <span style="font-size:14px; font-weight:500; color:#1B84FF; font-family:Inter, sans-serif;">
                        <a href="{{ config('app.frontend_url') }}" style="color:#1B84FF; text-decoration: none;">{{ config('app.frontend_url') }}</a>
                    </span>
                </td>
            </tr>
        </table>
    </td>
</tr>

@include('emails.components.signature')
@endsection
