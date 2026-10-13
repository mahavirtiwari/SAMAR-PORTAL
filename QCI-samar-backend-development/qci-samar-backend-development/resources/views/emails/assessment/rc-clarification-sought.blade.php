@extends('emails.layouts.base')

@section('title', 'Assessment Reverted for Clarification')


@section('content')
@include('emails.components.greeting', ['name' => $assessor_name ?? $user_name ?? 'User'])

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Your submitted assessment for Application ID:
        <span style="font-family:Inter, sans-serif; font-weight:500; color:#252F4A;">
            {{ $application_number ?? 'N/A' }}
        </span>
        under the SAMAR Scheme has been reviewed during the Rating Committee Meeting and requires clarification on certain points.
    </td>
</tr>

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        Please log in to your dashboard and review the comments provided. Kindly address the observations and resubmit the assessment within 48 hours to avoid delays in the certification process.
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
