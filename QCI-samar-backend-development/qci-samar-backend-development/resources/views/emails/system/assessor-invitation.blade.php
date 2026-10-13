@extends('emails.layouts.base')

@section('title', 'Assessor Login Details - SAMAR Scheme')

@section('content')
<tr>
    <td style="font-size:14px; font-weight:500; color:#071437; font-family:Inter, sans-serif;">
        Dear {{ !empty($user_name) ? $user_name : 'Madam/Sir' }},
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
        You have been authorized for conducting onsite assessment under the SAMAR Scheme of DRDO, Ministry of Defence.
    </td>
</tr>

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:500; color:#071437; font-family:Inter, sans-serif;">
        Your login details are as follows:
    </td>
</tr>

<tr><td height="12"></td></tr>

@include('emails.components.info-table', [
    'items' => [
        ['label' => 'Assessor ID:', 'value' => $assessor_id ?? $samar_id ?? 'N/A'],
        ['label' => 'Password:', 'value' => $password ?? 'N/A'],
        ['label' => 'Login URL:', 'value' => $login_url ?? $portal_url ?? config('app.frontend_url'), 'is_link' => true]
    ]
])

<tr><td height="12"></td></tr>

<tr>
    <td style="font-size:13px; font-weight:400; color:#78829D; font-family:Inter, sans-serif; font-style:italic;">
        (Please use this Assessor ID in all your future communication regarding this Scheme)
    </td>
</tr>


@include('emails.components.signature')
@endsection
