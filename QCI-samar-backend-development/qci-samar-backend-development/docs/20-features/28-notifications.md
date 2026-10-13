---
title: "Notification System & Templates"
category: "features"
tags: ["notifications", "email", "templates", "blade"]
related:
  - ../30-api/37-api-reference.md
  - 21-authentication.md
  - 29-audit-trail.md
  - ../40-development/46-email-templates.md
code_files:
  - app/Services/Notification/NotificationService.php
  - app/Services/Email/EmailNotificationService.php
  - app/Models/EmailNotificationTemplate.php
  - app/Models/EmailNotificationEvent.php
  - database/seeders/NotificationTemplateSeeder.php
last_updated: "2025-01-02"
version: "3.0"
---

# Notification System & Templates

**Location**: `docs/20-features/28-notifications.md`
**Related**: [API Reference](../30-api/37-api-reference.md) | [Authentication](21-authentication.md) | [Audit Trail](29-audit-trail.md)

## Overview

The Notification System provides **email-only notification delivery** with seeded, code-managed templates for the QCI SAMAR Certification Portal. Templates are defined in `NotificationTemplateSeeder`; there is no admin UI/API for managing them.

**Supported Channels**: Email notifications only.

## Business Value

- **Email Communication**: Professional email notifications for all system events
- **Template Management**: Centralized templates (seeder-managed, not admin-editable)
- **Variable Substitution**: Dynamic subject lines plus real Blade view bodies
- **Delivery Tracking**: Each send recorded in `notification_events` (sent/failed/skipped)
- **Role-Based Delivery**: Target specific user roles

## Key Features

### 1. Email Notifications

- **HTML Emails**: Rich HTML email templates stored as Blade views
- **Plain Text Alternative**: Automatic plain text version generation
- **Template Variables**: Dynamic content using Blade syntax (`{{ $variable }}`)
- **Attachments**: Support for PDF attachments (certificates, invoices, etc.)
- **Professional Formatting**: Responsive email templates

### 2. Template Management

- **No admin API**: templates are managed via `NotificationTemplateSeeder` and direct DB updates — there is no CRUD controller or route
- **Template Categories**: application, payment, assessment, certificate, security, system, committee
- **Event-Based Triggers**: Templates linked to system events
- **Active/Inactive Status**: `is_active` flag on each template
- **Priority Levels**: Control notification ordering

### 3. Templating

- **Subject line**: stored in the DB, variables substituted via string replace (supports `{{key}}`, `{{ key }}`, `{{$key}}`, `{{ $key }}`), HTML-escaped
- **Email body**: rendered from a real Blade view file (`resources/views/emails/{category}/{slug}.blade.php`, falling back to `resources/views/emails/{slug}.blade.php`) — the body is **not** stored in the database
- **Missing view = no send**: if no matching Blade view exists, the email is not sent and the event is recorded with an error rather than a rendered body

## Default Notification Templates

35 templates are seeded by `NotificationTemplateSeeder` (full list there). A few examples:

| Slug | Event | Category | Description |
|------|-------|----------|-------------|
| `payment-received` | payment.success | payment | Payment confirmation |
| `assessment-scheduled` | assessment.scheduled | assessment | Assessment scheduling notification |
| `qc-feedback-required` | assessment.submitted_for_qc | assessment | QC feedback request to Operations Manager |
| `certificate-issued` | certificate.issued | certificate | Certificate and assessment report issuance |
| `password-reset` | user.password_reset_requested | security | Password reset OTP |
| `login-otp-verification` | user.login_otp_requested | security | 2FA login OTP |
| `user-created` | user.created | system | New user welcome email |
| `drdo-approved` | application.drdo_approved | application | Application approval notification |
| `assessor-assigned` | assessment.assessor_assigned | assessment | Assessor allocation notification |

## User Guide

There is no admin-facing API for managing, previewing, or test-sending templates. Templates are seeded/updated via `NotificationTemplateSeeder` and sent from application code:

```php
// By template slug
app(NotificationService::class)->send($user, 'payment-received', [
    'application_number' => $application->number,
    // ...
]);

// By event name (sends to every active template registered for that event)
app(NotificationService::class)->sendForEvent('certificate.issued', [
    'organization_name' => $organization->name,
    // ...
]);
```

