---
title: "Dashboards"
category: "features"
tags: ["dashboards", "analytics"]
related:
  - ../10-architecture/14-design-patterns.md
code_files:
  - app/Services/DashboardService.php
  - app/Http/Controllers/Api/V1/DashboardController.php
last_updated: "2026-07-21"
version: "2.0"
---

# Dashboards

**Location**: `docs/20-features/32-reports-dashboards.md`
**Related**: [Design Patterns - DashboardService](../10-architecture/14-design-patterns.md#dashboardservice)

## Overview

Role-specific dashboards are served by [`DashboardController`](../../app/Http/Controllers/Api/V1/DashboardController.php), backed by [`DashboardService`](../../app/Services/DashboardService.php). Each endpoint checks the caller has the matching role before returning data.

**There is no generic reporting or statistics API.** The `reports` route group exists in `routes/api.php` but is empty (`// Report routes will be added here as needed`) — there is no `ReportController`, no PDF/Excel export, no scheduled reports, and no `/api/statistics/*` endpoints anywhere in the codebase.

---

## Dashboards

**Base path**: `/api/v1/dashboards`

| Method | Endpoint | Description | Role Required |
|--------|----------|-------------|---------------|
| GET | `/ea` | Enterprise Admin dashboard | `enterprise_admin` |
| GET | `/om` | Operations Manager dashboard | `operations_manager` |
| GET | `/oa` | Operations Admin dashboard | `operations_admin` |
| GET | `/dr` | DRDO Admin dashboard | `drdo_admin` |
| GET | `/sa` | System Admin dashboard | `system_admin` |
| GET | `/assessor` | Assessor dashboard | `assessor` |

There is no dashboard endpoint for `unit_admin` or `drdo_lab`.

```http
GET /api/v1/dashboards/ea
Authorization: Bearer {token}
```

Each endpoint delegates to a corresponding `DashboardService` method (`getEnterpriseAdminDashboard`, `getOperationsManagerDashboard`, `getOperationsAdminDashboard`, `getDrdoAdminDashboard`, `getSystemAdminDashboard`, `getAssessorDashboard`), scoped to the requesting user.

---

## See Also

- [Design Patterns - DashboardService](../10-architecture/14-design-patterns.md#dashboardservice)

**Code References**:
- [`DashboardService`](../../app/Services/DashboardService.php)
- [`DashboardController`](../../app/Http/Controllers/Api/V1/DashboardController.php)
