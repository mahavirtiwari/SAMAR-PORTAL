---
title: "API Documentation"
category: "api"
tags: ["api", "rest", "endpoints", "swagger", "openapi"]
related:
  - ../INDEX.md
  - ../20-features/21-authentication.md
  - ../00-getting-started/02-quick-start.md
last_updated: "2025-01-05"
version: "1.0"
---

# API Documentation

**Location**: `docs/30-api/README.md`
**Quick Links**: [API Overview](31-api-overview.md) | [Complete Reference](37-api-reference.md) | [Swagger UI](/api/documentation)

---

## Overview

This folder contains comprehensive API documentation for the QCI SAMAR Certification Portal backend. The API is a RESTful JSON API built with Laravel 12, featuring JWT authentication, role-based access control, and OpenAPI 3.1 specification.

**Target Audience**:
- Frontend developers integrating with the API
- Mobile app developers
- Third-party integration developers
- API consumers and testers
- Technical documentation writers

---

## 📚 Documentation Files

### API Documentation Structure

| File | Description | Key Topics | Use Case |
|------|-------------|------------|----------|
| **[31-api-overview.md](31-api-overview.md)** | API introduction, standards, case conversion, authentication, errors | Getting started, API design, camelCase support, common patterns | ✅ New API consumers |
| **[32-authentication-api.md](32-authentication-api.md)** | Authentication endpoints (register, login, OTP, refresh) | JWT auth, OTP verification, session management | ✅ Implementing auth |
| **[33-application-api.md](33-application-api.md)** | Application lifecycle endpoints | Application list/view/submit | ✅ Application features |
| **[34-assessment-api.md](34-assessment-api.md)** | Assessment workflow endpoints | Assessment allocation, scorecards, QC review | ✅ Assessment features |
| **[35-certificate-api.md](35-certificate-api.md)** | Certificate management endpoints | Certificate listing, download, verification | ✅ Certificate features |
| **[36-payment-api.md](36-payment-api.md)** | Payment processing endpoints | Payment initiation, webhooks | ✅ Payment integration |
| **[37-api-reference.md](37-api-reference.md)** | Complete API reference | All endpoints, full examples, complete reference | ✅ Complete reference |

**Legend**: ✅ Complete | ⚠️ Pending Creation

---

## 🚀 Quick Start

### 1. Access Swagger UI

**Local Development**:
```
http://localhost:8000/api/documentation
```

Swagger UI is served only in the `local` and `development` environments — `SwaggerAccess`
middleware returns 404 on staging and production. There is no hosted staging Swagger URL.

The Swagger UI provides:
- ✅ Interactive API testing
- ✅ Request/response examples
- ✅ Authentication testing
- ✅ Schema validation
- ✅ Role-based endpoint visibility

---

### 2. First API Call (No Auth)

Test the API is running:

```bash
curl -X GET "http://localhost:8000/api/v1/health" \
  -H "Accept: application/json"
```

**Response**:
```json
{
  "success": true,
  "message": "API is healthy",
  "data": {
    "status": "ok",
    "version": "1.0",
    "timestamp": "2025-01-05T12:34:56Z"
  }
}
```

---

### 3. Register and Login

**Step 1: Register Organization**

```bash
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "organization_name": "Tech Corp",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@techcorp.com",
    "mobile_number": "9876543210"
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Registration successful. Check your email for login credentials and verification OTP.",
  "data": {
    "samar_id": "SAMAR-040226-1",
    "is_resend": false
  }
}
```

**Step 2: Verify OTP** (check email for OTP code)

```bash
curl -X POST "http://localhost:8000/api/v1/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "samar_id": "SAMAR-040226-1",
    "otp": "123456"
  }'
```

**Step 3: Login** (2FA Step 1 — sends a login OTP; complete with `POST /api/v1/auth/verify-login-otp`)

```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "samar_id": "SAMAR-040226-1",
    "password": "<password from the registration email>"
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "OTP sent to your email. Please verify to complete login.",
  "data": {
    "session_token": "abcd1234...",
    "otp_expires_in": "2 minutes",
    "requires_otp": true
  }
}
```

**Step 4: Make Authenticated Request**

