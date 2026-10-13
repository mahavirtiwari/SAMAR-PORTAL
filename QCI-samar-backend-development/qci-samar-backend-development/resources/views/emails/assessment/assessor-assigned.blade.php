@extends('emails.layouts.base')

@php
    $mode = $assessment_mode ?? 'Onsite Assessment';
    $items = [
        ['label' => 'Application ID', 'value' => $application_number ?? 'N/A'],
        ['label' => 'Enterprise Name', 'value' => $organization_name ?? 'N/A'],
        ['label' => 'Unit Name', 'value' => $unit_name ?? 'N/A'],
        ['label' => 'Unit Address', 'value' => $unit_address ?? 'N/A'],
        ['label' => 'Unit SPOC Contact Number', 'value' => $unit_spoc_contact ?? 'N/A'],
        ['label' => 'Assessment Date', 'value' => $assessment_date_range ?? 'N/A'],
        ['label' => 'Mode of Assessment', 'value' => $mode],
    ];
    if (! empty($meeting_link)) {
        $items[] = ['label' => 'Meeting Link', 'value' => $meeting_link, 'is_link' => true];
    }
@endphp

@section('title', 'Allocation of '.$mode.' under SAMAR Scheme')


@section('content')
@include('emails.components.greeting', ['name' => $assessor_name ?? $user_name ?? 'User'])

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        You have been allocated an assessment as Lead Assessor under SAMAR Scheme. The details are as follows:
    </td>
</tr>

<tr><td height="24"></td></tr>

@include('emails.components.info-table', ['items' => $items])

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Please log in to the SAMAR portal or mobile app with your assessor credentials to proceed with the assessment.
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
