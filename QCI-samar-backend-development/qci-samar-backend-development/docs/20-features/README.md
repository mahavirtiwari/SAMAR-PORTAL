# Features Documentation

This folder contains detailed documentation for all features implemented in the QCI SAMAR Certification Portal backend.

## Feature Categories

### Authentication & Authorization
- **[21-authentication.md](21-authentication.md)** - JWT authentication, OTP verification, session management
- **[22-authorization-rbac.md](22-authorization-rbac.md)** - Role-based access control, permissions

### Application & Assessment Workflows
- **[23-application-workflow.md](23-application-workflow.md)** - Application lifecycle (7 states)
- **[assessment-lifecycle-end-to-end.md](assessment-lifecycle-end-to-end.md)** - Assessment lifecycle, cross-stack (10 states) — authoritative
- **[assessment-score-calculation.md](assessment-score-calculation.md)** - Assessment score & RC-override calculation
- **[24-assessment-workflow.md](24-assessment-workflow.md)** - Deprecated stub, superseded by `assessment-lifecycle-end-to-end.md`

### Certificate Management
- **[25-certificate-management.md](25-certificate-management.md)** - Certificate issuance, verification, expiry

### Payment Processing
- **[26-payment-processing.md](26-payment-processing.md)** - Payment gateway (ICICI EazyPay)

### Document & Content Management
- **[27-document-management.md](27-document-management.md)** - File upload, storage, security, checksum verification
- **[28-notifications.md](28-notifications.md)** - Multi-channel notifications (email, SMS, push), template management

### Audit & Monitoring
- **[29-audit-trail.md](29-audit-trail.md)** - Complete audit logging for compliance

### User & Organization Management
- **[30-user-management.md](30-user-management.md)** - User CRUD, role assignment, organization management

### Search & Reporting
- **[31-search-functionality.md](31-search-functionality.md)** - Documents a unified search feature that is **not implemented** in this codebase (no `SearchController`/`SearchService` exist)
- **[32-reports-dashboards.md](32-reports-dashboards.md)** - Role-specific dashboards (`/api/v1/dashboards/*`); no reports, exports, or statistics API exists

### Support System
- **[33-support-tickets.md](33-support-tickets.md)** - Support ticket management, Zoho Desk integration

## Quick Navigation

### By User Role

**System Administrator**:
- [User Management](30-user-management.md)
- [Audit Trail](29-audit-trail.md)
- [Reports & Dashboards](32-reports-dashboards.md)
- [Support Tickets](33-support-tickets.md)

**Organization Admin**:
- [Application Workflow](23-application-workflow.md)
- [Document Management](27-document-management.md)
- [Payment Processing](26-payment-processing.md)
- [Certificate Management](25-certificate-management.md)

**Assessor**:
- [Assessment Lifecycle](assessment-lifecycle-end-to-end.md)
- [Document Management](27-document-management.md)

**Applicant**:
- [Authentication](21-authentication.md)
- [Application Workflow](23-application-workflow.md)
- [Payment Processing](26-payment-processing.md)
- [Support Tickets](33-support-tickets.md)

### By Development Phase

**Phase 1 - Core Features** (Complete):
- Authentication & Authorization
- Application & Assessment Workflows
- Certificate Management
- Payment Processing

**Phase 2 - Enhanced Features** (Complete):
- Document Management
- Notifications
- Audit Trail
- User Management

**Phase 3 - Advanced Features**:
- Search Functionality — not implemented
- Reports & Dashboards — dashboards only, no reports/exports
- Support Tickets — Complete

## Related Documentation

- **[API Reference](../30-api/37-api-reference.md)** - Complete API endpoint documentation
- **[Architecture](../10-architecture/)** - System architecture, database schema, state machines

## Feature Implementation Status

| Feature | Status | Documentation | API | Tests |
|---------|--------|---------------|-----|-------|
| Authentication | ✅ Complete | ✅ | ✅ | ⚠️ |
| Authorization & RBAC | ✅ Complete | ⚠️ | ✅ | ⚠️ |
| Application Workflow | ✅ Complete | ⚠️ | ✅ | ⚠️ |
| Assessment Workflow | ✅ Complete | ✅ | ✅ | ⚠️ |
| Certificate Management | ✅ Complete | ⚠️ | ✅ | ⚠️ |
| Payment Processing | ✅ Complete | ⚠️ | ✅ | ⚠️ |
| Document Management | ✅ Complete | ⚠️ | ✅ | ⚠️ |
| Notifications | ✅ Complete (email only) | ⚠️ | ❌ No user-facing API | ⚠️ |
| Audit Trail | ✅ Complete | ⚠️ | ✅ | ⚠️ |
| User Management | ✅ Complete | ⚠️ | ✅ | ⚠️ |
| Search Functionality | ❌ Not implemented | ❌ | ❌ No `SearchController`/`SearchService` in the codebase | ⚠️ |
| Reports & Dashboards | ⚠️ Dashboards only | ⚠️ | ⚠️ Dashboards (`/api/v1/dashboards/*`) exist; no report/export/statistics API | ⚠️ |
| Support Tickets | ✅ Complete | ✅ | ✅ | ⚠️ |

**Legend**:
- ✅ Complete
- ⚠️ Needs Documentation/Tests
- ❌ Not Implemented

## Adding New Features

When adding new features, create documentation following this structure:

```markdown
---
title: "Feature Name"
category: "features"
tags: ["tag1", "tag2"]
related:
  - ../30-api/xx-api-file.md
  - yy-related-feature.md
code_files:
  - app/Models/FeatureModel.php
  - app/Http/Controllers/FeatureController.php
last_updated: "YYYY-MM-DD"
version: "1.0"
---

# Feature Name

## Overview
Brief description

## Business Value
Why this feature exists

## Key Features
Main capabilities

## User Guide
How to use it

## Technical Details
Implementation details

## API Reference
Endpoint documentation

## Configuration
Setup and configuration

## Troubleshooting
Common issues

## Code References
Links to actual code

## See Also
Related documentation
```

## Documentation Standards

1. **LLM-Optimized**: Use YAML frontmatter, consistent structure, clear headers
2. **Code Synchronization**: Always link to actual code files
3. **Complete Examples**: Include request/response examples
4. **Cross-References**: Link to related documentation
5. **User-Focused**: Write for the intended audience
6. **Searchable**: Use consistent terminology and tags

## Support

For questions about features:
- Check [API Reference](../30-api/37-api-reference.md) for endpoint details
