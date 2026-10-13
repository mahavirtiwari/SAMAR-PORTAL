---
title: "Authentication"
category: "features"
tags: ["authentication", "jwt", "otp", "2fa", "sessions"]
related:
  - 22-authorization-rbac.md
  - 25-token-validation.md
  - ../30-api/32-authentication-api.md
code_files:
  - app/Http/Controllers/Api/V1/Auth/LoginController.php
  - app/Http/Controllers/Api/V1/Auth/RegisterController.php
  - app/Http/Controllers/Api/V1/Auth/PasswordController.php
  - app/Http/Controllers/Api/V1/Auth/TwoFactorController.php
  - app/Services/Auth/AuthService.php
  - config/jwt.php
  - config/auth.php
last_updated: "2026-07-22"
version: "2.0"
---

# Authentication

**Location**: `docs/20-features/21-authentication.md`
**Related**: [Authorization & RBAC](22-authorization-rbac.md) | [Token Validation](25-token-validation.md) | [Authentication API](../30-api/32-authentication-api.md)

## Overview

Login identifies the user by **`samar_id`** (format `SAMAR-DDMMYY-N`, e.g. `SAMAR-040226-1`), never email or username. Two-factor authentication (email OTP) is **opt-in per user**, not a fleet-wide mandatory step — a user with 2FA disabled logs in with a single `samar_id` + password call; a user with it enabled goes through an extra OTP-verification step. All logic lives in `AuthService` (`app/Services/Auth/AuthService.php`).

## Registration

**Endpoint**: `POST /api/v1/auth/register`

**Request fields**: `organization_name` (required, max 255), `first_name` (required, max 50), `last_name` (required, max 50), `email` (required), `mobile_number` (optional, 10 digits). There is **no password field** — the client never supplies one.

**What happens**:
1. An `Organization` (`status: pending_details`) and a `User` (`status: pending_verification`) are created together; the user gets the `enterprise_admin` role.
2. A throwaway password is generated server-side and stored, but it's never sent anywhere.
3. A 6-digit OTP is generated and emailed (`otp-verification` template).
4. Response is `{ "samar_id": "...", "is_resend": false }` — that's it. The user's actual working credential doesn't exist yet.

Duplicate emails are allowed: re-registering with the same email always creates a **new** `Organization` + `User` (identity is the unique `samar_id`, not email) and issues a fresh OTP for that new account — it does **not** resend an OTP for a prior pending account. `AuthService::register()` has no email-lookup or resend branch and hard-codes the response `is_resend` flag to `false`. (Deliberately resending an OTP for an existing pending account is the separate `POST /api/v1/auth/resend-otp` endpoint.)

**Verify OTP** — `POST /api/v1/auth/verify-otp` (`samar_id`, 6-digit `otp`). On success:
- A **new** password is generated (the original from step 2 is unrecoverable since only its hash was kept) and emailed via the `registration-successful` template along with `samar_id` and `login_url`.
- The user transitions to active status.

**Resend OTP** — `POST /api/v1/auth/resend-otp` (`samar_id`).

## Login (samar_id + password, optional 2FA step)

**Endpoint**: `POST /api/v1/auth/login`

**Request**: `samar_id` (validated against `^SAMAR-\d{6}-\d+$`), `password`, optional `device_type` (`web|tablet|mobile|ios|android`), `device_name`, `device_id`.

Credential check (`AuthService::authenticateByPassword()`) is shared with `check-active-session` below, so failed attempts on either endpoint feed the same lockout counter.

**Branch 1 — 2FA disabled** (`User.is_two_factor_enabled = false`, the common case): tokens are issued immediately.
```json
{
  "user": { "...": "..." },
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "Bearer",
  "access_token_expiration": "2026-07-21T...",
  "refresh_token_expiration": "2026-07-21T...",
  "requires_otp": false
}
```

**Branch 2 — 2FA enabled**: no tokens yet. A `PendingLoginSession` is created, a 6-digit OTP is emailed (`login-otp-verification` template), and the response is:
```json
{
  "session_token": "...",
  "otp_expires_in": "2 minutes",
  "requires_otp": true
}
```
The client then calls `verify-login-otp` with that `session_token` + the OTP to receive tokens (same shape as Branch 1, without `requires_otp`).

