---
title: "Certificate Management"
category: "features"
tags: ["certificate", "issuance", "verification", "qr-code"]
related:
  - 23-application-workflow.md
  - assessment-lifecycle-end-to-end.md
  - ../30-api/35-certificate-api.md
code_files:
  - app/Models/Certificate.php
  - app/Http/Controllers/Api/V1/CertificateController.php
  - app/Services/StateMachine/AssessmentStateMachine.php
last_updated: "2026-07-22"
version: "2.0"
---

# Certificate Management

**Location**: `docs/20-features/25-certificate-management.md`
**Related**: [Application Workflow](23-application-workflow.md) | [Assessment Lifecycle](assessment-lifecycle-end-to-end.md) | [Certificate API](../30-api/35-certificate-api.md)

## Overview

A certificate is created automatically by [`AssessmentStateMachine::createCertificate()`](../../app/Services/StateMachine/AssessmentStateMachine.php) when an assessment transitions to `certified` — there is no manual issuance endpoint. [`CertificateController`](../../app/Http/Controllers/Api/V1/CertificateController.php) exposes exactly four endpoints: list, view, download, and public verification.

### Certificate Statuses

`active`, `expired`, `suspended`, `revoked`, `renewed`.

### Certificate Types

`initial`, `renewal`. Type is determined automatically: if any previous certificate exists for the organization/unit, the new one is `renewal`, otherwise `initial`.

**Note**: the `Certificate` model has fields for suspension and revocation (`suspended_from`, `suspended_until`, `suspension_reason`, `revoked_at`, `revocation_reason`, etc.), but there is currently **no API endpoint that writes them** — no suspend, reinstate, or revoke action exists in `CertificateController`. These states can only be reached by direct data changes today.

---

## Automatic Certificate Issuance

When an assessment is certified (see [Assessment Lifecycle §4.9](assessment-lifecycle-end-to-end.md#49-certified)):

1. A certificate number is generated in the legacy format `DDMMYYYY_{samar_id tail}` (e.g. issue date 03-Jan-2025 + creator SAMAR id `SAMAR-030125-11111` → `03012025_030125-11111`); a `-2`, `-3`, ... suffix is appended if the base number collides on the same day for the same creator.
2. Validity is `SystemSetting::getCertificateValidityYears() * 12` months from today (or, for a renewal, continuing from the previous certificate's `valid_until` with no gap).
3. `scope` is set to `'Service'` or `'Manufacturing'` based on the application's sector.
4. `grade` is computed as `"Level {N}"` where N (1–5) comes from `Assessment::ratingLevelFromScore()` against the assessment's `total_score`:

| Score Range | Level |
|-------------|-------|
| 0.0 – 1.5 | Level 1 |
| >1.5 – 2.5 | Level 2 |
| >2.5 – 3.5 | Level 3 |
| >3.5 – 4.5 | Level 4 |
| >4.5 – 5.0 | Level 5 |

5. On renewal, the predecessor certificate is linked (`renews_certificate_id` / `renewed_by_certificate_id`) and its status set to `renewed`.

An application is never marked `certified` without a certificate row existing — if certificate creation fails, the application is left in its prior state so the failure is visible.

---

## Certificate Structure

```php
class Certificate extends Model
{
    protected $fillable = [
        'application_id', 'organization_id', 'unit_id', 'committee_decision_id',
        'certificate_number', 'qr_code', 'verification_url',
        'certificate_type',      // initial, renewal
        'scheme', 'scope',
        'issue_date', 'valid_from', 'valid_until', 'validity_months',
        'status',                // active, expired, suspended, revoked, renewed
        'suspended_from', 'suspended_until', 'suspension_reason', 'suspended_by',
        'revoked_at', 'revocation_reason', 'revoked_by',
        'renewed_by_certificate_id', 'renews_certificate_id', 'renewal_reminders_sent',
        'final_score', 'grade',
        'certificate_document_id', 'certificate_pdf_path',
        'digital_signature', 'signature_algorithm', 'signatory_name', 'signatory_designation', 'signed_date',
        'issued_by', 'issued_at', 'approved_by', 'approved_at',
        'remarks', 'metadata', 'is_public', 'allow_verification', 'deleted_by',
    ];
}
```

---

## Download Certificate

```http
GET /api/v1/certificates/{certificateNumber}/download
Authorization: Bearer {token}
```

System admins, DRDO admins, Operations Manager, and Operations Admin can download any certificate; Enterprise Admins can only download certificates from their own organization.

---

## Certificate Verification (Public, No Authentication)

```http
GET /api/v1/verify-certificate?certificate_number=03012025_030125-11111
POST /api/v1/verify-certificate
```

GET supports QR-code deep links from certificate PDFs; POST is kept for form/body callers. Both call [`CertificateController::verify`](../../app/Http/Controllers/Api/V1/CertificateController.php).

**Response**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "certificate_number": "03012025_030125-11111",
    "organization_name": "ABC Manufacturing Pvt Ltd",
    "unit_name": "Unit 1",
    "address": "...",
    "district": "...",
    "state": "...",
    "pincode": "...",
    "rating_label": "Level 4",
    "status": "active",
    "valid_from": "2024-01-01",
    "valid_until": "2027-01-01",
    "scope": "Manufacturing"
  }
}
```

A certificate is considered `valid` when `status === 'active'` and today falls within `valid_from`/`valid_until`.

---

## Certificate Listing

```http
GET /api/v1/certificates?status=active&certificateType=initial&q=03012025&perPage=15
```

System admins see all certificates; Enterprise/Unit admins only see certificates belonging to their organization/unit.

---

## Business Rules

### Issuance

- Certificate creation is a side effect of assessment certification, not a standalone action.
- Type (`initial`/`renewal`) is inferred from certificate history, not chosen by the caller.

### Suspension / Revocation

- Schema exists (`status` enum includes `suspended`/`revoked`, plus the supporting reason/date/actor columns) but no API currently exercises it.

---

## API Reference

**Base Path**: `/api/v1/certificates`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | List certificates | Yes |
| GET | `/{id}` | View certificate | Yes (owner/admin) |
| GET | `/{certificateNumber}/download` | Download PDF | Yes (owner/admin) |
| GET/POST | `/api/v1/verify-certificate` | Public verification | No |

For complete API documentation, see [Certificate API](../30-api/35-certificate-api.md).

---

## See Also

- [Application Workflow](23-application-workflow.md) - Application approval process
- [Assessment Lifecycle](assessment-lifecycle-end-to-end.md) - How certification is reached
- [Certificate API](../30-api/35-certificate-api.md) - Complete API reference

**Code References**:
- [`Certificate` model](../../app/Models/Certificate.php)
- [`CertificateController`](../../app/Http/Controllers/Api/V1/CertificateController.php)
- [`AssessmentStateMachine`](../../app/Services/StateMachine/AssessmentStateMachine.php) - certificate creation logic
