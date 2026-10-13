@extends('emails.layouts.base')

@section('title', 'You have been assigned as the SAMAR Scheme spoke')


@section('content')
@include('emails.components.greeting')

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Your enterprise has assigned you as the spoke responsible for handling all activities related to the SAMAR Scheme for your unit. All existing data for this unit remains available under this account.
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
        ['label' => 'Unit', 'value' => $unit_name ?? 'N/A'],
        ['label' => 'SAMAR ID', 'value' => $samar_id ?? 'N/A'],
        ['label' => 'Password', 'value' => $password ?? 'N/A'],
        ['label' => 'Login URL', 'value' => $login_url ?? config('app.frontend_url'), 'is_link' => true]
    ]
])

<tr><td height="16"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        (Please use your SAMAR ID to log in. Your SAMAR ID does not change.)
    </td>
</tr>

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Please ensure that these credentials are used responsibly and only for the purpose of managing this unit's activities under the SAMAR Scheme.
    </td>
</tr>

@include('emails.components.signature')
@endsection