**Check active session** — `POST /api/v1/auth/check-active-session` (`samar_id`, `password`, optional `device_type`) — verifies credentials (feeding the same lockout) and reports whether the account already has a live session on **another device of the same class** (see [Session scoping](#session-scoping) below), so a client can warn the user before continuing. Issues no tokens.

**Verify login OTP** — `POST /api/v1/auth/verify-login-otp` (`session_token`, `otp`). Failure responses report remaining attempts; 5 wrong attempts locks the pending session for 30 minutes independent of the account-lockout counter below.

**Resend login OTP** — `POST /api/v1/auth/resend-login-otp` (`session_token`) — capped at 3 resends per pending session.

## Password Policy

`AuthService::validatePasswordStrength()` enforces **only a 7-character minimum**. Uppercase/lowercase/digit/special-character checks exist in the source as commented-out code and are **not enforced** — this is a deliberate simplification, not a bug.

## Account Lockout

Two independent lockout mechanisms, both configured in `config/auth.php`:

| Mechanism | Trigger | Duration | Where |
|---|---|---|---|
| **Login lockout** | Wrong password, `auth.lockout.max_attempts` times (default **10**) | `auth.lockout.duration_minutes` (default **30 min**) | `User::recordFailedLogin()` / `isLocked()`, checked in `authenticateByPassword()` |
| **OTP lockout** | Wrong OTP, 5 times (login-OTP or password-reset OTP) | 30 minutes | `PendingLoginSession` (login OTP) / `User.otp_locked_until` (reset OTP) |

`LOGIN_LOCKOUT_ENABLED` is the master switch for the first (defaults to enabled). Both are logged to the audit trail (`login_failed`, `account_locked` — see [Audit Trail](29-audit-trail.md)).

## Two-Factor Authentication (opt-in, per user)

2FA is a **user-level toggle** (`User.is_two_factor_enabled`), not a system-wide requirement:

- `GET /api/v1/auth/2fa-status` — `{ "is_two_factor_enabled": bool }`
- `POST /api/v1/auth/2fa/enable` — no body required
- `POST /api/v1/auth/2fa/disable` — requires `current_password`

Enabling/disabling sends a notification email (`2fa-enabled`/`2fa-disabled` templates — note these two slugs are **not** present in `NotificationTemplateSeeder`, so those specific emails currently fail silently; see [Notifications](28-notifications.md)).

## Session Scoping

Single-session enforcement is **not** limited to a few admin roles — per `RoleSeeder`, **every role has `enforce_single_session = true` except `erp_integration`**. Enforcement is gated by the `auth.single_session.enabled` master switch.

Enforcement is **device-class scoped**, not global:
- **mobile class** = `device_type` of `ios` or `android` (native app installs)
- **web class** = everything else (`web`, `tablet`, or the literal string `mobile` used for a mobile *browser*)

A new login only terminates other **same-class** sessions — one web session and one mobile-app session can be active simultaneously for the same user. Web sessions additionally idle-time-out after `auth.session.idle_timeout_minutes` (default **60 minutes**) of no `access` token activity, enforced two ways:

- **On token refresh** — checked synchronously in the refresh path. This check is web-class only, so mobile sessions are exempt here (offline field assessment work can go hours without a request).
- **By a scheduled sweep** — an `everyFifteenMinutes` job (`routes/console.php`) marks any `access` session whose `COALESCE(last_activity_at, started_at)` is older than the idle threshold as `is_active = false` with `termination_reason = 'timeout'`. The sweep is scoped to `access` rows and **exempts `erp_integration` machine accounts** (their unattended ERP document sync can sit idle far longer than the human threshold).

## Token Lifecycle

- **Access token TTL**: 15 minutes (`config/jwt.php` `ttl`, OWASP-recommended default)
- **Refresh token TTL**: 120 minutes / 2 hours (`config/jwt.php` `refresh_ttl`)
- **Refresh** (`POST /api/v1/auth/refresh`): rotates the refresh token, re-checks organization-active status and (for web sessions) idle timeout, and issues a new access+refresh pair.
- **Logout** (`POST /api/v1/auth/logout`): terminates all of the user's sessions first, then best-effort blacklists the current JWT (a failure here is not fatal — the session is already gone).

See [Token Validation](25-token-validation.md) for the full token/session mechanics.

## Password Reset (OTP-based, not a link)

There is no emailed reset **link** — reset is OTP-based, identical in shape to login OTP:

1. `POST /api/v1/auth/forgot-password` (`samar_id`) — sends a 6-digit OTP (`password-reset` template), valid for `auth.otp.expiry_minutes` (2 minutes).
2. `POST /api/v1/auth/resend-password-otp` (`samar_id`) — separate resend rate limit from step 1.
3. `POST /api/v1/auth/reset-password` (`samar_id`, `otp`, `password`, `password_confirmation`) — 5 wrong OTP attempts locks for 30 minutes (`User.otp_locked_until`). On success, **all of the user's sessions are terminated** and a confirmation email is sent.

## Change Password (authenticated)

`POST /api/v1/auth/change-password` — `current_password`, `new_password` (min 7, confirmed). Does not terminate other sessions.

## Get Current User

`GET /api/v1/auth/me` — returns `samar_id`, name, email, mobile, designation, district, state, organization, active roles, `is_profile_completed`, `assigned_states`. No `permissions` array (see [Authorization & RBAC](22-authorization-rbac.md) — there is no separate permission model).

## Code References

**Controllers**: [`LoginController`](../../app/Http/Controllers/Api/V1/Auth/LoginController.php), [`RegisterController`](../../app/Http/Controllers/Api/V1/Auth/RegisterController.php), [`PasswordController`](../../app/Http/Controllers/Api/V1/Auth/PasswordController.php), [`TwoFactorController`](../../app/Http/Controllers/Api/V1/Auth/TwoFactorController.php)
**Service**: [`AuthService`](../../app/Services/Auth/AuthService.php)
**Config**: [`config/jwt.php`](../../config/jwt.php), [`config/auth.php`](../../config/auth.php)

## See Also

- [Authorization & RBAC](22-authorization-rbac.md) — roles, session enforcement source, policies
- [Token Validation](25-token-validation.md) — JWT/session mechanics in detail
- [Audit Trail](29-audit-trail.md) — login/logout/lockout events
