@extends('emails.layouts.base')

@section('title', 'OTP Verification for Registration under SAMAR Scheme of DRDO')


@section('content')
@include('emails.components.greeting')

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Your One-Time Password (OTP) for verifying your email address on the SAMAR Portal is
        <span style="font-weight:600; color:#071437; font-size:18px;">{{ $otp_code }}</span>.
    </td>
</tr>

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        This OTP is valid for the next {{ $otp_expires_in ?? '15' }} minutes. Please do not share it with anyone.
    </td>
</tr>

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        If you have not initiated this request, please ignore this email.
    </td>
</tr>

@include('emails.components.signature')
@endsection
