---
title: "Application API"
category: "api"
tags: ["api", "applications", "endpoints"]
related:
  - ../20-features/23-application-workflow.md
code_files:
  - app/Http/Controllers/Api/V1/ApplicationController.php
last_updated: "2025-01-05"
version: "1.0"
---

# Application API

**Location**: `docs/30-api/33-application-api.md`
**Related**: [Application Workflow](../20-features/23-application-workflow.md) - Complete workflow documentation

**Base Path**: `/api/v1/applications`

---

## Endpoints Reference

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| GET | `/` | List applications | ✓ | Enterprise Admin+ |
| GET | `/{id}` | View application | ✓ | Owner or Admin |
| POST | `/{id}/submit` | Submit for review | ✓ | Owner |

Authoritative source for the full endpoint set (draft creation, renewal, DRDO approval, feedback, assessment summary, etc.): `routes/api.php`.

---

## Key Examples

### Submit Application

```http
POST /api/v1/applications/101/submit
Authorization: Bearer {token}
```

For complete examples and workflow details, see [Application Workflow](../20-features/23-application-workflow.md).

---

## Response Structures

**See Feature Documentation**: [Application Workflow](../20-features/23-application-workflow.md) contains all request/response examples.

---

## See Also

- [Application Workflow](../20-features/23-application-workflow.md) - Complete workflow with examples
- [State Machines](../10-architecture/13-state-machines.md) - Application states

**Code Reference**: [`ApplicationController`](../../app/Http/Controllers/Api/V1/ApplicationController.php)
