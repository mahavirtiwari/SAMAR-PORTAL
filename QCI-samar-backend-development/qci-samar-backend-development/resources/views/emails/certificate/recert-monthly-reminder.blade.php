@extends('emails.layouts.base')

@section('title', 'Recertification Reminder - SAMAR Scheme')

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
        This is your monthly reminder that the recertification window for your SAMAR certificate is open. To keep your certification active without interruption, please begin the renewal before your certificate expires. You will continue to receive this reminder each month until the renewal is started.
    </td>
</tr>

<tr><td height="24"></td></tr>

@include('emails.components.info-table', [
    'items' => [
        ['label' => 'Enterprise Name:', 'value' => $organization_name ?? 'N/A'],
        ['label' => 'Application ID:', 'value' => $application_number ?? 'N/A'],
        ['label' => 'Certificate Number:', 'value' => $certificate_number ?? 'N/A'],
        ['label' => 'Valid Until:', 'value' => $expiry_date ?? 'N/A'],
        ['label' => 'Go to Login:', 'value' => $login_url ?? config('app.frontend_url'), 'is_link' => true]
    ]
])

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Renewing starts a fresh application prefilled from your current certified details, so you only need to update what has changed before submitting.
    </td>
</tr>

<tr><td height="16"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Please initiate the renewal from your dashboard, and mention your SAMAR ID in all your future correspondence.
    </td>
</tr>

@include('emails.components.signature')
@endsection
