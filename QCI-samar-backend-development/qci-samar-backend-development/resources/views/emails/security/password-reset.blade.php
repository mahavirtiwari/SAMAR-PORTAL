@extends('emails.layouts.base')

@section('title', 'Password Reset')


@section('content')
@include('emails.components.greeting', ['name' => $user_name ?? 'User'])

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        We received a request to reset the password for your SAMAR account <span style="font-weight:500; color:#071437;">{{ $user_samar_id }}</span>. Your One-Time Password (OTP) for password reset is
        <span style="font-weight:500; color:#071437;">{{ $otp_code }}</span>.
    </td>
</tr>

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        This OTP is valid for the next {{ $otp_expires_in ?? '10' }} minutes. Please do not share it with anyone.
    </td>
</tr>

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        If you did not request a password reset, please ignore this email and your password will remain unchanged.
    </td>
</tr>

@include('emails.components.signature')
@endsection
