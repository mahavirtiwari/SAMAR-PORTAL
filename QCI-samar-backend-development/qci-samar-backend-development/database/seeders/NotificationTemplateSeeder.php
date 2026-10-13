<?php

namespace Database\Seeders;

use App\Models\EmailNotificationTemplate;
use Illuminate\Database\Seeder;

class NotificationTemplateSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * NOTE: Email body content is handled by Blade templates in resources/views/emails/
     * Each template references a Blade file based on category and slug:
     * - emails/{category}/{slug}.blade.php
     *
     * This is an email-only notification system.
     */
    public function run(): void
    {
        $templates = [
            // 2. Payment Received
            // Blade: resources/views/emails/payment/payment-received.blade.php
            [
                'slug' => 'payment-received',
                'name' => 'Payment Received',
                'description' => 'Sent when payment is successfully received',
                'event' => 'payment.success',
                'category' => 'payment',
                'subject' => 'SAMAR Certification Payment Confirmation Details – {{application_number}}',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['user_name', 'applicant_name', 'application_number', 'payment_date', 'payment_transaction_id', 'base_certification_fee', 'food_accommodation_fee', 'total_before_tax', 'gst_amount', 'gst_percentage', 'tds_amount', 'tds_percentage', 'net_payable_amount'],
                'recipient_roles' => ['enterprise_admin', 'unit_admin'],
                'is_active' => true,
                'priority' => 8,
            ],

            // 3. Assessment Scheduled
            // Blade: resources/views/emails/assessment/assessment-scheduled.blade.php
            [
                'slug' => 'assessment-scheduled',
                'name' => 'Assessment Scheduled',
                'description' => 'Sent when an assessment date is scheduled',
                'event' => 'assessment.scheduled',
                'category' => 'assessment',
                'subject' => '{{assessment_mode}} Date and Assessor Details under SAMAR Scheme - {{application_number}}',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['user_name', 'applicant_name', 'application_number', 'lead_assessor_name', 'lead_assessor_email', 'lead_assessor_mobile', 'co_assessor_names', 'assessment_date_range', 'assessment_mode', 'meeting_link'],
                'recipient_roles' => ['enterprise_admin', 'unit_admin'],
                'is_active' => true,
                'priority' => 9,
            ],

            // 4. QC Feedback Required (Operations Manager — assessor submitted for QC)
            // Blade: resources/views/emails/assessment/qc-feedback-required.blade.php
            [
                'slug' => 'qc-feedback-required',
                'name' => 'QC Feedback Required',
                'description' => 'Sent to operations manager when an assessor submits an assessment for QC review',
                'event' => 'assessment.submitted_for_qc',
                'category' => 'assessment',
                'subject' => 'QC Review Required - {{application_number}}',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['user_name', 'application_number', 'assessment_date', 'assessor_name', 'qc_submission_date', 'organization_name', 'unit_name'],
                'recipient_roles' => ['operations_manager'],
                'is_active' => true,
                'priority' => 7,
            ],

            // 6. Certificate Issued
            // Blade: resources/views/emails/certificate/certificate-issued.blade.php
            [
                'slug' => 'certificate-issued',
                'name' => 'Certificate and Assessment Report Issued',
                'description' => 'Sent when a certificate and assessment report are issued under SAMAR Scheme',
                'event' => 'certificate.issued',
                'category' => 'certificate',
                'subject' => 'Certificate and Assessment Report under SAMAR Scheme – {{samar_id}}',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['samar_id', 'organization_name', 'application_number', 'certification_level', 'assessment_report_url', 'login_url', 'query_form_link'],
                'recipient_roles' => ['enterprise_admin', 'unit_admin'],
                'has_attachment' => true,
                'is_active' => true,
                'priority' => 10,
            ],

            // 7. Certificate Expiring (renewal reminder)
            // Blade: resources/views/emails/certificate/certificate-expiring.blade.php
            [
                'slug' => 'certificate-expiring',
                'name' => 'Certificate Expiring - Renewal Reminder',
                'description' => 'Staged pre-expiry reminder prompting the enterprise admin to renew the certificate',
                'event' => 'certificate.expiring',
                'category' => 'certificate',
                'subject' => 'Certificate Renewal Reminder under SAMAR Scheme – {{certificate_number}}',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['organization_name', 'application_number', 'certificate_number', 'expiry_date', 'days_remaining', 'reminder_stage', 'login_url'],
                'recipient_roles' => ['enterprise_admin'],
                'is_active' => true,
                'priority' => 9,
            ],

            // 7b. Recertification Window Open (fires once when the renewal window opens)
            // Blade: resources/views/emails/certificate/recertification-window-open.blade.php
            [
                'slug' => 'recertification-window-open',
                'name' => 'Recertification Window Open',
                'description' => 'Sent once when a certified application\'s recertification window opens, prompting the enterprise/unit admin to begin renewal',
                'event' => 'certificate.recertification-window-open',
                'category' => 'certificate',
                'subject' => 'Recertification Window Open under SAMAR Scheme – {{certificate_number}}',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['organization_name', 'application_number', 'certificate_number', 'expiry_date', 'login_url'],
                'recipient_roles' => ['enterprise_admin', 'unit_admin'],
                'is_active' => true,
                'priority' => 9,
            ],

            // 7c. Recertification Monthly Reminder (recurs monthly while the window is open)
            // Blade: resources/views/emails/certificate/recert-monthly-reminder.blade.php
            [
                'slug' => 'recert-monthly-reminder',
                'name' => 'Recertification Monthly Reminder',
                'description' => 'Sent once per calendar month while a certified application\'s recertification window is open, until a renewal is started',
                'event' => 'certificate.recert-monthly-reminder',
                'category' => 'certificate',
                'subject' => 'Recertification Reminder under SAMAR Scheme – {{certificate_number}}',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['organization_name', 'application_number', 'certificate_number', 'expiry_date', 'login_url'],
                'recipient_roles' => ['enterprise_admin', 'unit_admin'],
                'is_active' => true,
                'priority' => 9,
            ],

            // 8. Password Reset
            // Blade: resources/views/emails/security/password-reset.blade.php
            [
                'slug' => 'password-reset',
                'name' => 'Password Reset',
                'description' => 'Sent when user requests password reset with 6-digit OTP',
                'event' => 'user.password_reset_requested',
                'category' => 'security',
                'subject' => 'Password Reset OTP - SAMAR Portal',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['user_name', 'user_email', 'reset_token', 'otp_code', 'otp_expires_in'],
                'recipient_roles' => null,
                'is_active' => true,
                'priority' => 9,
            ],

            // 9. OTP Verification (Registration)
            // Blade: resources/views/emails/security/otp-verification.blade.php
            [
                'slug' => 'otp-verification',
                'name' => 'OTP Verification for Registration',
                'description' => 'Sent for OTP code delivery during registration',
                'event' => 'user.otp_requested',
                'category' => 'security',
                'subject' => 'OTP Verification for Registration under SAMAR Scheme of DRDO',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['user_name', 'otp_code', 'otp_expires_in'],
                'recipient_roles' => null,
                'is_active' => true,
                'priority' => 10,
            ],

            // 10. User Created (Welcome)
            // Blade: resources/views/emails/system/user-created.blade.php
            [
                'slug' => 'user-created',
                'name' => 'User Account Created',
                'description' => 'Welcome email sent when new user account is created',
                'event' => 'user.created',
                'category' => 'system',
                'subject' => 'Welcome to SAMAR Portal',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['user_name', 'user_email', 'organization_name'],
                'recipient_roles' => null,
                'is_active' => true,
                'priority' => 5,
            ],

            // 11. User Invitation (Admin-Created)
            // Blade: resources/views/emails/system/user-invitation.blade.php
            [
                'slug' => 'user-invitation',
                'name' => 'User Invitation (Admin-Created)',
                'description' => 'Sent when an admin creates a new user account with login credentials',
                'event' => 'user.invitation',
                'category' => 'system',
                'subject' => 'Welcome to SAMAR Portal - Your Account Has Been Created',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => [
                    'user_name',
                    'user_email',
                    'password',
                    'organization_name',
                    'created_by_name',
                    'assigned_roles',
                    'portal_url',
                ],
                'recipient_roles' => null,
                'is_active' => true,
                'priority' => 9,
            ],

            // 11b. Assessor Invitation
            // Blade: resources/views/emails/system/assessor-invitation.blade.php
            [
                'slug' => 'assessor-invitation',
                'name' => 'Assessor ID Creation',
                'description' => 'Sent when an admin creates a new assessor account with login credentials',
                'event' => 'assessor.invitation',
                'category' => 'system',
                'subject' => 'Assessor Login Details for SAMAR Scheme – {{assessor_id}}',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => [
                    'user_name',
                    'assessor_id',
                    'password',
                    'login_url',
                    'query_form_url',
                ],
                'recipient_roles' => ['assessor'],
                'is_active' => true,
                'priority' => 9,
            ],

            // 14. Registration Successful
            // Blade: resources/views/emails/security/registration-successful.blade.php
            [
                'slug' => 'registration-successful',
                'name' => 'Registration Successful',
                'description' => 'Sent after OTP verification with login credentials',
                'event' => 'user.registration_verified',
                'category' => 'security',
                'subject' => 'Registration Details for SAMAR Scheme – {{samar_id}}',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['user_name', 'samar_id', 'organization_name', 'password', 'login_url'],
                'recipient_roles' => null,
                'is_active' => true,
                'priority' => 10,
            ],

            // 15. Login OTP Verification
            // Blade: resources/views/emails/security/login-otp-verification.blade.php
            [
                'slug' => 'login-otp-verification',
                'name' => 'Login OTP Verification',
                'description' => 'Sent when user logs in to verify their identity with 2FA OTP',
                'event' => 'user.login_otp_requested',
                'category' => 'security',
                'subject' => 'Login OTP Verification - SAMAR Portal',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['user_name', 'otp_code', 'otp_expires_in', 'device_type', 'device_name', 'ip_address'],
                'recipient_roles' => null,
                'is_active' => true,
                'priority' => 10,
            ],

            // 16. DRDO Rejection
            // Blade: resources/views/emails/application/application-rejected.blade.php
            [
                'slug' => 'application-rejected',
                'name' => 'Application Rejected by DRDO',
                'description' => 'Sent when DRDO rejects an application during review',
                'event' => 'application.drdo_rejected',
                'category' => 'application',
                'subject' => 'Status of Application under SAMAR Scheme of DRDO - {{application_number}}',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['user_name', 'applicant_name', 'application_number', 'rejection_remarks', 'organization_name', 'portal_url'],
                'recipient_roles' => ['enterprise_admin', 'unit_admin'],
                'is_active' => true,
                'priority' => 9,
            ],

            // 17. DRDO Approval
            // Blade: resources/views/emails/application/drdo-approved.blade.php
            [
                'slug' => 'drdo-approved',
                'name' => 'Application Approved by DRDO',
                'description' => 'Sent when DRDO approves an application during review',
                'event' => 'application.drdo_approved',
                'category' => 'application',
                'subject' => 'Approval of Application under SAMAR Scheme of DRDO - {{application_number}}',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['user_name', 'applicant_name', 'application_number', 'organization_name', 'portal_url'],
                'recipient_roles' => ['enterprise_admin', 'unit_admin'],
                'is_active' => true,
                'priority' => 9,
            ],

            // 18. Application Received
            // Blade: resources/views/emails/application/application-received.blade.php
            [
                'slug' => 'application-received',
                'name' => 'Application Received',
                'description' => 'Sent when an application is received for review',
                'event' => 'application.received',
                'category' => 'application',
                'subject' => 'Application Received - {{application_number}}',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['user_name', 'applicant_name', 'application_number', 'organization_name'],
                'recipient_roles' => ['enterprise_admin', 'unit_admin'],
                'is_active' => true,
                'priority' => 5,
            ],

            // 19. Contact Person Authorized (Unit Admin)
            // Blade: resources/views/emails/application/contact-person-authorized.blade.php
            [
                'slug' => 'contact-person-authorized',
                'name' => 'Contact Person Authorized',
                'description' => 'Sent when a contact person/unit admin is created for an application',
                'event' => 'application.contact_person_authorized',
                'category' => 'application',
                'subject' => 'Authorization to Handle SAMAR Scheme Application: {{application_number}}',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['user_name', 'samar_id', 'organization_name', 'application_number', 'password', 'login_url'],
                'recipient_roles' => ['unit_admin'],
                'is_active' => true,
                'priority' => 9,
            ],

            // 19b. Spoke Changed (Unit Admin handover)
            // Blade: resources/views/emails/application/spoke-changed.blade.php
            [
                'slug' => 'spoke-changed',
                'name' => 'Spoke Changed',
                'description' => 'Sent to the new spoke when an Enterprise Admin changes the Unit Admin for a unit',
                'event' => 'unit.spoke_changed',
                'category' => 'application',
                'subject' => 'You have been assigned as the SAMAR Scheme spoke for {{unit_name}}',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['user_name', 'samar_id', 'organization_name', 'unit_name', 'password', 'login_url'],
                'recipient_roles' => ['unit_admin'],
                'is_active' => true,
                'priority' => 9,
            ],

            // 20. Assessor Assigned
            // Blade: resources/views/emails/assessment/assessor-assigned.blade.php
            [
                'slug' => 'assessor-assigned',
                'name' => 'Assessor Assigned',
                'description' => 'Sent when an assessor is assigned to an application',
                'event' => 'assessment.assessor_assigned',
                'category' => 'assessment',
                'subject' => 'Allocation of {{assessment_mode}} under SAMAR Scheme – {{application_number}}',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['user_name', 'assessor_name', 'application_number', 'organization_name', 'unit_address', 'assessment_date_range', 'assessment_mode', 'meeting_link', 'assessor_id', 'assessor_password', 'login_url', 'mobile_app_url'],
                'recipient_roles' => ['assessor'],
                'is_active' => true,
                'priority' => 8,
            ],

            // 20. Co-Assessor Assigned
            // Blade: resources/views/emails/assessment/co-assessor-assigned.blade.php
            [
                'slug' => 'co-assessor-assigned',
                'name' => 'Co-Assessor Assigned',
                'description' => 'Sent when a co-assessor is assigned to an application',
                'event' => 'assessment.co_assessor_assigned',
                'category' => 'assessment',
                'subject' => 'Allocation of {{assessment_mode}} under SAMAR Scheme – {{application_number}}',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['user_name', 'assessor_name', 'application_number', 'organization_name', 'unit_address', 'assessment_date_range', 'assessment_mode', 'meeting_link', 'assessor_id', 'assessor_password', 'login_url', 'mobile_app_url'],
                'recipient_roles' => ['assessor'],
                'is_active' => true,
                'priority' => 8,
            ],

            // 21c. RC Clarification Sought (Rating Committee → Assessor)
            // Blade: resources/views/emails/assessment/rc-clarification-sought.blade.php
            [
                'slug' => 'rc-clarification-sought',
                'name' => 'Clarification Sought by Rating Committee',
                'description' => 'Sent to assessor when Rating Committee reverts assessment for clarification',
                'event' => 'assessment.rc_clarification_sought',
                'category' => 'assessment',
                'subject' => 'Assessment Reverted for Clarification – SAMAR Scheme – {{samar_id}}',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['user_name', 'assessor_name', 'application_number', 'samar_id', 'assessor_id', 'password', 'login_url', 'query_form_link'],
                'recipient_roles' => ['assessor'],
                'is_active' => true,
                'priority' => 8,
            ],

            // 21d. Assessor Clarification Submitted — RC scenario (Assessor → Operations Admin)
            // Blade: resources/views/emails/assessment/assessor-clarification-submitted.blade.php
            [
                'slug' => 'assessor-clarification-submitted',
                'name' => 'Clarification Submitted by Assessor (RC)',
                'description' => 'Sent to operations admin when assessor submits clarification requested by Rating Committee',
                'event' => 'assessment.assessor_clarification_submitted',
                'category' => 'assessment',
                'subject' => 'Submission of Clarification by Assessor – SAMAR Scheme – {{samar_id}}',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['user_name', 'application_number', 'organization_name', 'assessor_name', 'clarification_submission_date', 'samar_id'],
                'recipient_roles' => ['operations_admin'],
                'is_active' => true,
                'priority' => 7,
            ],

            // 21e. QC Clarification Sought (QC → Assessor)
            // Blade: resources/views/emails/assessment/qc-clarification-sought.blade.php
            [
                'slug' => 'qc-clarification-sought',
                'name' => 'Clarification Sought by QC',
                'description' => 'Sent to assessor when QC reverts the assessment for clarification',
                'event' => 'assessment.qc_clarification_sought',
                'category' => 'assessment',
                'subject' => 'Assessment Reverted for Clarification – SAMAR Scheme – {{samar_id}}',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['user_name', 'assessor_name', 'application_number', 'samar_id', 'login_url', 'query_form_link'],
                'recipient_roles' => ['assessor'],
                'is_active' => true,
                'priority' => 8,
            ],

            // 21f. QC Clarification Submitted (Assessor → Operations Manager)
            // Blade: resources/views/emails/assessment/qc-clarification-submitted.blade.php
            [
                'slug' => 'qc-clarification-submitted',
                'name' => 'Clarification Submitted by Assessor (QC)',
                'description' => 'Sent to operations manager when assessor resubmits after QC reverted the assessment',
                'event' => 'assessment.qc_clarification_submitted',
                'category' => 'assessment',
                'subject' => 'Submission of Clarification by Assessor – SAMAR Scheme – {{samar_id}}',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['user_name', 'application_number', 'organization_name', 'assessor_name', 'clarification_submission_date', 'samar_id'],
                'recipient_roles' => ['operations_manager'],
                'is_active' => true,
                'priority' => 7,
            ],

            // 21e. Assessment Feedback Request (Assessment Completed → Applicant)
            // Blade: resources/views/emails/assessment/assessment-feedback-request.blade.php
            [
                'slug' => 'assessment-feedback-request',
                'name' => 'Feedback Request on Assessment Process',
                'description' => 'Sent to applicant and contact person after onsite assessment is completed, requesting feedback on the assessment process',
                'event' => 'assessment.feedback_request',
                'category' => 'assessment',
                'subject' => 'Feedback Request on Assessment Process under SAMAR Scheme – {{samar_id}}',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['user_name', 'application_number', 'samar_id', 'feedback_link', 'query_form_link'],
                'recipient_roles' => ['enterprise_admin', 'unit_admin'],
                'is_active' => true,
                'priority' => 7,
            ],

            // 22. Committee Created / Onboarding as Rating Committee Member
            // Blade: resources/views/emails/committee/committee-created.blade.php
            [
                'slug' => 'committee-created',
                'name' => 'Onboarding as Rating Committee Member',
                'description' => 'Sent when a member is nominated to the Rating Committee under SAMAR Scheme',
                'event' => 'committee.created',
                'category' => 'committee',
                'subject' => 'Onboarding as Rating Committee Member under SAMAR Scheme',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['query_form_link'],
                'recipient_roles' => null,
                'is_active' => true,
                'priority' => 8,
            ],

            // 23. Meeting Scheduled / Rating Committee Meeting Invitation
            // Blade: resources/views/emails/committee/meeting-scheduled.blade.php
            [
                'slug' => 'meeting-scheduled',
                'name' => 'Rating Committee Meeting Invitation',
                'description' => 'Sent when a rating committee meeting is scheduled with invitation details and attachments',
                'event' => 'committee.meeting_scheduled',
                'category' => 'committee',
                'subject' => 'Rating Committee Meeting Invitation – SAMAR Scheme',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['meeting_date', 'meeting_time', 'meeting_mode', 'meeting_link_or_venue', 'remarks', 'query_form_link'],
                'recipient_roles' => null,
                'has_attachment' => true,
                'is_active' => true,
                'priority' => 8,
            ],

            // 24. Meeting Updated
            // Blade: resources/views/emails/committee/meeting-updated.blade.php
            [
                'slug' => 'meeting-updated',
                'name' => 'Rating Committee Meeting Updated',
                'description' => 'Sent when a rating committee meeting details are updated, with revised invitation details and attachments',
                'event' => 'committee.meeting_updated',
                'category' => 'committee',
                'subject' => 'Updated: Rating Committee Meeting Details – SAMAR Scheme',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['meeting_date', 'meeting_time', 'meeting_mode', 'meeting_link_or_venue', 'remarks', 'query_form_link'],
                'recipient_roles' => null,
                'has_attachment' => true,
                'is_active' => true,
                'priority' => 8,
            ],

            // 25. Meeting Cancelled
            // Blade: resources/views/emails/committee/meeting-cancelled.blade.php
            [
                'slug' => 'meeting-cancelled',
                'name' => 'Rating Committee Meeting Cancelled',
                'description' => 'Sent when a rating committee meeting is cancelled',
                'event' => 'committee.meeting_cancelled',
                'category' => 'committee',
                'subject' => 'Cancellation of Rating Committee Meeting – SAMAR Scheme',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['meeting_date', 'meeting_time', 'remarks'],
                'recipient_roles' => null,
                'is_active' => true,
                'priority' => 8,
            ],

            // 26. Meeting Closed / MoM for Approval
            // Blade: resources/views/emails/committee/meeting-closed.blade.php
            [
                'slug' => 'meeting-closed',
                'name' => 'Minutes of Meeting for Approval',
                'description' => 'Sent when MoM is shared with committee members for approval after the rating committee meeting',
                'event' => 'committee.meeting_closed',
                'category' => 'committee',
                'subject' => 'Minutes of Meeting for Approval – SAMAR Rating Committee Meeting',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['meeting_date', 'remarks', 'query_form_link'],
                'recipient_roles' => null,
                'has_attachment' => true,
                'is_active' => true,
                'priority' => 8,
            ],

            // 27. DRDO Lab ID Creation
            // Blade: resources/views/emails/system/drdo-lab-invitation.blade.php
            [
                'slug' => 'drdo-lab-invitation',
                'name' => 'DRDO Lab ID Creation',
                'description' => 'Sent when a DRDO Lab account is created with login credentials',
                'event' => 'drdo_lab.created',
                'category' => 'system',
                'subject' => 'DRDO Lab Login Details for SAMAR Scheme – {{drdo_lab_id}}',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['drdo_lab_id', 'password', 'login_url', 'query_form_link'],
                'recipient_roles' => ['drdo_lab'],
                'is_active' => true,
                'priority' => 9,
            ],

            // 28. Operations Admin ID Creation
            // Blade: resources/views/emails/system/operations-admin-invitation.blade.php
            [
                'slug' => 'operations-admin-invitation',
                'name' => 'Operations Admin ID Creation',
                'description' => 'Sent when an Operations Admin account is created with login credentials',
                'event' => 'operations_admin.created',
                'category' => 'system',
                'subject' => 'Operations Admin Login Details for SAMAR Scheme – {{operations_admin_id}}',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['operations_admin_id', 'password', 'login_url', 'query_form_link'],
                'recipient_roles' => ['operations_admin'],
                'is_active' => true,
                'priority' => 9,
            ],

            // 29. DRDO Admin ID Creation
            // Blade: resources/views/emails/system/drdo-admin-invitation.blade.php
            [
                'slug' => 'drdo-admin-invitation',
                'name' => 'DRDO Admin ID Creation',
                'description' => 'Sent when a DRDO Admin account is created with login credentials',
                'event' => 'drdo_admin.created',
                'category' => 'system',
                'subject' => 'DRDO Admin Login Details for SAMAR Scheme – {{drdo_admin_id}}',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['drdo_admin_id', 'password', 'login_url', 'query_form_link'],
                'recipient_roles' => ['drdo_admin'],
                'is_active' => true,
                'priority' => 9,
            ],

            // 30. Operations Manager ID Creation
            // Blade: resources/views/emails/system/operations-manager-invitation.blade.php
            [
                'slug' => 'operations-manager-invitation',
                'name' => 'Operations Manager ID Creation',
                'description' => 'Sent when an Operations Manager account is created with login credentials',
                'event' => 'operations_manager.created',
                'category' => 'system',
                'subject' => 'Operations Manager Login Details for SAMAR Scheme – {{operations_manager_id}}',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['operations_manager_id', 'password', 'login_url'],
                'recipient_roles' => ['operations_manager'],
                'is_active' => true,
                'priority' => 9,
            ],

            // 31. Password Reset Confirmation
            // Blade: resources/views/emails/security/password-reset-confirmation.blade.php
            [
                'slug' => 'password-reset-confirmation',
                'name' => 'Password Reset Confirmation',
                'description' => 'Sent after a user successfully resets their password',
                'event' => 'user.password_reset_completed',
                'category' => 'security',
                'subject' => 'Password Changed Successfully - SAMAR Portal',
                'bcc' => ['samar.admin@qcin.org'],
                'variables' => ['user_name', 'changed_at', 'ip_address'],
                'recipient_roles' => null,
                'is_active' => true,
                'priority' => 9,
            ],
        ];

        foreach ($templates as $template) {
            EmailNotificationTemplate::updateOrCreate(
                ['slug' => $template['slug']],
                $template
            );
        }

        $this->command->info('Email notification templates seeded successfully! Total: '.count($templates));
        $this->command->info('Email content is handled by Blade templates in resources/views/emails/');
    }
}
