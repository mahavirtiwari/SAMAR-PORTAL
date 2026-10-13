---
title: "Audit Trail — Missing Actor Attribution (blank user on activity log rows)"
category: "features"
tags: ["audit", "issue", "attribution", "cli", "compliance"]
related:
  - 29-audit-trail.md
  - ../10-architecture/13-state-machines.md
code_files:
  - app/Traits/HasAuditLog.php
  - app/Models/AuditLog.php
  - app/Traits/TracksUserActions.php
  - app/Services/StateMachine/ApplicationStateMachine.php
  - scripts/manual-payment-complete.php
last_updated: "2026-07-21"
version: "1.0"
status: "open — fix not yet applied"
---

# Audit Trail — Missing Actor Attribution

**Location**: `docs/20-features/audit-trail-missing-actor-attribution.md`
**Related**: [Audit Trail](29-audit-trail.md) · [State Machines](../10-architecture/13-state-machines.md)
**Observed**: 21-Jul-2026, System Admin → Activity Log screen (development environment)
**Status**: Open — analysed, fix not yet applied

---

## Summary

Some rows on the Activity Log screen show a blank actor (rendered as `-`) instead of a user name and email. Every one of those rows also shows the IP address `127.0.0.1`; every row with a real public IP has a name.

These rows were **not** produced by a logged-in user. They were produced by a maintenance script executed on the server from the command line (`scripts/manual-payment-complete.php`). In a console context there is no authenticated user and no inbound HTTP request, so `HasAuditLog` writes a null actor and Laravel's `Request::ip()` falls back to the loopback address.

