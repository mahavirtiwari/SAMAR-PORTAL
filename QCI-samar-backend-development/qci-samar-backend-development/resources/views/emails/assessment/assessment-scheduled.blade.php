@extends('emails.layouts.base')

@php
    $mode = $assessment_mode ?? 'Onsite Assessment';
    $items = [
        ['label' => 'SAMAR ID', 'value' => $user_samar_id ?? 'N/A'],
        ['label' => 'Lead Assessor Name', 'value' => $lead_assessor_name ?? 'N/A'],
        ['label' => 'Assessor Email ID', 'value' => $lead_assessor_email ?? 'N/A'],
        ['label' => 'Assessor Mobile No', 'value' => $lead_assessor_mobile ?? 'N/A'],
        ['label' => 'Co-assessor Name', 'value' => $co_assessor_names ?? 'N/A'],
        ['label' => 'Final Assessment Date', 'value' => $assessment_date_range ?? 'N/A'],
        ['label' => 'Mode of Assessment', 'value' => $mode],
    ];
    if (! empty($meeting_link)) {
        $items[] = ['label' => 'Meeting Link', 'value' => $meeting_link, 'is_link' => true];
    }
@endphp

@section('title', $mode.' Date and Assessor Details under SAMAR Scheme')


@section('content')
@include('emails.components.greeting', ['name' => $applicant_name ?? $user_name ?? 'User'])

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Thank you for finalising the assessment dates for your application
        <span style="font-family:Inter, sans-serif; font-weight:500; color:#252F4A;">
            {{ $application_number ?? 'N/A' }}
        </span>
        under SAMAR Scheme of DRDO. The details of the assessor(s) allocated for the
        {{ \Illuminate\Support\Str::lower($mode) }} are as follows:
    </td>
</tr>

<tr><td height="24"></td></tr>

@include('emails.components.info-table', ['items' => $items])

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        You will soon be contacted by the Lead Assessor to take this forward.
    </td>
</tr>

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Please mention your SAMAR ID in all your future correspondence.
    </td>
</tr>

@include('emails.components.signature')
@endsection
