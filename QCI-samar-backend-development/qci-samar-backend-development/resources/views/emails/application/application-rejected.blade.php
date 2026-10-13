@extends('emails.layouts.base')

@section('title', 'Status of Application under SAMAR Scheme of DRDO')


@section('content')
@include('emails.components.greeting', ['name' => $applicant_name ?? $user_name ?? 'User'])

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        We regret to inform you that your application
        <span style="font-family:Inter, sans-serif; font-weight:500; color:#252F4A;">
            {{ $application_number ?? 'N/A' }}
        </span>
        under the SAMAR Scheme has not been approved by DRDO due to the following reason(s):
    </td>
</tr>

<tr><td height="24"></td></tr>

@include('emails.components.info-table', [
    'items' => [
        ['label' => 'Reason for Rejection:', 'value' => $rejection_remarks ?? 'N/A']
    ]
])

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        You may apply again after making the necessary amendments to address the above issue(s). Please log in to your dashboard to initiate a fresh application.
    </td>
</tr>

<tr><td height="24"></td></tr>

<tr>
    <td colspan="2">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
                <td>
                    <span style="font-size:14px; padding-right: 16px; font-weight:400; color:#78829D; font-family:Inter, sans-serif;">
                        Login URL:
                    </span>
                    <span style="font-size:14px; font-weight:500; color:#1B84FF; font-family:Inter, sans-serif;">
                        <a href="{{ $portal_url ?? config('app.frontend_url') }}" style="color:#1B84FF; text-decoration: none;">{{ $portal_url ?? config('app.frontend_url') }}</a>
                    </span>
                </td>
            </tr>
        </table>
    </td>
</tr>

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Please mention your SAMAR ID in all your future correspondence.
    </td>
</tr>

@include('emails.components.signature')
@endsection
