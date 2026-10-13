@extends('emails.layouts.base')

@section('title', 'SAMAR Certification Payment Confirmation Details')


@section('content')
@include('emails.components.greeting', ['name' => $applicant_name ?? $user_name ?? 'User'])

<tr>
    <td style="font-size:14px; font-weight:400; color:#252F4A; font-family:Inter, sans-serif;">
        We have received your payment for SAMAR Certification. Please find the details below:
    </td>
</tr>

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:600; color:#071437; font-family:Inter, sans-serif;">
        SAMAR ID: <span style="font-weight:500; color:#252F4A;">{{ $user_samar_id ?? 'N/A' }}</span>
    </td>
</tr>

<tr><td height="8"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:600; color:#071437; font-family:Inter, sans-serif;">
        Application ID: <span style="font-weight:500; color:#252F4A;">{{ $application_number ?? 'N/A' }}</span>
    </td>
</tr>

<tr><td height="8"></td></tr>

<tr>
    <td style="font-size:14px; font-weight:600; color:#071437; font-family:Inter, sans-serif;">
        Payment Date: <span style="font-weight:400; color:#252F4A;">{{ $payment_date ?? now()->format('F d, Y') }}</span>
    </td>
</tr>

<tr><td height="24"></td></tr>

<tr>
    <td style="font-size:15px; font-weight:600; color:#071437; font-family:Inter, sans-serif;">
        Payment Summary
    </td>
</tr>

<tr><td height="16"></td></tr>

<tr>
    <td>
        <table width="100%" cellpadding="8" cellspacing="0" border="0" style="border:1px solid #E5E7EB; border-radius:4px;">
            <tr style="background-color:#F9FAFB;">
                <td style="font-size:14px; font-weight:600; color:#071437; font-family:Inter, sans-serif; padding:12px; border-bottom:1px solid #E5E7EB;">
                    Basic Certification Fee (Rs.)
                </td>
                <td style="font-size:14px; font-weight:500; color:#252F4A; font-family:Inter, sans-serif; padding:12px; border-bottom:1px solid #E5E7EB; text-align:right;">
                    {{ $base_certification_fee ?? '0.00' }}
                </td>
            </tr>
            <tr>
                <td style="font-size:14px; font-weight:600; color:#071437; font-family:Inter, sans-serif; padding:12px; border-bottom:1px solid #E5E7EB;">
                    Logistics Fee (Rs.)
                </td>
                <td style="font-size:14px; font-weight:500; color:#252F4A; font-family:Inter, sans-serif; padding:12px; border-bottom:1px solid #E5E7EB; text-align:right;">
                    {{ $food_accommodation_fee ?? '0.00' }}
                </td>
            </tr>
            <tr style="background-color:#F9FAFB;">
                <td style="font-size:14px; font-weight:600; color:#071437; font-family:Inter, sans-serif; padding:12px; border-bottom:1px solid #E5E7EB;">
                    Total (Rs.)
                </td>
                <td style="font-size:14px; font-weight:600; color:#252F4A; font-family:Inter, sans-serif; padding:12px; border-bottom:1px solid #E5E7EB; text-align:right;">
                    {{ $total_before_tax ?? '0.00' }}
                </td>
            </tr>
            <tr>
                <td style="font-size:14px; font-weight:600; color:#071437; font-family:Inter, sans-serif; padding:12px; border-bottom:1px solid #E5E7EB;">
                    GST ({{ $gst_percentage ?? '18' }}%)
                </td>
                <td style="font-size:14px; font-weight:500; color:#252F4A; font-family:Inter, sans-serif; padding:12px; border-bottom:1px solid #E5E7EB; text-align:right;">
                    {{ $gst_amount ?? '0.00' }}
                </td>
            </tr>
            @if (!empty($tds_applied))
            <tr style="background-color:#F9FAFB;">
                <td style="font-size:14px; font-weight:600; color:#071437; font-family:Inter, sans-serif; padding:12px; border-bottom:1px solid #E5E7EB;">
                    TDS ({{ $tds_percentage }}%)
                </td>
                <td style="font-size:14px; font-weight:500; color:#252F4A; font-family:Inter, sans-serif; padding:12px; border-bottom:1px solid #E5E7EB; text-align:right;">
                    {{ $tds_amount ?? '0.00' }}
                </td>
            </tr>
            @endif
            <tr>
                <td style="font-size:15px; font-weight:700; color:#071437; font-family:Inter, sans-serif; padding:12px; background-color:#EFF6FF;">
                    Net Payable Amount (Rs.)
                </td>
                <td style="font-size:15px; font-weight:700; color:#1B84FF; font-family:Inter, sans-serif; padding:12px; text-align:right; background-color:#EFF6FF;">
                    {{ $net_payable_amount ?? '0.00' }}
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