```bash
curl -X GET "http://localhost:8000/api/v1/auth/me" \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc..." \
  -H "Accept: application/json"
```

**Full Guide**: [Authentication API](32-authentication-api.md)

---

## 📖 API Documentation by Feature

### Authentication & Authorization

**Documents**:
- [Authentication API](32-authentication-api.md)
- [Authentication Feature](../20-features/21-authentication.md)
- [Authorization & RBAC](../20-features/22-authorization-rbac.md)

**Endpoints**:
```
POST   /api/v1/auth/register          # Register organization
POST   /api/v1/auth/login             # Login (JWT)
POST   /api/v1/auth/logout            # Logout
GET    /api/v1/auth/me                # Get current user
POST   /api/v1/auth/verify-otp        # Verify OTP
POST   /api/v1/auth/resend-otp        # Resend OTP
POST   /api/v1/auth/refresh           # Refresh token
POST   /api/v1/auth/forgot-password   # Password reset request
POST   /api/v1/auth/reset-password    # Reset password
```

**Key Features**:
- JWT authentication with refresh tokens
- Email OTP verification
- Single session enforcement for sensitive roles
- Password reset flow
- Rate limiting on auth endpoints

---

### Application Management

**Documents**:
- [Application API](33-application-api.md)
- [Application Workflow](../20-features/23-application-workflow.md)

**Endpoints**:
```
GET    /api/v1/applications           # List applications
GET    /api/v1/applications/{id}      # Get application
POST   /api/v1/applications/{id}/submit            # Submit for review
```

See `routes/api.php` for the full endpoint set (draft creation, renewal, DRDO approval, feedback, assessment summary, etc.).

**Key Features**:
- Role-based access control
- Organization scoping

---

### Assessment Management

**Documents**:
- [Assessment API](34-assessment-api.md)
- [Assessment Workflow](../20-features/24-assessment-workflow.md)

**Endpoints**:
```
GET    /api/v1/assessments            # List assessments
GET    /api/v1/assessments/{id}       # Get assessment
```

Workflow actions (`/schedule`, `/start`, `/submit-for-qc`, `/qc-decision`, committee review, etc.) are documented with accurate paths and payloads in [Assessment API](34-assessment-api.md).

**Key Features**:
- Team allocation (lead + team assessors)
- QC review process
- Assessment scheduling

---

### Payment Processing

**Documents**:
- [Payment API](36-payment-api.md)
- [Payment Processing](../20-features/26-payment-processing.md)

**Endpoints**:
```
GET    /api/v1/payments               # List payments
GET    /api/v1/payments/{id}          # View payment details
POST   /api/v1/payments/initiate      # Initiate payment

# Webhooks (no authentication)
POST   /api/webhooks/payments/icici-eazypay  # ICICI EazyPay webhook
```

**Key Features**:
- ICICI EazyPay gateway support
- Webhook signature verification
- Payment status tracking
- Transaction history

---

### Certificate Management

**Documents**:
- [Certificate API](35-certificate-api.md)
- [Certificate Management](../20-features/25-certificate-management.md)

**Endpoints**:
```
GET    /api/v1/certificates                        # List certificates
GET    /api/v1/certificates/{id}                    # Get certificate
GET    /api/v1/certificates/{certificateNumber}/download   # Download PDF

# Public verification (no auth)
GET|POST   /api/v1/verify-certificate               # Verify certificate
```

**Key Features**:
- 4 certificate types (Initial, Renewal, Upgrade, Surveillance)
- Public verification API
- Certificate numbering system

---

## 🔐 API Authentication

### JWT Token Authentication

All protected endpoints require JWT authentication:

```bash
curl -X GET "http://localhost:8000/api/v1/endpoint" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Accept: application/json"
```

**Token Types**:
- **Access Token**: Short-lived (60 minutes), use for API calls
- **Refresh Token**: Long-lived (14 days), use to get new access token

**Token Refresh**:
```bash
curl -X POST "http://localhost:8000/api/v1/auth/refresh" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"refresh_token": "YOUR_REFRESH_TOKEN"}'
```

**Details**: [Authentication API](32-authentication-api.md)

---

## 🎯 API Standards

### Case Conversion (camelCase ↔ snake_case)

