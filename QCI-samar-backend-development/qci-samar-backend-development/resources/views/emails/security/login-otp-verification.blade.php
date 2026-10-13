@extends('emails.layouts.base')

@section('title', 'Login OTP Verification')


@section('content')
@include('emails.components.greeting', ['name' => $user_name ?? 'User'])

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Your One-Time Password (OTP) for logging in to your SAMAR account <span style="font-weight:500; color:#071437;">{{ $user_samar_id }}</span> is
        <span style="font-weight:500; color:#071437;">{{ $otp_code }}</span>.
    </td>
</tr>

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        This OTP is valid for the next {{ $otp_expires_in ?? '2' }} minutes. Please do not share it with anyone.
    </td>
</tr>

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        If you have not initiated this login request, please secure your account immediately and contact support.
    </td>
</tr>

@include('emails.components.signature')
@endsection
