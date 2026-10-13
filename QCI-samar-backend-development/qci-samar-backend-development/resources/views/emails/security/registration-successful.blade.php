@extends('emails.layouts.base')

@section('title', 'Registration Details for SAMAR Scheme')


@section('content')
@include('emails.components.greeting')

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Thank you for registering your enterprise under the SAMAR Scheme notified by DRDO, Ministry of Defence.
    </td>
</tr>

<tr><td height="16"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Your login details are as follows:
    </td>
</tr>

<tr><td height="16"></td></tr>

@include('emails.components.info-table', [
    'items' => [
        ['label' => 'Enterprise Name', 'value' => $organization_name ?? 'N/A'],
        ['label' => 'SAMAR ID', 'value' => $samar_id ?? 'N/A'],
        ['label' => 'Password', 'value' => $password ?? 'N/A'],
        ['label' => 'Login URL', 'value' => $login_url ?? config('app.frontend_url'), 'is_link' => true]
    ]
])

<tr><td height="16"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        (Please use your SAMAR ID in all future correspondence for this Scheme).
    </td>
</tr>

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Kindly log in using your SAMAR ID and password above to start a new application and proceed further.
    </td>
</tr>

@include('emails.components.signature')
@endsection