> **⚡ IMPORTANT**: This API supports flexible naming conventions!

**Incoming Requests**:
- ✅ **camelCase supported**: `firstName`, `emailAddress`
- ✅ **snake_case supported**: `first_name`, `email_address`
- ✅ **Both work equally** - use your preferred format!

**Outgoing Responses**:
- 🔄 **Always camelCase** - all responses use camelCase
- 📱 **JavaScript-friendly** - perfect for React, Angular, Vue.js

**Example**:
```javascript
// Both requests work:
{ "firstName": "John" }       // camelCase (recommended)
{ "first_name": "John" }      // snake_case (also works)

// Response (always camelCase):
{ "firstName": "John", "createdAt": "2025-01-26T10:00:00Z" }
```

**Details**: [Case Conversion Feature](../20-features/28-case-conversion.md) | [API Overview](31-api-overview.md)

---

### Request Format

**Headers**:
```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer {token}  # For protected endpoints
```

**HTTP Methods**:
- `GET` - Retrieve resources
- `POST` - Create resources or execute actions
- `PUT` - Update entire resource
- `PATCH` - Update partial resource
- `DELETE` - Delete resource

---

### Response Format

**Success Response** (200, 201):
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

**Error Response** (4xx, 5xx):
```json
{
  "success": false,
  "message": "Error description",
  "errors": {
    "field": ["Validation error message"]
  }
}
```

---

### Pagination

List endpoints return paginated results:

```json
{
  "success": true,
  "message": "Applications retrieved successfully",
  "data": [...],
  "meta": {
    "current_page": 1,
    "per_page": 15,
    "total": 47,
    "last_page": 4
  },
  "links": {
    "first": "http://api/v1/applications?page=1",
    "last": "http://api/v1/applications?page=4",
    "prev": null,
    "next": "http://api/v1/applications?page=2"
  }
}
```

**Query Parameters**:
- `page` - Page number (default: 1)
- `per_page` - Items per page (default: 15, max: 100)

---

### Filtering and Sorting

**Filtering**:
```
GET /api/v1/applications?status=submitted&type=initial
```

**Sorting**:
```
GET /api/v1/applications?sort_by=created_at&sort_order=desc
```

**Search**:
```
GET /api/v1/applications?search=Tech Corp
```

---

## 📊 API Reference by Role

### Organization Admin / User

**Available Endpoints**:
- ✅ Authentication (register, login, OTP)
- ✅ Organization profile (view, update)
- ✅ Applications (draft, submit, renew)
- ✅ Units (view, change spoke)
- ✅ Payments (initiate)
- ✅ Certificates (view own)
- ✅ Support tickets (create, view, update)

**Start Here**: [Authentication API](32-authentication-api.md) → [Application API](33-application-api.md)

---

### Assessor / Lead Assessor

**Available Endpoints**:
- ✅ Authentication
- ✅ Assessments (view allocated, start, submit for QC)
- ✅ Documents (view, upload evidence)

**Start Here**: [Assessment API](34-assessment-api.md)

---

### Operations Manager / Admin

**Available Endpoints**:
- ✅ All Organization Admin endpoints
- ✅ Applications (review)
- ✅ Assessments (allocate assessors, QC decision)
- ✅ Certificates (view)
- ✅ Committees (create, manage, record decisions)
- ✅ Users (view, activate/deactivate)
- ✅ Audit logs (view)

**Start Here**: [Application API](33-application-api.md) → [Assessment API](34-assessment-api.md)

---

### DRDO Admin

**Available Endpoints**:
- ✅ All Operations Manager endpoints
- ✅ Applications (DRDO approve/reject, view all)
- ✅ Organizations (view all)

**Start Here**: [Complete API Reference](37-api-reference.md)

---

### System Admin

**Available Endpoints**:
- ✅ Full access to all endpoints
- ✅ User management (create, activate/deactivate, assign roles at creation)
- ✅ Audit logs (view, export)
- ✅ System settings

**Start Here**: [Complete API Reference](37-api-reference.md)

---

## 🧪 Testing the API

### Using Swagger UI

1. Navigate to `/api/documentation`
2. Click "Authorize" button
3. Enter JWT token: `Bearer YOUR_ACCESS_TOKEN`
4. Test endpoints interactively

