@extends('emails.layouts.base')

@section('title', 'Cancellation of Rating Committee Meeting')


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
        We regret to inform you that the Rating Committee Meeting scheduled on
        <span style="font-family:Inter, sans-serif; font-weight:500; color:#252F4A;">{{ $meeting_date ?? 'N/A' }}</span>
        at
        <span style="font-family:Inter, sans-serif; font-weight:500; color:#252F4A;">{{ $meeting_time ?? 'N/A' }}</span>
        for the SAMAR Scheme has been cancelled due to unavoidable circumstances.
    </td>
</tr>

<tr><td height="16"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        A revised schedule will be shared with you shortly. We sincerely apologize for any inconvenience caused and appreciate your understanding.
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
