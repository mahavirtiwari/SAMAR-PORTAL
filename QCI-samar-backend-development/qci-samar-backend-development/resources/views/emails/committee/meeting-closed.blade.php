@extends('emails.layouts.base')

@section('title', 'Minutes of Meeting for Approval')


@section('content')
<tr>
    <td style="font-size:14px; font-weight:500; color:#071437; font-family:Inter, sans-serif;">
        Dear Madam/Sir,
    </td>
</tr>

<tr><td height="16"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Greetings of the day!
    </td>
</tr>

<tr><td height="16"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Please find attached the Minutes of Meeting (MoM) for the Rating Committee Meeting held on
        <span style="font-family:Inter, sans-serif; font-weight:500; color:#252F4A;">{{ $meeting_date ?? 'N/A' }}</span>
        regarding the review of completed assessments under the SAMAR Scheme.
    </td>
</tr>

<tr><td height="16"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        We request you to kindly review the attached document and provide your approval or comments to proceed with the next steps.
    </td>
</tr>

@if(filled($remarks ?? null))
<tr><td height="24"></td></tr>

@include('emails.components.info-table', [
    'items' => [
        ['label' => 'Remarks:', 'value' => $remarks],
    ]
])
@endif



@include('emails.components.signature')
@endsection
