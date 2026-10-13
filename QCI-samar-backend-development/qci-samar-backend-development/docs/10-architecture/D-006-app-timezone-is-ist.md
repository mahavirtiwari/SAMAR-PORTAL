---
id: D-006
title: App timezone is Asia/Kolkata, not UTC
status: Accepted (Phase A shipped; Phase B — the config change and data migration this ADR decides — not yet implemented)
date: 2026-05-16
---

# D-006: App timezone is Asia/Kolkata, not UTC

## Context

QCI Samar is an India-only system (defense/aerospace certification under DRDO). The Laravel
`config/app.php:95` currently has `'timezone' => 'UTC'`, the Laravel default for global apps.
Every UTC ↔ IST conversion is a place a bug can hide; one of them surfaced as the
user-reported committee meeting date bug (2026-05-16): users picking "16 May" saw "15 May"
saved, because the frontend `AppDatePicker` serialized the JS `Date` as a UTC ISO string and
the backend `Carbon::parse(...)->format('Y-m-d')` returned the UTC date, which is the prior day
for any IST-evening pick.

The same UTC-as-default-timezone choice also causes a latent boundary-case bug:
`after_or_equal:today` validation evaluates `today()` in UTC, so users creating a meeting
between 00:00 and 05:30 IST get rejected for picking "today" because UTC is still on yesterday's
calendar date. No production incident yet, but it's the same root cause and will surface
eventually.

## Decision

**App timezone is `Asia/Kolkata`. The MySQL connection timezone is `+05:30`.**

Concretely:

1. `config/app.php:95` — `'timezone' => 'Asia/Kolkata'`
2. `config/database.php` — add `'timezone' => '+05:30'` to the `mysql` connection. Causes
   Laravel to `SET time_zone='+05:30'` on every connection, so MySQL `TIMESTAMP` columns
   (which are tz-aware) and `CURRENT_TIMESTAMP` defaults return IST.
3. One-time data migration for the 4 `DATETIME` columns (tz-naive): shift `+05:30`.
   See `database/sql/tz_cutover_to_ist_up.sql`.

Why this specific shape:

- `TIMESTAMP` columns (the vast majority — every `created_at`, `updated_at`, `*_at` field across
  ~80 tables) are stored internally as UTC by MySQL and converted to/from the session timezone
  automatically. Setting connection timezone handles them transparently — no data migration
  needed.
- `DATETIME` columns are tz-naive literal strings. Existing rows were written interpreted as
  UTC. After the cutover, Eloquent reads those literals as IST, which would shift them 5h30m
  into the past. Must be migrated. Scope is only 4 columns: `committee_meetings.scheduled_at`,
  `started_at`, `ended_at`, and `application_assessment_response_evidences.captured_at`.
- Wire-format JSON: Carbon's `->toIso8601String()` emits the offset of the Carbon's current
  timezone. Post-cutover that becomes `+05:30` instead of `Z`. Both `qci-samar-web` (uses native
  Date parsing) and `qci-samar-assessor-mobile` (uses moment) handle both correctly. No
  frontend / mobile changes required for the response path.

## Alternatives considered

**Option A — Frontend-only patch.** Convert date to `YYYY-MM-DD` in the two meeting modals
before submitting. Tiny diff, no DB migration. Rejected as the *long-term* fix: leaves `app.tz`
in UTC for an India-only system, doesn't fix the 14+ other `AppDatePicker` consumers, doesn't
fix the 00:00–05:30 IST validation boundary. Adopted as Phase A (immediate symptom fix) while
this decision plays out as Phase B.

**Option C — Backend per-call IST parse.** Add `Carbon::parse($date, 'Asia/Kolkata')` at every
controller that accepts a date. Rejected — same trap as Option A; every new endpoint silently
regresses; `today()`/`now()`/Eloquent casts are still UTC; doesn't fix the validation boundary.

## Consequences

**Plus**

- `now()`, `today()`, `Carbon::today()`, Eloquent datetime casts, log timestamps — all become
  IST. Single source of truth.
- `after_or_equal:today` and similar relative-date validators evaluate correctly for IST users.
- Server logs read in IST → easier ops correlation.
- New endpoints with date fields can't accidentally reintroduce the timezone-shift bug.

**Minus**

- One-time data migration. Mitigation: scope is only 4 columns, single transaction, ~ms latency
  on small dataset; pre-launch system (Feb 2026 migrations) so few rows. Reversible via
  `tz_cutover_to_ist_down.sql`.
- Existing `created_at`/`updated_at` displayed values shift visually for any user who had bookmarked
  a specific timestamp. None reported; pre-delivery system.
- All future date-comparison logic must assume IST. Documented here and in `architecture/`.
- Server clock independence: the choice does not depend on the underlying OS timezone — Laravel
  applies app.timezone to its Carbon factory regardless. Production server clock can stay UTC.

## Implementation

- **Phase A (already shipped):** `AppDatePicker` emits `YYYY-MM-DD` strings; backend date
  validation tightened from `date` → `date_format:Y-m-d` across 10 fields. Fixes the immediate
  user-reported committee meeting symptom without requiring the data migration.
- **Phase B (planned, scheduled during a maintenance window):** Config changes + data migration.
  See tz-cutover-to-ist runbook (since removed).

## Reversibility

Medium. The data migration is reversible (`tz_cutover_to_ist_down.sql`) but mid-flight rollback
leaves data in mixed-tz interpretation. Treat as planned cutover, not casual deploy.