**Advantages**:
- ✅ No additional tools needed
- ✅ Schema validation
- ✅ Example values pre-filled
- ✅ Response visualization

---

### Using Postman

**Import Collection**:
1. Generate OpenAPI spec: `php artisan l5-swagger:generate`
2. Import `storage/api-docs/api-docs.json` into Postman
3. Configure environment variables:
   - `base_url`: http://localhost:8000
   - `access_token`: Your JWT token

**Collection Features**:
- Pre-configured headers
- Example requests
- Environment variables

---

### Using cURL

**Example: List Applications**

```bash
# Set token as variable
TOKEN="eyJ0eXAiOiJKV1QiLCJhbGc..."

# Make request
curl -X GET "http://localhost:8000/api/v1/applications" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json"
```

**Full Examples**: See individual API documentation files

---

## ⚠️ Common Errors

### 401 Unauthorized

```json
{
  "success": false,
  "message": "Unauthenticated"
}
```

**Solutions**:
- Ensure `Authorization: Bearer {token}` header is present
- Check token hasn't expired (60 minutes for access tokens)
- Try refreshing token

---

### 403 Forbidden

```json
{
  "success": false,
  "message": "This action is unauthorized"
}
```

**Solutions**:
- Check user has required role/permission
- Verify organization scoping (accessing own data)
- Review RBAC documentation

---

### 422 Unprocessable Entity

```json
{
  "success": false,
  "message": "The given data was invalid",
  "errors": {
    "email": ["The email field is required."],
    "password": ["The password must be at least 8 characters."]
  }
}
```

**Solutions**:
- Check all required fields are provided
- Validate field formats (email, phone, etc.)
- Review validation rules in API docs

---

### 429 Too Many Requests

```json
{
  "success": false,
  "message": "Too many requests. Please try again later."
}
```

**Solutions**:
- Wait before retrying (rate limit: 5-10 requests/minute for auth)
- Implement exponential backoff
- Review rate limiting configuration

---

## 📚 Additional Resources

### OpenAPI Specification

**Location**: `storage/api-docs/api-docs.json`

**Generate Latest**:
```bash
php artisan l5-swagger:generate
```

**View**:
- Swagger UI: `/api/documentation`

---

### Postman Collection

**Export from Swagger**:
1. Visit `/api/documentation`
2. Click "Export" → "Download JSON"
3. Import into Postman

**Alternatively**: Import `storage/api-docs/api-docs.json` directly

---

## 🔗 Related Documentation

### Getting Started

### Features
- [Authentication](../20-features/21-authentication.md) - Auth system details
- [Authorization & RBAC](../20-features/22-authorization-rbac.md) - Permissions
- [Application Workflow](../20-features/23-application-workflow.md) - Application lifecycle
- [Assessment Workflow](../20-features/24-assessment-workflow.md) - Assessment process

### Development

---

## 📊 Documentation Status

| Document | Status | Last Updated | Priority |
|----------|--------|--------------|----------|
| 31-api-overview.md | ✅ Complete | 2025-01-26 | High |
| 32-authentication-api.md | ✅ Complete | 2025-01-05 | High |
| 33-application-api.md | ✅ Complete | 2025-01-05 | High |
| 34-assessment-api.md | ✅ Complete | 2026-02-08 | High |
| 35-certificate-api.md | ✅ Complete | 2025-01-05 | Medium |
| 36-payment-api.md | ✅ Complete | 2025-12-31 | Medium |
| 37-api-reference.md | ✅ Complete | 2025-01-05 | High |

**Legend**: ✅ Complete | ⚠️ Pending Creation

---

## 🎯 Success Criteria

You're ready to use the API when you can:

✅ **Register** and login to get JWT tokens
✅ **Make authenticated** requests with Bearer token
✅ **Handle** standard response formats
✅ **Understand** error responses and status codes
✅ **Navigate** Swagger UI documentation
✅ **Filter, sort, and paginate** list endpoints
✅ **Test** endpoints using Postman or cURL

**Next**: Explore [Features](../20-features/README.md)

---

**Last Updated**: January 2025
**Maintainers**: Development Team & API Documentation Team
**Feedback**: Report API issues or documentation gaps to the team
