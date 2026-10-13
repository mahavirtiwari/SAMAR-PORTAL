@extends('emails.layouts.base')

@section('title', 'Welcome to SAMAR Portal')

@section('content')
@include('emails.components.greeting', ['name' => $user_name ?? 'User'])

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        An account has been created for you on the SAMAR Certification Portal.
    </td>
</tr>

<tr><td height="24"></td></tr>

@php
    $accountItems = [
        ['label' => 'Organization:', 'value' => $organization_name ?? 'N/A']
    ];

    if(isset($assigned_roles) && is_array($assigned_roles) && count($assigned_roles) > 0) {
        $accountItems[] = ['label' => 'Assigned Roles:', 'value' => implode(', ', $assigned_roles)];
    }
@endphp

@include('emails.components.info-table', ['items' => $accountItems])

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:500; color:#071437; font-family:Inter, sans-serif;">
        Your Login Credentials:
    </td>
</tr>

<tr><td height="12"></td></tr>

@include('emails.components.info-table', [
    'items' => [
        ['label' => 'SAMAR ID:', 'value' => $samar_id ?? 'N/A'],
        ['label' => 'Temporary Password:', 'value' => $password ?? 'N/A'],
        ['label' => 'Login URL:', 'value' => $portal_url ?? config('app.frontend_url'), 'is_link' => true]
    ]
])

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:500; color:#071437; font-family:Inter, sans-serif;">
        First-Time Login Instructions:
    </td>
</tr>

<tr><td height="12"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        1. Visit the SAMAR Portal using the link above<br>
        2. Enter your SAMAR ID and temporary password to log in<br>
        3. You will be prompted to complete your profile<br>
        4. Change your password immediately after first login
    </td>
</tr>

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:500; color:#071437; font-family:Inter, sans-serif;">
        Important Security Notes:
    </td>
</tr>

<tr><td height="12"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        - This is a temporary password - please change it upon first login<br>
        - Never share your password with anyone<br>
        - Keep your credentials secure and confidential
    </td>
</tr>

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        If you need assistance, please contact your organization administrator or our support team.
    </td>
</tr>

@include('emails.components.signature')
@endsection
