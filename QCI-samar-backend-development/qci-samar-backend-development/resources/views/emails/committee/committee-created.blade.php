@extends('emails.layouts.base')

@section('title', 'Onboarding as Rating Committee Member')


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
        We are pleased to inform you that you have been nominated as a member of the Rating Committee for the SAMAR Scheme of DRDO. Your role will involve reviewing completed onsite assessments and providing recommendations to ensure quality and compliance with scheme guidelines.
    </td>
</tr>

@include('emails.components.signature')
@endsection
