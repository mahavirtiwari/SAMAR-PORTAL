---
title: "Certificate API"
category: "api"
tags: ["api", "certificates", "verification"]
related:
  - ../20-features/25-certificate-management.md
code_files:
  - app/Http/Controllers/Api/V1/CertificateController.php
last_updated: "2026-07-22"
version: "1.0"
---

# Certificate API

**Location**: `docs/30-api/35-certificate-api.md`
**Related**: [Certificate Management](../20-features/25-certificate-management.md) - Complete documentation

**Base Path**: `/api/v1/certificates`

---

## Endpoints Reference

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| GET | `/` | List certificates | ✓ | Admin or Owner |
| GET | `/{id}` | View certificate | ✓ | Admin or Owner |
| GET | `/{certificateNumber}/download` | Download PDF | ✓ | Admin or Owner |
| GET\|POST | `/api/v1/verify-certificate` | Verify certificate | - | Public |

---

## Key Examples

### View Certificate

```http
GET /api/v1/certificates/50
Authorization: Bearer {token}
```

### Download Certificate PDF

```http
GET /api/v1/certificates/03012025_030125-11111/download
Authorization: Bearer {token}
```

### Public Verification (No Auth)

```http
GET /api/v1/verify-certificate?certificate_number=03012025_030125-11111
```

For complete examples, see [Certificate Management](../20-features/25-certificate-management.md).

---

## See Also

- [Certificate Management](../20-features/25-certificate-management.md) - Complete documentation

**Code Reference**: [`CertificateController`](../../app/Http/Controllers/Api/V1/CertificateController.php)
