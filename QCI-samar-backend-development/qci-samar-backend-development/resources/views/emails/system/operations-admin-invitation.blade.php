@extends('emails.layouts.base')

@section('title', 'Operations Admin Login Details - SAMAR Scheme')

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
        You have been authorized as an Operations Admin under the SAMAR Scheme.
    </td>
</tr>

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:500; color:#071437; font-family:Inter, sans-serif;">
        Your login details are as follows:
    </td>
</tr>

<tr><td height="12"></td></tr>

@include('emails.components.info-table', [
    'items' => [
        ['label' => 'Operations Admin ID:', 'value' => $operations_admin_id ?? 'N/A'],
        ['label' => 'Password:', 'value' => $password ?? 'N/A'],
        ['label' => 'Login URL:', 'value' => $login_url ?? config('app.frontend_url'), 'is_link' => true]
    ]
])



@include('emails.components.signature')
@endsection
