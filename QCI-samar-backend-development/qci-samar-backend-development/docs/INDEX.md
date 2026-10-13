# QCI SAMAR Documentation Index

Backend API docs for the QCI SAMAR Certification Portal. Backend is the source of truth for endpoints, request/response shapes, and roles across the 4-repo system (this API, `qci-samar-web`, `qci-samar-assessor-mobile`, `qci-samar-applicant-mobile`).

## Structure

```
docs/
├── INDEX.md            # This file
├── 10-architecture/    # System design, DB schema, state machines, patterns
├── 20-features/        # Per-feature how-it-works
├── 30-api/             # API contracts (source of truth)
└── user-manual/        # Source for the end-user manual and public handbooks
```

## 10 — Architecture

- [System Architecture](10-architecture/11-system-architecture.md)
- [Database Schema](10-architecture/12-database-schema.md)
- [State Machines](10-architecture/13-state-machines.md)
- [Design Patterns](10-architecture/14-design-patterns.md)
- [Decision: Verify frontend callers before removing API routes (D-001)](10-architecture/D-001-route-removal-policy.md)
- [Decision: App timezone is Asia/Kolkata (D-006)](10-architecture/D-006-app-timezone-is-ist.md)
- [Decision: The first mobile store release is a pilot running against staging (D-007)](10-architecture/D-007-mobile-store-release-runs-on-staging.md)
- [Decision: The applicant app deliberately does not pin TLS certificates (D-008)](10-architecture/D-008-applicant-app-does-not-pin-tls.md) — **superseded**; both apps now carry the full security-grade tier
- [Decision: Both SAMAR apps relaunch as fresh store listings under the org.qcin namespace (D-009)](10-architecture/D-009-samar-apps-relaunch-under-org-qcin-namespace.md)

## 20 — Features

- [Authentication](20-features/21-authentication.md) — JWT, OTP, sessions
- [Authorization / RBAC](20-features/22-authorization-rbac.md)
- [Application Workflow](20-features/23-application-workflow.md)
- [Assessment Lifecycle (end-to-end)](20-features/assessment-lifecycle-end-to-end.md) — cross-stack, authoritative
- [Assessment Score Calculation](20-features/assessment-score-calculation.md)
- [Certificate Management](20-features/25-certificate-management.md)
- [Token Validation](20-features/25-token-validation.md)
- [Payment Processing](20-features/26-payment-processing.md)
- [Document Management](20-features/27-document-management.md)
- [Case Conversion](20-features/28-case-conversion.md) — camelCase ↔ snake_case
- [Notifications](20-features/28-notifications.md)
- [Audit Trail](20-features/29-audit-trail.md)
- [Audit Trail — Missing Actor Attribution](20-features/audit-trail-missing-actor-attribution.md) — open issue: blank user on CLI-originated rows
- [User Management](20-features/30-user-management.md)
- [Search](20-features/31-search-functionality.md)
- [Reports & Dashboards](20-features/32-reports-dashboards.md)
- [Support Tickets](20-features/33-support-tickets.md)

## 30 — API

- [API Overview](30-api/31-api-overview.md)
- [Authentication API](30-api/32-authentication-api.md)
- [Application API](30-api/33-application-api.md)
- [Assessment API](30-api/34-assessment-api.md)
- [Certificate API](30-api/35-certificate-api.md)
- [Payment API](30-api/36-payment-api.md)
- [API Reference](30-api/37-api-reference.md)

## User-facing documents

- [User Manual Toolkit](user-manual/README.md) — generates the internal User Manual (all nine roles) and the two public handbooks (Assessor, Applicant) from a single shared source

Live Swagger (dev): `/api/documentation`. OpenAPI spec: `../storage/api-docs/api-docs.json`.
