---
title: "Application Workflow"
category: "features"
tags: ["application", "workflow", "certification", "state-machine"]
related:
  - assessment-lifecycle-end-to-end.md
  - ../10-architecture/13-state-machines.md
  - ../30-api/33-application-api.md
code_files:
  - app/Models/Application.php
  - app/Services/StateMachine/ApplicationStateMachine.php
  - app/Http/Controllers/Api/V1/ApplicationController.php
last_updated: "2026-07-21"
version: "2.0"
---

# Application Workflow

**Location**: `docs/20-features/23-application-workflow.md`
**Related**: [Assessment Lifecycle](assessment-lifecycle-end-to-end.md) | [State Machines](../10-architecture/13-state-machines.md) | [Application API](../30-api/33-application-api.md)

## Overview

The **Application Workflow** manages the certification application from creation through DRDO approval and payment, handing off to the Assessment lifecycle for the in-progress → certified/rejected tail.

Authoritative source: [`app/Services/StateMachine/ApplicationStateMachine.php`](../../app/Services/StateMachine/ApplicationStateMachine.php).

---

## Application States

The application state machine has **7 states**:

| State | Label | Editable | Next States |
|-------|-------|----------|-------------|
| `draft` | Draft | Yes | `drdo_approval_pending` (if DRDO approval required) or `payment_pending` (if not) |
| `drdo_approval_pending` | DRDO Approval Pending | No | `payment_pending`, `rejected` |
| `payment_pending` | Payment Pending | No | `payment_completed` (stays `payment_pending` on payment failure) |
| `payment_completed` | Payment Completed | No | `in_progress` |
| `in_progress` | In Progress | No | `certified` |
| `certified` | Certified (final) | No | — |
| `rejected` | Rejected (final) | No | — |

There is **no `withdrawn` state and no withdraw transition** — an application cannot be withdrawn via the API once created.

Whether DRDO approval is required is controlled system-wide by `SystemSetting::isDrdoApprovalRequired()`, not per-application.

The `in_progress` → `certified` transition and the `payment_completed` → `in_progress` transition are **not fired directly by any Application endpoint** — they happen automatically as side effects of the Assessment state machine (`AssessmentStateMachine::syncApplicationToInProgress()` when the assessment is scheduled, and `::syncApplicationToCertified()` when the assessment is certified). See [Assessment Lifecycle](assessment-lifecycle-end-to-end.md) for the full cross-stack flow.

---

## Creating an Application

There is no generic `POST /api/v1/applications` create endpoint. Applications are created as sector-specific drafts:

```http
POST /api/v1/applications/manufacturing/draft
POST /api/v1/applications/services/draft
Authorization: Bearer {token}
```

Each sector draft endpoint validates and stores sector-specific fields on the `Application` model (`mfg_*` / `svc_*` JSON columns) and creates the record in `draft` status.

---

## Submitting Application

```http
POST /api/v1/applications/{id}/submit
Authorization: Bearer {token}
```

**Behavior** ([`ApplicationController::submit`](../../app/Http/Controllers/Api/V1/ApplicationController.php)):
- Requires the application to be in `draft` status.
- Requires application submission to be open (`SystemSetting::isApplicationSubmissionOpen()`).
- Snapshots the current DRDO-approval-required setting onto the application (`is_drdo_approval_required`) so the status stepper stays consistent even if the system setting changes later.
- Transitions to `drdo_approval_pending` (if DRDO approval required) or `payment_pending` (if not).

---

## DRDO Approval

**Performed by**: DRDO Admin

```http
POST /api/v1/applications/{id}/drdo-approve
Content-Type: application/json

{
  "remarks": "Meets DRDO requirements"
}
```

```http
POST /api/v1/applications/{id}/drdo-reject
Content-Type: application/json

{
  "reason": "Insufficient documentation"
}
```

Both require the application to be in `drdo_approval_pending` status. Approve transitions to `payment_pending`; reject transitions to `rejected` (final).

---

## Payment

Payment moves the application from `payment_pending` to `payment_completed`. See [Payment Processing](26-payment-processing.md) for the payment initiation flow. On successful payment, `ApplicationStateMachine` automatically creates the associated `Assessment` record in `allocation_pending` status.

---

## Renewal

**Performed by**: Enterprise Admin

```http
POST /api/v1/applications/{id}/renew
```

Clones a certified application into a fresh prefilled draft for recertification.

---

## Other Application Actions

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| PUT | `/api/v1/applications/{id}/preferred-assessment-date` | Set preferred assessment date | Enterprise Admin, Unit Admin |
| PUT | `/api/v1/applications/{id}/contact-person` | Update contact person | Enterprise Admin, Unit Admin |
| GET | `/api/v1/applications/{id}/files/{field}` | Download an uploaded application file | Owner or Admin |
| GET | `/api/v1/applications/{applicationId}/assessment-summary` | Read-only assessment summary | Enterprise Admin, Unit Admin |

### Application Feedback

A separate feedback sub-resource lets Enterprise/Unit Admins respond to feedback raised on their applications:

```http
GET  /api/v1/applications/feedback-pending
GET  /api/v1/applications/{applicationId}/feedbacks
GET  /api/v1/applications/{applicationId}/feedbacks/form
POST /api/v1/applications/{applicationId}/feedbacks/submit
POST /api/v1/applications/{applicationId}/feedbacks
```

---

## Business Rules

### Edit Permissions

- **Draft**: Editable by creator (Enterprise/Unit Admin)
- **After submission**: Not editable by the organization

### Payment Rules

- Payment required before the assessment can be allocated
- Application `payment_status` mirrors the underlying `Payment` record's status

---

## API Reference

**Base Path**: `/api/v1/applications`

| Method | Endpoint | Description | Role Required |
|--------|----------|-------------|---------------|
| GET | `/` | List applications | Authenticated (scoped) |
| GET | `/export` | Export applications | System Admin |
| POST | `/manufacturing/draft` | Create manufacturing-sector draft | Enterprise Admin, Unit Admin |
| POST | `/services/draft` | Create service-sector draft | Enterprise Admin, Unit Admin |
| GET | `/feedback-pending` | Applications awaiting feedback response | Enterprise Admin, Unit Admin |
| GET | `/{id}` | View application | Owner or Admin |
| GET | `/{id}/files/{field}` | Download application file | Owner or Admin |
| POST | `/{id}/submit` | Submit for review | Owner |
| POST | `/{id}/renew` | Start recertification | Enterprise Admin |
| PUT | `/{id}/preferred-assessment-date` | Set preferred assessment date | Enterprise Admin, Unit Admin |
| PUT | `/{id}/contact-person` | Update contact person | Enterprise Admin, Unit Admin |
| POST | `/{id}/drdo-approve` | DRDO approval | DRDO Admin |
| POST | `/{id}/drdo-reject` | DRDO rejection | DRDO Admin |

For complete API documentation, see [Application API](../30-api/33-application-api.md).

---

## See Also

- [Assessment Lifecycle](assessment-lifecycle-end-to-end.md) - Assessment process details (cross-stack, authoritative)
- [State Machines](../10-architecture/13-state-machines.md) - Workflow state machines
- [Certificate Management](25-certificate-management.md) - Certificate issuance
- [Payment Processing](26-payment-processing.md) - Payment integration
- [Application API](../30-api/33-application-api.md) - Complete API reference

**Code References**:
- [`Application` model](../../app/Models/Application.php)
- [`ApplicationStateMachine`](../../app/Services/StateMachine/ApplicationStateMachine.php)
- [`ApplicationController`](../../app/Http/Controllers/Api/V1/ApplicationController.php)
