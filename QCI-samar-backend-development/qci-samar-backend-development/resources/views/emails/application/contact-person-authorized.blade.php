@extends('emails.layouts.base')

@section('title', 'Authorization to Handle SAMAR Scheme Application')


@section('content')
@include('emails.components.greeting')

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        You have been authorized by your enterprise to handle all activities related to the application under the SAMAR Scheme on behalf of your organization.
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
        ['label' => 'Application ID', 'value' => $application_number ?? 'N/A'],
        ['label' => 'Password', 'value' => $password ?? 'N/A'],
        ['label' => 'Login URL', 'value' => $login_url ?? config('app.frontend_url'), 'is_link' => true]
    ]
])

<tr><td height="16"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        (Please use your SAMAR ID to log in and Application ID in all future correspondence for this Scheme).
    </td>
</tr>

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Please ensure that these credentials are used responsibly and only for the purpose of completing the application process.
    </td>
</tr>

@include('emails.components.signature')
@endsection
