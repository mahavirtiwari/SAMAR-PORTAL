@extends('emails.layouts.base')

@section('title', 'Welcome to SAMAR Portal')


@section('content')
@include('emails.components.greeting', ['name' => $user_name ?? 'User'])

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        We are pleased to welcome you to the SAMAR Certification Portal. Your user account has been created and is ready to use.
    </td>
</tr>

<tr><td height="24"></td></tr>

@include('emails.components.info-table', [
    'items' => [
        ['label' => 'Name:', 'value' => $user_name ?? 'N/A'],
        ['label' => 'SAMAR ID:', 'value' => $samar_id ?? 'N/A'],
        ['label' => 'Email:', 'value' => $user_email ?? 'N/A'],
        ['label' => 'Organization:', 'value' => $organization_name ?? 'N/A']
    ]
])

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:500; color:#071437; font-family:Inter, sans-serif;">
        Getting Started:
    </td>
</tr>

<tr><td height="12"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        1. Log in to the SAMAR Portal using your credentials<br>
        2. Complete your profile information<br>
        3. Familiarize yourself with the dashboard and features<br>
        4. Start your certification journey
    </td>
</tr>

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Thank you for choosing SAMAR Portal for your certification needs. We look forward to supporting your quality excellence journey.
    </td>
</tr>

@include('emails.components.signature')
@endsection
