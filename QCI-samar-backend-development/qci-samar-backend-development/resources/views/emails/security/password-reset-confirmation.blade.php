@extends('emails.layouts.base')

@section('title', 'Password Changed Successfully')


@section('content')
@include('emails.components.greeting', ['name' => $user_name ?? 'User'])

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Your password for the SAMAR Portal has been successfully changed.
    </td>
</tr>

<tr><td height="24"></td></tr>

@include('emails.components.info-table', [
    'items' => [
        ['label' => 'Date & Time:', 'value' => $changed_at ?? now()->setTimezone('Asia/Kolkata')->format('d M Y, h:i A')],
        ['label' => 'IP Address:', 'value' => $ip_address ?? 'N/A'],
    ]
])

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        If you did not make this change, please contact our support team immediately and secure your account.
    </td>
</tr>

@include('emails.components.signature')
@endsection
