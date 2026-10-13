@extends('emails.layouts.base')

@section('title', 'Feedback Request on Assessment Process')


@section('content')
@include('emails.components.greeting')

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        The onsite assessment for your application
        <span style="font-family:Inter, sans-serif; font-weight:500; color:#252F4A;">
            {{ $application_number ?? 'N/A' }}
        </span>
        under the SAMAR Scheme has been successfully completed.
    </td>
</tr>

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        We value your feedback to help us improve the assessment process and overall experience. Kindly take a few minutes to share your feedback by clicking the link below:
    </td>
</tr>

<tr><td height="16"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:600; color:#071437; font-family:Inter, sans-serif;">
        Feedback Link:
        <a href="{{ $feedback_link ?? '#' }}" style="color:#1B84FF; text-decoration:none; font-weight:500;">Click here to submit feedback</a>
    </td>
</tr>

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Your inputs will help us enhance the quality and efficiency of the SAMAR Scheme.
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
