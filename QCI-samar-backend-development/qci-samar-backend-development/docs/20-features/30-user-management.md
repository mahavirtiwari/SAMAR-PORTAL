---
title: "User Management"
category: "features"
tags: ["users", "roles", "organizations", "units"]
related:
  - 21-authentication.md
  - 22-authorization-rbac.md
code_files:
  - app/Models/User.php
  - app/Http/Controllers/Api/V1/UserController.php
  - app/Http/Requests/User/StoreUserRequest.php
last_updated: "2026-07-21"
version: "3.0"
---

# User Management

**Location**: `docs/20-features/30-user-management.md`
**Related**: [Authentication](21-authentication.md) | [Authorization & RBAC](22-authorization-rbac.md)

## Overview

User management handles **user accounts, profiles, role assignments, and status** across the QCI SAMAR platform, via [`UserController`](../../app/Http/Controllers/Api/V1/UserController.php).

> **Roles are assigned at creation and are not changed through a dedicated "update roles" endpoint.** There is no `PATCH /users/{id}/roles` route.

---

## User Status

`status` is a string enum, not a boolean:

`invited`, `pending_verification`, `active`, `inactive`, `suspended`

---

## User CRUD

### Create User

```http
POST /api/v1/users
Authorization: Bearer {token}
Content-Type: application/json

{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "mobile_number": "9876543210",
  "organization_id": 5,
  "roles": [
    {
      "slug": "unit_admin",
      "organization_id": 5,
      "unit_id": 12
    }
  ],
  "designation": "Quality Manager"
}
```

`password` is optional at creation — if omitted, the system generates one. Enterprise Admins may only create users within their own organization (enforced in the controller).

### View User

```http
GET /api/v1/users/{id}
Authorization: Bearer {token}
```

Returns the user's profile plus `roles` and `permissions`.

### Update User

```http
PUT /api/v1/users/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "designation": "Senior Quality Manager"
}
```

The same endpoint is used both for a user updating their own profile and for an admin updating another user:
- **Self-update**: limited to `first_name`, `last_name`, `mobile_number`, `designation`, `district`, `state`, `address`, `city`, `pincode`. A self-service password change is also accepted here (requires `current_password` + `password`).
- **Admin updating another user**: `status` and `organization_id` are only writable if the acting admin passes the `updateRestricted` gate; only `system_admin` can set another user's `password` directly through this endpoint.

### Activate / Deactivate User

```http
POST /api/v1/users/{id}/activate
POST /api/v1/users/{id}/deactivate
Authorization: Bearer {token}
```

Role-restricted to `system_admin`, `enterprise_admin`, `operations_manager`, `operations_admin`.

---

## Current User Profile

```http
GET /api/v1/auth/me
Authorization: Bearer {token}
```

```http
POST /api/v1/auth/change-password
Content-Type: application/json

{
  "current_password": "OldPass123!",
  "password": "NewPass456!",
  "password_confirmation": "NewPass456!"
}
```

---

## Assessor-Specific Endpoints

```http
GET /api/v1/users/{id}/assessor-districts
```

```http
GET /api/v1/users/{id}/off-times
```

Operations Manager/Admin read-only view of an assessor's logged unavailability (off-time). Assessors manage their own off-times via a separate `off-times` self-service endpoint group (see [Authorization & RBAC](22-authorization-rbac.md)).

---

## API Reference

| Method | Endpoint | Description | Role Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/users` | List users | System Admin, Enterprise Admin, Operations Manager, Operations Admin |
| POST | `/api/v1/users` | Create user with roles | System Admin, Enterprise Admin, Operations Manager, Operations Admin |
| GET | `/api/v1/users/{id}` | View user | Owner or Admin (authorized in controller/policy) |
| PUT | `/api/v1/users/{id}` | Update user (self or admin, scope depends on caller) | Owner or Admin |
| POST | `/api/v1/users/{id}/activate` | Activate user | System Admin, Enterprise Admin, Operations Manager, Operations Admin |
| POST | `/api/v1/users/{id}/deactivate` | Deactivate user | System Admin, Enterprise Admin, Operations Manager, Operations Admin |
| GET | `/api/v1/users/{id}/assessor-districts` | Assessor's assigned districts | Authenticated |
| GET | `/api/v1/users/{id}/off-times` | Assessor's logged off-time | Operations Manager, Operations Admin |
| GET | `/api/v1/auth/me` | Current user profile | Authenticated |
| POST | `/api/v1/auth/change-password` | Change own password | Authenticated |

There is no delete endpoint, no bulk user search endpoint, no organization-scoped `users/invite` endpoint, and no profile-photo upload endpoint.

---

## See Also

- [Authentication](21-authentication.md)
- [Authorization & RBAC](22-authorization-rbac.md)

**Code References**:
- [`User` model](../../app/Models/User.php)
- [`UserController`](../../app/Http/Controllers/Api/V1/UserController.php)
- [`StoreUserRequest`](../../app/Http/Requests/User/StoreUserRequest.php)
