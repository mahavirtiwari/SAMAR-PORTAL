---
title: "Authorization & RBAC"
category: "features"
tags: ["authorization", "rbac", "roles", "policies"]
related:
  - 21-authentication.md
  - ../30-api/32-authentication-api.md
code_files:
  - app/Models/Role.php
  - database/seeders/RoleSeeder.php
  - app/Http/Middleware/CheckRoleMiddleware.php
  - app/Traits/HasOrganizationScope.php
  - app/Traits/HasUnitScope.php
last_updated: "2026-07-22"
version: "2.0"
---

# Authorization & RBAC (Role-Based Access Control)

**Location**: `docs/20-features/22-authorization-rbac.md`
**Related**: [Authentication](21-authentication.md) | [Authentication API](../30-api/32-authentication-api.md)

## Overview

Authorization is **role checks + Laravel Policies — nothing else**. There is no separate permission model: no `app/Models/Permission.php`, no `hasPermission()`/`getAllPermissions()` on `User`, no `role_permission` pivot table, and no `permission:` middleware alias registered in `bootstrap/app.php`. `Role.default_permissions` exists as a JSON column but nothing reads it at runtime — it is not a functioning feature.

## System Roles

**9 roles**, seeded by `database/seeders/RoleSeeder.php` (slugs are `Role::` constants — that file is the source of truth):

| Role | Slug | Level | Requires Org | Requires Unit | Single-Session |
|---|---|---|---|---|---|
| System Admin | `system_admin` | 100 | No | No | Yes |
| DRDO Admin | `drdo_admin` | 90 | No | No | Yes |
| DRDO Lab | `drdo_lab` | 85 | No | No | Yes |
| Operations Manager | `operations_manager` | 80 | No | No | Yes |
| Operations Admin | `operations_admin` | 70 | No | No | Yes |
| Assessor | `assessor` | 60 | No | No | Yes |
| Enterprise Admin | `enterprise_admin` | 50 | Yes | No | Yes |
| Unit Admin | `unit_admin` | 40 | Yes | Yes | Yes |
| ERP Integration | `erp_integration` | 10 | No | No | **No** |

There is no `lead_assessor` role and no `committee_member` role — `CommitteeMember` is a separate entity/model, not a `Role`. `ERP Integration` is a machine account for the Business Central push, not a human role, and is the **only** role with `enforce_single_session = false` (concurrent batch calls from BC must not displace each other's sessions).

## Role Assignment

Roles are assigned via the `user_role` pivot (`organization_id`, `unit_id`, `is_active`, `assigned_at`, `expires_at` columns) when a user is created — `UserService::updateUser()` never touches role assignment. This is documented as current behavior; there is no evidence one way or the other about a prior role-update endpoint having existed.

## Checking Roles

```php
$user->hasRole('enterprise_admin');           // active roles only
$user->hasAnyRole(['enterprise_admin', 'unit_admin']);
$user->hasAllRoles(['assessor', 'operations_manager']);
$user->activeRoles;                            // BelongsToMany, wherePivot('is_active', true)
$user->roles;                                  // all role assignments, including inactive
```

All three `has*Role` checks query `activeRoles()` (`app/Models/User.php`) — inactive role assignments never grant access.

## Route Middleware

`role:<slug>[,<slug>...]` → `CheckRoleMiddleware` (`app/Http/Middleware/CheckRoleMiddleware.php`), aliased in `bootstrap/app.php`. It's a straight `hasAnyRole($roles)` check — 401 if unauthenticated, 403 if the role doesn't match, otherwise pass:

```php
Route::middleware(['auth:api', 'role:system_admin,operations_manager,operations_admin'])
    ->group(function () { ... });
```

There is no `permission:` middleware — any example using one is not real.

## Policies

Authorization for a specific model instance is a Laravel Policy, checked via `Gate::authorize()` or `$this->authorize()` in controllers. Real example — `ApplicationPolicy` (`app/Policies/ApplicationPolicy.php`):

```php
public function viewAny(User $user): bool
{
    return $user->hasAnyRole([
        Role::ENTERPRISE_ADMIN, Role::UNIT_ADMIN, Role::DRDO_ADMIN,
        Role::OPERATIONS_MANAGER, Role::OPERATIONS_ADMIN, Role::SYSTEM_ADMIN,
    ]);
}

public function view(User $user, Application $application): bool
{
    if ($user->hasAnyRole([Role::SYSTEM_ADMIN, Role::OPERATIONS_ADMIN, Role::OPERATIONS_MANAGER, Role::DRDO_ADMIN])) {
        return true;
    }
    if ($user->hasRole(Role::ENTERPRISE_ADMIN) && $user->organization_id === $application->organization_id) {
        return true;
    }
    if ($user->hasRole(Role::UNIT_ADMIN)) {
        // Active unit_admin unit_ids for this user, from the user_role pivot.
        $userUnits = $user->roles()
            ->where('slug', Role::UNIT_ADMIN)
            ->wherePivot('is_active', true)
            ->get()
            ->pluck('pivot.unit_id')
            ->filter()
            ->toArray();

        return in_array($application->unit_id, $userUnits);
    }
    return false;
}
```

Notable real behavior, corrected from an earlier version of this doc:
- **`update`** is gated on status `draft`, `drdo_approval_pending`, or `payment_pending` — not `draft`/`allocation_pending`.
- **`delete`** only allows `draft` status, and only the owning organization's Enterprise Admin.
- **There is no Assessor/Lead-Assessor branch in `view()`** — assessors do not get application visibility through this policy (there's no `lead_assessor` role at all).
- **`approve`/`reject`**: DRDO Admin, Operations Manager, or Operations Admin — not `COMMITTEE_MEMBER` (not a role).

## Organization & Unit Scoping — opt-in, not automatic

`HasOrganizationScope` (used by `Application`, `Assessment`, `Unit`, `Payment`, `Certificate`) does **not** register a global scope. It only:
1. Auto-fills `organization_id` from the authenticated user **on create**, if not already set.
2. Provides local scopes that must be called explicitly: `Model::forOrganization($orgId = null)` (defaults to the current user's org) and `Model::whereOrganization($orgId)`.

A query that doesn't call `->forOrganization()` is **not** automatically restricted to the caller's organization — that restriction has to be applied by the controller/service, not the model.

`HasUnitScope` is the unit-level equivalent: `Model::forUnit($unitId)` (accepts an int or array) and `Model::forOrganizationUnits($organizationId)`.

## See Also

- [Authentication](21-authentication.md) — login, sessions, 2FA
- [Audit Trail](29-audit-trail.md) — `role_assigned` audit event

**Code References**:
- [`Role` model](../../app/Models/Role.php)
- [`RoleSeeder`](../../database/seeders/RoleSeeder.php)
- [`CheckRoleMiddleware`](../../app/Http/Middleware/CheckRoleMiddleware.php)
- [`ApplicationPolicy`](../../app/Policies/ApplicationPolicy.php)
- [`HasOrganizationScope`](../../app/Traits/HasOrganizationScope.php) / [`HasUnitScope`](../../app/Traits/HasUnitScope.php)
