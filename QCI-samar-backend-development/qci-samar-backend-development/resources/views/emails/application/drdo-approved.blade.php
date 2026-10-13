@extends('emails.layouts.base')

@section('title', 'Approval of Application under SAMAR Scheme of DRDO')


@section('content')
<tr>
    <td style="font-family:Inter, sans-serif; line-height:22px; color:#333; font-size:14px;">
        <div style="font-size:14px; font-weight:600; color:#071437; font-family:Inter, sans-serif;">
            Dear Applicant,
        </div>
    </td>
</tr>

<tr><td height="8"></td></tr>

<tr>
    <td style="font-family:Inter, sans-serif; line-height:22px; color:#333; font-size:14px;">
        <div style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
            Greetings of the day!
        </div>
    </td>
</tr>

<tr><td height="16"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Your application
        <span style="font-family:Inter, sans-serif; font-weight:500; color:#252F4A;">
            {{ $application_number ?? 'N/A' }}
        </span>
        has been successfully processed by DRDO under the SAMAR Scheme.
    </td>
</tr>

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Please log in to your dashboard and proceed with the payment to continue your certification process.
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
        Please mention your SAMAR ID <span style="font-weight:500; color:#071437;">{{ $user_samar_id }}</span> in all your future correspondence.
    </td>
</tr>

@include('emails.components.signature')
@endsection
