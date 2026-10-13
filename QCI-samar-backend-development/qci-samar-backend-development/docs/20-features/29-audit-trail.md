---
title: "Audit Trail & Log Management"
category: "features"
tags: ["audit", "logging", "compliance", "security"]
related:
  - ../10-architecture/14-design-patterns.md
code_files:
  - app/Models/AuditLog.php
  - app/Traits/HasAuditLog.php
  - app/Http/Controllers/Api/V1/AuditLogController.php
  - app/Exceptions/ErrorReporter.php
  - app/Console/Commands/CleanupAuditLogs.php
  - config/audit.php
last_updated: "2026-07-20"
version: "2.0"
---

# Audit Trail & Log Management

**Location**: `docs/20-features/29-audit-trail.md`
**Related**: [Design Patterns - HasAuditLog Trait](../10-architecture/14-design-patterns.md#hasauditlog-trait)

## Overview

The audit/log-management system records significant actions and changes across QCI SAMAR for accountability and support. It has three parts:

1. **Model audit trail** — automatic create/update/delete/restore capture on audited models, written to `audit_logs`.
2. **Security & authentication events** — login, logout, failed logins, lockouts, password changes/resets, and role assignments.
3. **Application error logging** — server (5xx) errors captured to `error_logs` for support (separate subsystem).

> **Known issue**: actions performed outside an HTTP session (artisan commands, maintenance scripts) are recorded with a blank actor and IP `127.0.0.1`. See [Missing Actor Attribution](audit-trail-missing-actor-attribution.md).

> This document describes what is actually implemented. Endpoints or behaviours not listed here (per-model audit endpoints, audit report exports, cryptographic tamper-proofing) do **not** exist.

---

## Automatic Model Auditing

### Using HasAuditLog Trait

```php
use App\Traits\HasAuditLog;

class Application extends Model
{
    use HasAuditLog;
    // Auto-logs created / updated (with old+new values) / deleted / restored
}
```

**Models currently audited**: `User`, `Application`, `Assessment`, `Unit`, `Role`, `Document`, `Organization`, `CommitteeMember`, `CommitteeMeeting`.

Field-level diffs are captured on update (`changed_fields`, `old_values`, `new_values`). `created_by` / `updated_by` / `deleted_by` are stamped separately by the `TracksUserActions` trait.

> **Limitation**: role/permission changes go through the `user_role` pivot, which does **not** fire the User model's Eloquent events. Role grants are therefore logged explicitly (see Security Events) rather than by the trait.

---

## Audit Log Structure

`App\Models\AuditLog` (table `audit_logs`) is **append-only** — `const UPDATED_AT = null`; rows are never updated.

| Group | Columns |
|---|---|
| Subject | `auditable_type`, `auditable_id`, `event`, `custom_event` |
| Actor | `user_id`, `user_name`, `user_email`, `user_roles` |
| Change | `old_values`, `new_values`, `changed_fields` |
| Context | `ip_address`, `user_agent`, `request_method`, `request_url`, `description`, `metadata` |

`event` holds a lifecycle value (`created`/`updated`/`deleted`/`restored`) or the literal `custom`; for custom rows the specific name lives in `custom_event`.

---

## Security & Authentication Events

Written to `audit_logs` as `event='custom'` with these `custom_event` values:

| Event | When | Where |
|---|---|---|
| `login` | Successful login (direct or post-OTP) | `AuthService::login` / `verifyLoginOtp` |
| `logout` | User logs out | `AuthService::logout` |
| `login_failed` | Wrong password for a known SAMAR ID | `AuthService::authenticateByPassword` |
| `account_locked` | A failed attempt trips the lockout | `AuthService::authenticateByPassword` |
| `password_change` | User changes their password | `AuthService::changePassword` |
| `password_reset` | Password reset via OTP | `AuthService::resetPassword` |
| `role_assigned` | A role is granted to a user | `UserService::assignRolesToUser` |

Sensitive fields (`password`, `otp_code`, tokens, …) are redacted before storage by `HasAuditLog::getAuditSensitiveFields()`.

---

## Reading the Trail (System Admin only)

Two endpoints, both restricted by `middleware('role:system_admin')`:

| Method | Endpoint | Returns |
|---|---|---|
| GET | `/api/v1/admin/audit-logs` | **Authentication events only** (`login`, `password_change`, `password_reset`) — powers the legacy Authentication tab |
| GET | `/api/v1/admin/activity-logs` | **Full trail** — data changes + authentication + security events |

### `GET /api/v1/admin/activity-logs`

**Query parameters** (camelCase in, snake_case internally):

- `search` — matches user name or email
- `category` — `all` \| `data` \| `security` \| `authentication`
- `event` — a single effective event name (e.g. `updated`, `login_failed`)
- `entityType` — model short name (e.g. `User`, `Application`, `Assessment`)
- `dateFrom` / `dateTo` — `YYYY-MM-DD`, interpreted as IST calendar days
- `page` / `perPage`

Each row carries a human-readable `action` and `description` alongside `category`, `entityType`, `entityId`, `changedFields`, actor, `ipAddress`, and `createdAt`.

---

## Application Error Logging

Server errors (HTTP 5xx) are captured to the `error_logs` / `error_groups` / `error_log_context_snapshots` tables by `App\Exceptions\ErrorReporter`, wired as a reportable in `bootstrap/app.php` `withExceptions()`. In `production` a critical-error email alert is sent when `logging.error_email_enabled` is set. Client errors (validation, auth, 404) are not persisted. HTTP error responses are rendered by the framework; the reporter only handles capture.

### Non-HTTP failure capture (TASK-05773)

Failures with no HTTP request are captured through the same subsystem via `ErrorReporter::captureException($e, $source, $context, $level?)` → `ErrorLoggerService::logException()`. Each row carries a **`source`** discriminator so the feed is filterable by subsystem, and the request-bound columns are null. Wiring:

- **Failed queue jobs** — a `Queue::failing` listener (`AppServiceProvider`), `source = queue`. BC push jobs are at-most-once and swallow their own throwable, so they capture explicitly at the catch site instead (`source = business_central`).
- **Failed scheduled commands** — a `ScheduledTaskFailed` listener, `source = scheduler` (recertification email, audit/error cleanup, BC sweeps, session reapers).
- **Business Central** — push failures, `bc:sync-results` `Error_Text` responses, and `bc:retry-failed` attempt-ceiling exhaustion, `source = business_central`.
- **Payments** — webhook/callback processing errors, invalid callback signature, and billed-vs-collected amount mismatch (`PaymentWebhookController`), `source = payment`.
- **Email** — `EmailNotificationService` send failures, `source = email`. (There is **no SMS/OTP provider** — OTP is delivered by email, so OTP-send failures surface here.)
- **PDF / storage** — these paths `throw`, so they are captured with the `source` of their calling context (`http` or `queue`); only genuinely swallowed integration failures get explicit capture.

**Minimum severity**: `config('error_logging.min_severity')` (default `error`, env `ERROR_LOG_MIN_SEVERITY`) drops anything below the threshold before it hits the DB. HTTP 500s are always `error`+, so the HTTP path is unchanged. **Secrets** are redacted from request bodies and context using the audit redaction list plus request-body specifics. The read endpoint (`GET /api/v1/admin/error-logs`, `role:system_admin`) filters by `level`/`severity`, `source`, `search`, `status`, `dateFrom`/`dateTo`.

Error-log retention is governed separately by `config/error_logging.php` (two-stage: archive resolved after 90d, delete archived after 365d) + the `error-logs:cleanup` command.

---

## Retention

Audit logs are pruned by age (append-only table → delete-old):

- **Policy**: `config/audit.php` → `retention_days`, default **730 (2 years)**, override via `AUDIT_LOG_RETENTION_DAYS`.
- **Command**: `php artisan audit-logs:cleanup` (`--days=N` to override, `--force` to skip confirmation).
- **Schedule**: weekly, Monday 03:30 (`routes/console.php`).

> There is **no** cryptographic hashing / tamper-proofing and **no** cold-storage archival tier. Integrity rests on the append-only model and DB access controls.

---

## Not Implemented / Out of Scope

- **Super Admin account-impersonation logging** (spec §3.13): **N/A** — QCI SAMAR has no impersonation ("act as user") feature and no "Super Admin" role (the top role is **System Admin**). There is nothing to log; recorded as not-applicable per stakeholder decision. If impersonation is ever added, `logAudit()` records a single actor only, so the schema would need a dual-identity extension (impersonator vs impersonated).
- **HTTP request/response access logging** and **performance/slow-query logging** — intentionally not built (developer-observability with no admin-facing value for this product).
- Per-model audit endpoints, audit report/PDF exports, and full-text search — not implemented.

---

## See Also

- [Missing Actor Attribution](audit-trail-missing-actor-attribution.md) - Open issue: blank user on CLI-originated rows
- [Design Patterns - HasAuditLog](../10-architecture/14-design-patterns.md#hasauditlog-trait) - Trait implementation
- [Authorization & RBAC](22-authorization-rbac.md) - Access control

**Code References**:
- [`AuditLog` model](../../app/Models/AuditLog.php)
- [`HasAuditLog` trait](../../app/Traits/HasAuditLog.php)
- [`AuditLogController`](../../app/Http/Controllers/Api/V1/AuditLogController.php)
- [`ErrorReporter`](../../app/Exceptions/ErrorReporter.php)
- [`CleanupAuditLogs` command](../../app/Console/Commands/CleanupAuditLogs.php)
