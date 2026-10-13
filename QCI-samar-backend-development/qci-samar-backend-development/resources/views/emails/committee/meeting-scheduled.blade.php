@extends('emails.layouts.base')

@php
    $items = [
        ['label' => 'Date:', 'value' => $meeting_date ?? 'N/A'],
        ['label' => 'Time:', 'value' => $meeting_time ?? 'N/A'],
        ['label' => 'Mode:', 'value' => $meeting_mode ?? 'N/A'],
        ['label' => 'Meeting Link / Venue:', 'value' => $meeting_link_or_venue ?? 'N/A'],
    ];
    if (filled($remarks ?? null)) {
        $items[] = ['label' => 'Remarks:', 'value' => $remarks];
    }
@endphp

@section('title', 'Rating Committee Meeting Invitation')


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
        You are invited to attend the Rating Committee Meeting under the SAMAR Scheme of DRDO, Ministry of Defence, as per the details below:
    </td>
</tr>

<tr><td height="24"></td></tr>

@include('emails.components.info-table', ['items' => $items])

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:500; color:#071437; font-family:Inter, sans-serif;">
        The following documents are attached for your reference:
    </td>
</tr>

<tr><td height="12"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif; padding-left:8px;">
        1. Agenda of the Meeting<br>
        2. List of Cases for Discussion<br>
        3. Assessment Reports / Summary Sheets
    </td>
</tr>

<tr><td height="16"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Kindly confirm your availability at the earliest.
    </td>
</tr>



@include('emails.components.signature')
@endsection