## Template Variables

Every send auto-merges these on top of whatever data the caller passes (`EmailNotificationService::renderEmailTemplate()`):

- `user_name` - Full name of the recipient
- `user_email` - Email address
- `user_first_name` / `user_last_name`
- `user_samar_id` - Recipient's SAMAR ID

All other variables are template-specific — defined per-template in `NotificationTemplateSeeder`'s `variables` array (e.g. `application_number`, `payment_transaction_id`, `otp_code`, `certificate_number`, etc.) and consumed by that template's Blade view.

## Technical Details

### Architecture

**Service Layer**:
- [`NotificationService`](../../app/Services/Notification/NotificationService.php) — thin dispatcher; `send()`/`sendForEvent()` currently only route to the `email` channel (the `channels` option and the "future channels" comment are the only trace of a multi-channel design — sms/push/in-app are not implemented)
- [`EmailNotificationService`](../../app/Services/Email/EmailNotificationService.php) — the actual work: loads the template, renders subject + Blade body, resolves recipients by role, sends via `Mail`, and logs an `EmailNotificationEvent` row per recipient

**No controller**: there is no `NotificationTemplateController` and no notification API routes of any kind.

**Model**: [`EmailNotificationTemplate`](../../app/Models/EmailNotificationTemplate.php) (table `notification_templates`)
- Stores slug, event, category, subject, cc/bcc, variables list, recipient_roles, flags, priority
- Does **not** store email body — body comes from a Blade view file

**Model**: [`EmailNotificationEvent`](../../app/Models/EmailNotificationEvent.php) (table `notification_events`)
- One row per email actually attempted; tracks `status`, `sent_at`/`delivered_at`/`opened_at`/`clicked_at`, `attempts`, `error_message`

**Seeder**: [`NotificationTemplateSeeder`](../../database/seeders/NotificationTemplateSeeder.php)
- 35 templates, `updateOrCreate` by slug

### Templating

**Subject** (stored in DB, simple substitution — not Blade):
```
Application Received - {{application_number}}
```
`EmailNotificationService::replaceVariables()` accepts `{{key}}`, `{{ key }}`, `{{$key}}`, and `{{ $key }}`, HTML-escaping each value.

**Body** (real Blade view, not DB-stored):
```
resources/views/emails/{category}/{slug}.blade.php   (primary)
resources/views/emails/{slug}.blade.php               (fallback)
```
Rendered with standard `view($path, $data)->render()`. If neither path exists, no email is sent — the event is recorded with an empty/skipped body rather than a rendered one.

### Email Delivery

**Mail Configuration**:
```env
MAIL_MAILER=smtp
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USERNAME=your_username
MAIL_PASSWORD=your_password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=noreply@example.com
MAIL_FROM_NAME="QCI SAMAR"
```

**Sending Process** (synchronous — `NotificationMail` does not implement `ShouldQueue`, and delivery is a direct `Mail::send()` call, not `Mail::queue()`):
1. Event triggered (e.g., `certificate.issued`) or a slug is sent directly
2. `EmailNotificationService` loads the active template by slug/event
3. Recipients resolved from `recipient_roles` (`determineRecipientsForEvent()`)
4. Subject + Blade body rendered per recipient
5. Email sent immediately via `Mail::to($user->email)->send(new NotificationMail(...))`
6. Result recorded in `notification_events` (`sent`/`failed`, with `error_message` on failure)

BCC addresses on a template are only applied in the `production` environment.

### Authorization

There is no admin-facing template management surface, so there is no corresponding authorization rule to enforce. Recipient selection for a send is driven entirely by each template's `recipient_roles` array.

## Database Schema

### notification_templates Table

```sql
id                      BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
slug                    VARCHAR(255) UNIQUE NOT NULL
name                    VARCHAR(255) NOT NULL
description             TEXT NULL
event                   VARCHAR(255) NOT NULL
category                VARCHAR(255) NULL
subject                 VARCHAR(255) NULL
cc                      JSON NULL
bcc                     JSON NULL
variables               JSON NULL
variables_description   TEXT NULL
recipient_roles         JSON NULL
send_to_creator         BOOLEAN DEFAULT FALSE
has_attachment          BOOLEAN DEFAULT FALSE
is_active               BOOLEAN DEFAULT TRUE
priority                INT DEFAULT 5
created_by, updated_by  BIGINT UNSIGNED NULL
created_at, updated_at  TIMESTAMP NULL
deleted_at              TIMESTAMP NULL
```

