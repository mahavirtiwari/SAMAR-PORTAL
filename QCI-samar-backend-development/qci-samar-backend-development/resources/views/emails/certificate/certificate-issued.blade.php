@extends('emails.layouts.base')

@section('title', 'Certificate and Assessment Report - SAMAR Scheme')


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
        At the outset, we thank you for being a part of the SAMAR Scheme of DRDO, Ministry of Defence.
    </td>
</tr>

<tr><td height="16"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Please find attached the Certificate for your unit. The Assessment Report can be downloaded from your dashboard:
    </td>
</tr>

<tr><td height="24"></td></tr>

@include('emails.components.info-table', [
    'items' => [
        ['label' => 'SAMAR ID:', 'value' => $user_samar_id ?? 'N/A'],
        ['label' => 'Enterprise Name:', 'value' => $organization_name ?? 'N/A'],
        ['label' => 'Application ID:', 'value' => $application_number ?? 'N/A'],
        ['label' => 'Certification Level:', 'value' => $certification_level ?? 'N/A'],
        ['label' => 'Go to Login:', 'value' => $login_url ?? config('app.frontend_url'), 'is_link' => true]
    ]
])

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        We encourage you to adopt the measures suggested in the SAMAR Standard. These recommendations will help you identify and overcome any deficiencies, thereby improving your performance on SAMAR certification parameters.
    </td>
</tr>

<tr><td height="16"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Please acknowledge the receipt of the Certificate and Assessment Report.
    </td>
</tr>

<tr><td height="16"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:500; color:#252F4A; font-family:Inter, sans-serif;">
        Please mention your SAMAR ID in all your future correspondence.
    </td>
</tr>

<tr><td height="16"></td></tr>



<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Wish you all the best in your future journey!
    </td>
</tr>

@include('emails.components.signature')
@endsection