The audit trail has no concept of a **system / operator actor**, so any server-side mutation is recorded as "nobody did this". That is an attribution gap in an audit trail whose stated purpose (see [29-audit-trail.md](29-audit-trail.md#compliance--retention)) includes *"User Attribution: Every action linked to authenticated user"*.

---

## Observed symptoms

From the reported screen (System Admin → Activity Log), 21-Jul-2026 around 04:46 PM:

| Actor | Event | Target | Time | IP |
|---|---|---|---|---|
| `-` | CREATED | Assessment #173 | 04:46 PM | 127.0.0.1 |
| `-` | UPDATED | Application #179 | 04:46 PM | 127.0.0.1 |
| `-` | UPDATED | Application #179 | 04:46 PM | 127.0.0.1 |
| `-` | CREATED | Assessment #172 | 04:46 PM | 127.0.0.1 |
| `-` | UPDATED | Application #212 | 04:46 PM | 127.0.0.1 |
| `-` | UPDATED | Application #212 | 04:46 PM | 127.0.0.1 |
| Naman Lead Twenty Three | UPDATED | Assessment #171 | 04:45 PM | 122.160.165.47 |
| Balakrishnan Iyer | UPDATED | Assessment #171 | 04:43 PM | 122.160.165.47 |

Two independent signals in the same rows:

1. **Actor is blank** — `user_id`, `user_email` are `NULL`; `user_name` is a single space (see [Secondary defects](#secondary-defects)).
2. **IP is `127.0.0.1`** — the action did not arrive over the network.

The description column also reads `" created Assessment #173"` with a leading space, because the description template interpolates the empty user name.

---

## Root cause

### 1. The audit trait reads the actor solely from the auth guard

`app/Traits/HasAuditLog.php:61-93`:

```php
public function logAudit(...): AuditLog
{
    $user = Auth::user();

    return AuditLog::create([
        // ...
        'user_id'        => $user?->id,
        'user_name'      => $user?->first_name.' '.$user?->last_name,
        'user_email'     => $user?->email,
        'user_roles'     => $user?->roles->pluck('slug')->toArray(),
        'ip_address'     => Request::ip(),
        'user_agent'     => Request::userAgent(),
        'request_method' => Request::method(),
        'request_url'    => Request::fullUrl(),
        // ...
    ]);
}
```

The trait boots on `created` / `updated` / `deleted` / `restored` model events (`HasAuditLog.php:15-47`), so it fires for **every** write to an audited model regardless of how that write was initiated — HTTP request, artisan command, tinker session, seeder, or standalone PHP script.

When the write happens outside an HTTP request:

- `Auth::user()` is `null` → actor columns are empty.
- `Request::ip()` returns `127.0.0.1` (Symfony's synthetic console request defaults `REMOTE_ADDR` to loopback).
- `Request::method()` returns `GET` and `Request::fullUrl()` returns the app URL — both meaningless for a CLI write, and both currently stored as if they were real.

There is no fallback actor and no marker distinguishing "unauthenticated" from "not an HTTP request at all".

### 2. The specific writer: `scripts/manual-payment-complete.php`

This standalone script (`scripts/manual-payment-complete.php`) completes a payment manually when the ICICI EazyPay gateway is unavailable. It boots the framework directly:

```php
$app    = require $basePath.'/bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();
```

— i.e. a console context with no session, no guard, no HTTP request.

Inside its transaction (`scripts/manual-payment-complete.php:128-175`) it performs exactly the writes seen in the screenshot:

```php
$primary->update([...]);                              // payment row

$locked = Application::where('id', ...)->lockForUpdate()->first();
$locked->update([                                     // ← Application UPDATED (row 1)
    'payment_amount'       => $totalPaid,
    'payment_status'       => 'success',
    'payment_completed_at' => now(),
]);

if ($locked->status === 'payment_pending' && $totalPaid > 0) {
    $sm = new ApplicationStateMachine($locked);       // ← note: no user passed
    $sm->transition('payment_success');               // ← Application UPDATED (row 2)
}                                                     //   + Assessment CREATED
```

That maps 1:1 onto the observed pattern:

- **Two `updated Application #N` rows per application** — the direct `$locked->update()` plus the status write inside the state-machine transition.
- **One `created Assessment #N` row** — `ApplicationStateMachine::createAssessment()` (`ApplicationStateMachine.php:276-282`) creating the assessment in `allocation_pending`.
- **Timestamps clustered in one minute** — two applications (#179 and #212) processed in the same manual run at 04:46 PM.

### 3. The operator *is* captured — but never reaches the audit log

The script deliberately collects a human operator (`scripts/manual-payment-complete.php:50-64`):

```php
} elseif (str_starts_with($arg, '--operator=')) {
    $operator = substr($arg, strlen('--operator='));
}
// ...
$operator = $operator ?: (getenv('USER') ?: 'unknown');
```

and writes it into an audit block — but only into `payments.webhook_payload` (`:117-137`), never into `audit_logs`:

```php
$auditMeta = [
    'manual_override' => [
        'reason'       => $reason,
        'performed_by' => $operator,
        'performed_at' => now()->toIso8601String(),
        'environment'  => $env,
        'script'       => 'scripts/manual-payment-complete.php',
    ],
];
```

So the accountability information exists in the database, in a place nobody looking at the Activity Log will find.

### 4. The same gap exists in `TracksUserActions`

`app/Traits/TracksUserActions.php:12-37` guards every stamp behind `Auth::check()`:

```php
static::creating(function ($model) {
    if (Auth::check() && ! $model->created_by) {
        $model->created_by = Auth::id();
    }
});
```

and `ApplicationStateMachine::createAssessment()` sets `'created_by' => $this->user?->id` (`ApplicationStateMachine.php:281`) — null here, because the script constructs the state machine without a user.

**Consequence**: Assessments #172 and #173 also carry `created_by = NULL` on the row itself, not just in the audit log. Any UI or report that renders "created by" for those assessments will be blank too.

---

## Blast radius

Models carrying `HasAuditLog` (all affected by the same gap):

`Application`, `Assessment`, `CommitteeMeeting`, `CommitteeMember`, `Document`, `Organization`, `Role`, `Unit`, `User`

Contexts that write to these models with no authenticated user:

| Context | Present today | Produces blank-actor rows |
|---|---|---|
| `scripts/manual-payment-complete.php` | yes | yes — confirmed source of the reported rows |
| `app/Console/Commands/*` (9 commands, e.g. `BackfillUnitAdmins`, `RepairStepProgress`, `DedupeSitePictures`, `RecalculateAssessmentScores`) | yes | yes, whenever they mutate an audited model |
| Scheduled tasks (`routes/console.php:59-65`) | yes | yes if they touch audited models |
| Seeders / `php artisan tinker` | yes | yes |
| Queued jobs | no `app/Jobs/` today | would be, if added |

So this is not a one-off from a single script — it is the default behaviour for every server-side write path in the codebase.

---

## Secondary defects found while analysing

These are separate from the root cause but surface in the same rows.

### D1 — `user_name` stores `" "`, not `NULL`

`app/Traits/HasAuditLog.php:81`:

```php
'user_name' => $user?->first_name.' '.$user?->last_name,
```

The null-safe operator short-circuits each operand to `null`, but the concatenation still runs — producing a **single space string**, not `null`. The column is nullable (`2026_02_07_001003_create_audit_logs_table.php:21`) but never receives `NULL` for unattributed rows.

Impact: `WHERE user_name IS NULL` silently returns zero rows; filters, exports, and reports that test for a missing actor all fail to find these records. Any future backfill has to test `TRIM(user_name) = ''` as well.

### D2 — description renders with a leading space

`app/Models/AuditLog.php:73-83`:

```php
return "{$this->user_name} {$event} {$modelName} #{$this->auditable_id}";
```

With a blank `user_name` this yields `" created Assessment #173"`. Matches the screenshot exactly.

### D3 — misleading HTTP context on console rows

`request_method` is stored as `GET` and `request_url` as the app URL for CLI writes (`HasAuditLog.php:89-90`), because `Request::method()` / `Request::fullUrl()` fall back to synthetic values. The audit row therefore asserts an HTTP request that never happened.

### D4 — full attribute snapshots on every update

`HasAuditLog.php:23-34` passes `$model->getOriginal()` and `$model->getAttributes()` — the model's *entire* attribute set — as `old_values` / `new_values` on every update, while `changed_fields` already carries the delta keys. On wide tables (`applications`, `assessments`) this multiplies `audit_logs` storage substantially and makes diffs harder to read.

### D5 — documentation describes endpoints that do not exist

[29-audit-trail.md](29-audit-trail.md#api-reference) documents `GET /api/audit-logs`, `GET /api/{model}/{id}/audit-logs`, `GET /api/users/{id}/audit-logs`, `GET /api/audit-logs/search`, and audit report endpoints. None of these are registered in `routes/api.php`, and no controller in `app/Http/` reads the `AuditLog` model. The feature doc is aspirational rather than descriptive; whatever endpoint backs the Activity Log screen needs to be identified and the doc corrected.

---

## How to verify

Run against the environment where the rows were observed (development, per the screenshot):

```sql
-- 1. Confirm the blank-actor rows are the CLI-origin ones
SELECT id, auditable_type, auditable_id, event,
       user_id, CONCAT('[', user_name, ']') AS user_name_raw,
       ip_address, request_method, created_at
FROM audit_logs
WHERE created_at BETWEEN '2026-07-21 16:45:00' AND '2026-07-21 16:47:00'
ORDER BY id;

-- 2. Confirm user_name is a space, not NULL (D1)
SELECT COUNT(*) AS null_names,
       SUM(TRIM(user_name) = '') AS blank_names
FROM audit_logs
WHERE user_id IS NULL;

-- 3. Confirm the assessments themselves have no creator (section 4)
SELECT id, application_id, status, created_by, created_at
FROM assessments
WHERE id IN (172, 173);

-- 4. Confirm the operator recorded by the script, for those applications
SELECT id, application_id, status, gateway_payment_id,
       JSON_EXTRACT(webhook_payload, '$.manual_override') AS manual_override
FROM payments
WHERE application_id IN (179, 212)
ORDER BY id DESC;
```

Query 4 is where the human operator's name currently lives — it is the workaround for identifying who performed these specific actions today.

---

## Recommended fix

**Give the audit trail a first-class system-actor concept.** Do not paper over it by logging a real user in from CLI scripts — that would make a server-side override indistinguishable from a UI action and actively corrupt the trail.

### Fix A — actor resolution in `HasAuditLog` (root cause)

In `logAudit()`, when `Auth::user()` is null:

- Detect console context (`app()->runningInConsole()`).
- Stamp `user_name` with an explicit system label (e.g. `System (CLI)`), leave `user_id` / `user_email` `NULL`.
- Record the invoking script/command and the human operator in `metadata` (the column already exists and is cast to `array`).
- Leave `request_method` / `request_url` `NULL` rather than storing synthetic HTTP values (D3).

An overridable static "actor context" that CLI entry points set once (script name + `--operator`) keeps this out of every individual write site.

### Fix B — propagate the operator from the script

`scripts/manual-payment-complete.php` already parses `--operator`. Set the audit actor context from it immediately after bootstrap, before the transaction, so both the `Application` updates and the `Assessment` creation carry it.

### Fix C — secondary defects

- D1: build the name only when `$user` exists; store `NULL` otherwise.
- D2: fall back to `System` (or omit the actor segment) in `AuditLog::getDescription()`.
- D4: store only the changed subset in `old_values` / `new_values`, keyed by `changed_fields`.
- D5: reconcile `29-audit-trail.md` with the routes that actually exist.

### Backfill

Existing blank rows can be corrected from the evidence that already exists: `payments.webhook_payload->$.manual_override.performed_by` identifies the operator for the manual-payment rows, and the timestamps tie the Application/Assessment rows to the same run. A one-off backfill script should set `user_name` and `metadata.manual_override` on those `audit_logs` rows and `assessments.created_by` where it can be established. Audit rows are declared immutable in [29-audit-trail.md](29-audit-trail.md#compliance--retention), so a backfill must be an explicit, approved, logged correction — not a silent update.

---

## Out of scope / open questions

- **Which endpoint and screen render this table?** No audit-log route exists in `routes/api.php`, and no matching screen exists in the local `qci-samar-web` checkout (`src/screens/user/systemAdmin/`). The local frontend checkout may be stale relative to what is deployed on development. This needs confirming before any frontend-side change (e.g. rendering `System` instead of `-`).
- **Should `-` be shown at all?** Once the backend stamps a system actor, the frontend fallback becomes unreachable for new rows, but historic rows will still be blank until backfilled.
- **Retention/immutability policy** — [29-audit-trail.md](29-audit-trail.md#compliance--retention) claims 7-year retention, cold-storage archival and tamper-proof hashing. None of these appear implemented; unrelated to this issue but worth a separate audit.

---

## See Also

- [Audit Trail](29-audit-trail.md) — feature documentation
- [State Machines](../10-architecture/13-state-machines.md) — `ApplicationStateMachine` transition that creates the assessment
- [Payment Processing](26-payment-processing.md) — the gateway path this script substitutes for

**Code References**:

- [`HasAuditLog` trait](../../app/Traits/HasAuditLog.php) — `logAudit()` at line 61
- [`AuditLog` model](../../app/Models/AuditLog.php) — `getDescription()` at line 73
- [`TracksUserActions` trait](../../app/Traits/TracksUserActions.php)
- [`ApplicationStateMachine`](../../app/Services/StateMachine/ApplicationStateMachine.php) — `createAssessment()` at line 262
- [`scripts/manual-payment-complete.php`](../../scripts/manual-payment-complete.php)
- [`create_audit_logs_table` migration](../../database/migrations/2026_02_07_001003_create_audit_logs_table.php)
