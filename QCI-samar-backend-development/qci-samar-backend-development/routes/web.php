<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group.
|
| Note: This is primarily an API application. Web routes are minimal.
|
*/

Route::get('/', function () {
    return response()->json([
        'success' => true,
        'message' => 'QCI Samar Backend API',
        'version' => config('app.api_version'),
        'documentation' => url('/api/documentation'),
    ]);
});

// Email Template Preview Routes (Development Only)
if (app()->environment('local', 'development')) {
    Route::get('/email-preview/otp-verification', function () {
        return view('emails.security.otp-verification', [
            'user_name' => 'John Doe',
            'otp_code' => '123456',
            'otp_expires_in' => '2',
        ]);
    });

    Route::get('/email-preview/registration-complete', function () {
        return view('emails.security.registration-complete', [
            'user_name' => 'John Doe',
            'samar_id' => 'SAM-2025-001',
            'email' => 'john.doe@example.com',
            'password' => 'TempPass123!',
            'otp_code' => '123456',
            'otp_expires_in' => '2',
        ]);
    });

    Route::get('/email-preview/payment-received', function () {
        return view('emails.payment.payment-received', [
            'user_name' => 'Jane Smith',
            'application_number' => 'APP-2025-100',
            'transaction_id' => 'TXN-2025-500',
            'amount' => '5000.00',
            'payment_date' => now()->format('d M Y'),
        ]);
    });

    Route::get('/email-preview/assessment-scheduled', function () {
        return view('emails.assessment.assessment-scheduled', [
            'user_name' => 'John Doe',
            'application_number' => 'APP-2025-100',
            'assessment_date' => now()->addDays(7)->format('d M Y'),
            'assessment_time' => '10:00 AM',
            'assessor_names' => 'Dr. A. Kumar, Dr. B. Singh',
        ]);
    });

    Route::get('/email-preview/certificate-issued', function () {
        return view('emails.certificate.certificate-issued', [
            'user_name' => 'John Doe',
            'organization_name' => 'Acme Defense Solutions Pvt. Ltd.',
            'certificate_number' => 'QCI-SAMAR-2025-000001',
            'issue_date' => now()->format('d M Y'),
            'expiry_date' => now()->addYears(3)->subDay()->format('d M Y'),
            'certificate_url' => 'https://example.com/certificates/download/abc123',
        ]);
    });

    Route::get('/email-preview/committee-meeting-scheduled', function () {
        return view('emails.committee.meeting-scheduled', [
            'user_name' => 'Dr. A. Kumar',
            'committee_name' => 'Rating Committee - Aerospace Division',
            'meeting_date' => now()->addDays(5)->format('d M Y'),
            'meeting_time' => '2:00 PM',
            'meeting_venue' => 'DRDO Headquarters, New Delhi',
            'meeting_link' => 'https://meet.google.com/abc-defg-hij',
        ]);
    });
}