No `body` / `body_text` columns — the email body is a Blade view file, not a database value.

### notification_events Table

```sql
id                              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
email_notification_template_id BIGINT UNSIGNED NULL (FK → notification_templates, null on delete)
event                           VARCHAR(255) NOT NULL
notifiable_type, notifiable_id  polymorphic (nullable, not currently populated by the service)
user_id                         BIGINT UNSIGNED NULL (FK → users, cascade on delete)
recipient_email, recipient_name VARCHAR(255) NULL
sent                            BOOLEAN DEFAULT FALSE
status                          ENUM('pending','queued','sent','delivered','failed','bounced') DEFAULT 'pending'
subject, body                   snapshot of the rendered content actually sent
sent_at, delivered_at, opened_at, clicked_at   TIMESTAMP NULL
error_message                   TEXT NULL
data                            JSON NULL
attempts                        INT DEFAULT 0
last_attempt_at, next_retry_at  TIMESTAMP NULL
priority                        INT DEFAULT 5
created_at, updated_at          TIMESTAMP NULL
```

> Only `pending`, `sent`, and `failed` are ever written by current code (plus a `skipped` value used by `EmailNotificationService`/`recordEventFailure()` that is **not** in the migration's enum). `queued`, `delivered`, and `bounced` exist in the schema but nothing sets them — there's no queue, and no delivery/open/click tracking webhook.

## API Reference

There is no REST API for notifications. `grep -rn "notifications" routes/api.php` returns nothing — no list/create/update/delete/preview/test endpoints exist. Templates are read and written directly via `NotificationTemplateSeeder` / manual DB access; sending happens only from server-side code via `NotificationService`/`EmailNotificationService`.

## Configuration

### Environment Variables

```env
# Email Configuration
MAIL_MAILER=smtp
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USERNAME=your_username
MAIL_PASSWORD=your_password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=noreply@example.com
MAIL_FROM_NAME="QCI SAMAR"
```

## Troubleshooting

### Template Not Rendering / Email Skipped

**Issue**: Event fires but no email is sent, event row has an empty/error body

**Solution**:
- Check a Blade view exists at `resources/views/emails/{category}/{slug}.blade.php` (or the flat `resources/views/emails/{slug}.blade.php` fallback) — a missing view causes the send to be skipped rather than failing loudly
- Check variable names match exactly (case-sensitive)
- Verify the template's `is_active` flag is true

### Email Not Sending

**Issue**: Test email fails

**Solution**:
```bash
# Test mail configuration
php artisan tinker
> Mail::raw('Test', function($msg) { $msg->to('test@example.com')->subject('Test'); });

# Check mail logs
tail -f storage/logs/laravel.log
```

## Code References

**Service**: [`NotificationService`](../../app/Services/Notification/NotificationService.php)
**Email Service**: [`EmailNotificationService`](../../app/Services/Email/EmailNotificationService.php)
**Mailable**: [`NotificationMail`](../../app/Mail/NotificationMail.php)
**Model**: [`EmailNotificationTemplate`](../../app/Models/EmailNotificationTemplate.php)
**Model**: [`EmailNotificationEvent`](../../app/Models/EmailNotificationEvent.php)
**Seeder**: [`NotificationTemplateSeeder`](../../database/seeders/NotificationTemplateSeeder.php)
**Migrations**: [`create_notification_templates_table`](../../database/migrations/2026_02_07_001001_create_notification_templates_table.php), [`create_notification_events_table`](../../database/migrations/2026_02_07_001002_create_notification_events_table.php)

## See Also

**Related Features**:
- [API Reference](../30-api/37-api-reference.md) - Complete API documentation
- [Authentication](21-authentication.md) - JWT authentication
- [Audit Trail](29-audit-trail.md) - Notification audit logging
- [User Management](30-user-management.md) - User role management

