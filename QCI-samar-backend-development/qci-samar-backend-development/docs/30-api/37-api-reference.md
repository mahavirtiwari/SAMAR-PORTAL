# API Endpoints Reference

Complete reference of all API endpoints in the QCI SAMAR backend system.

> **IMPORTANT USER MANAGEMENT CONSTRAINTS**:
> - ✅ **Users CANNOT be deleted** - Use deactivate endpoint instead
> - ✅ **User roles CANNOT be changed** - Roles assigned only during user creation
> - ✅ **No role update endpoint** - `PATCH /api/v1/users/{id}/roles` has been removed

## Base URL

- **Local Development**: `http://localhost:8000/api`

See `.webority/infra.json` for the current staging host (no production environment exists).

## API Versioning

All endpoints are versioned using URL path versioning:
- Current Version: **v1**
- Format: `/api/v1/{resource}`

## Authentication

Most endpoints require JWT authentication. Include the access token in the Authorization header:

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```

Public endpoints (no authentication required):
- `GET|POST /v1/verify-certificate` - Certificate verification
- Webhook endpoints

## Response Format

### Success Response

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error message",
  "errors": {
    "field": ["Validation error message"]
  }
}
```

## Pagination

List endpoints support pagination:

```http
GET /api/v1/applications?page=1&per_page=15
```

**Pagination Response**:
```json
{
  "success": true,
  "data": {
    "applications": [...],
    "pagination": {
      "total": 150,
      "per_page": 15,
      "current_page": 1,
      "last_page": 10
    }
  }
}
```

---

## Authentication Endpoints

### Register Organization

Register a new organization and create an enterprise admin user.

```http
POST /v1/auth/register
Content-Type: application/json
```

**Request Body**:
```json
{
  "organization_name": "Acme Defense Corp",
  "first_name": "John",
  "last_name": "Doe",
  "email": "admin@acmedefense.com",
  "mobile_number": "9876543210"
}
```

**Response**: 201 Created
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

---

### Verify OTP

Verify email address using OTP code.

```http
POST /v1/auth/verify-otp
Content-Type: application/json
```

**Request Body**:
```json
{
  "samar_id": "SAMAR-040226-1",
  "otp": "123456"
}
```

**Response**: 200 OK

---

### Resend OTP

Request a new OTP code.

```http
POST /v1/auth/resend-otp
Content-Type: application/json
```

**Request Body**:
```json
{
  "samar_id": "SAMAR-040226-1"
}
```

**Response**: 200 OK

---

### Login

Step 1 of 2FA login: validates credentials and emails an OTP. Complete with `POST /v1/auth/verify-login-otp`.

```http
POST /v1/auth/login
Content-Type: application/json
```

**Request Body**:
```json
{
  "samar_id": "SAMAR-040226-1",
  "password": "SecurePass@123",
  "device_type": "web" // Optional: web, tablet, mobile, ios, android
}
```

**Response**: 200 OK
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

---

### Logout

End current session and blacklist token.

```http
POST /v1/auth/logout
Authorization: Bearer {access_token}
```

**Response**: 200 OK

---

### Get Current User

Retrieve authenticated user's profile.

```http
GET /v1/auth/me
Authorization: Bearer {access_token}
```

**Response**: 200 OK
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "full_name": "John Doe",
      "email": "admin@acmedefense.com",
      "organization_id": 1,
      "roles": [...],
      "permissions": [...]
    }
  }
}
```

---

### Refresh Token

Get a new access/refresh token pair. The refresh token rotates on every use (the presented one is retired).

```http
POST /v1/auth/refresh
Content-Type: application/json
```

**Request Body**:
```json
{
  "refresh_token": "eyJ0eXAiOiJKV1Q..."
}
```

**Response**: 200 OK
```json
{
  "success": true,
  "data": {
    "access_token": "eyJ0eXAiOiJKV1Q...",
    "refresh_token": "eyJ0eXAiOiJKV1Q...",
    "token_type": "Bearer",
    "access_token_expiration": "2025-01-15T11:30:00+05:30",
    "refresh_token_expiration": "2025-01-29T10:30:00+05:30"
  }
}
```

---

### Forgot Password

Request password reset link.

```http
POST /v1/auth/forgot-password
Content-Type: application/json
```

**Request Body**:
```json
{
  "samar_id": "SAMAR-040226-1"
}
```

**Response**: 200 OK

---

### Reset Password

Reset password using the OTP emailed by the forgot-password endpoint.

```http
POST /v1/auth/reset-password
Content-Type: application/json
```

**Request Body**:
```json
{
  "samar_id": "SAMAR-040226-1",
  "otp": "123456",
  "password": "NewSecurePass@123",
  "password_confirmation": "NewSecurePass@123"
}
```

**Response**: 200 OK

---

## Organization Endpoints

### List Organizations

**Permissions**: `system_admin`, `drdo_admin` only

```http
GET /v1/organizations
Authorization: Bearer {access_token}
```

**Query Parameters**:
- `per_page` (optional): Items per page (default: 15)

**Response**: 200 OK

---

### Get Organization

Get organization details.

```http
GET /v1/organizations/{id}
Authorization: Bearer {access_token}
```

**Response**: 200 OK

---

### Update Organization

Updates the authenticated user's own organization profile. Automatically marks the profile as complete once all required fields are filled.

```http
PUT /v1/organization
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "name": "Updated Name",
  "registered_address": "123 New Address",
  "registered_state": "Maharashtra",
  "registered_district": "Mumbai Suburban",
  "registered_pincode": "400001",
  "pan": "ABCDE1234F"
}
```

**Response**: 200 OK

---

## Unit Endpoints

### List Units

List all units (scoped by organization).

```http
GET /v1/units
Authorization: Bearer {access_token}
```

**Query Parameters**:
- `per_page` (optional): Items per page (default: 15)

**Response**: 200 OK

---

### Get Unit

Get unit details.

```http
GET /v1/units/{id}
Authorization: Bearer {access_token}
```

**Response**: 200 OK

---

### Change Spoke

Change the spoke (Unit Admin) for a unit. Enterprise Admin only, scoped to their own organization.

```http
POST /v1/units/{id}/change-spoke
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "email": "new.spoke@example.com",
  "name": "Jane Doe",
  "designation": "Plant Manager",
  "mobile": "9876543210"
}
```

**Response**: 200 OK

---

## Application Endpoints

### List Applications

List applications (filtered by role and organization).

```http
GET /v1/applications
Authorization: Bearer {access_token}
```

**Query Parameters**:
- `status` (optional): Filter by status
- `certification_type` (optional): Filter by type
- `per_page` (optional): Items per page (default: 15)

**Response**: 200 OK

---

### Get Application

Get application details.

```http
GET /v1/applications/{id}
Authorization: Bearer {access_token}
```

**Response**: 200 OK

---

### Submit Application

Submit application for review.

```http
POST /v1/applications/{id}/submit
Authorization: Bearer {access_token}
```

**Response**: 200 OK

Authoritative source for the full endpoint set (draft creation, renewal, DRDO approval, feedback, assessment summary, etc.): `routes/api.php`.

---

## Assessment Endpoints

### List Assessments

```http
GET /v1/assessments
Authorization: Bearer {access_token}
```

**Query Parameters**:
- `application_id` (optional): Filter by application
- `status` (optional): Filter by status
- `per_page` (optional): Items per page

**Response**: 200 OK

---

### Get Assessment

```http
GET /v1/assessments/{id}
Authorization: Bearer {access_token}
```

**Response**: 200 OK

---

Workflow actions (schedule, start, submit-for-qc, qc-decision, committee review, etc.) are covered in full, with accurate paths and payloads, in [Assessment API](34-assessment-api.md).

---

## Payment Endpoints

### List Payments

```http
GET /v1/payments
Authorization: Bearer {access_token}
```

**Response**: 200 OK

---

### Initiate Payment

```http
POST /v1/payments/initiate
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "applicationId": 1,
  "amount": 50000,
  "paymentType": "application_fee",
  "gateway": "icici_eazypay"
}
```

**Response**: 201 Created
```json
{
  "success": true,
  "data": {
    "payment": {
      "id": 1,
      "paymentNumber": "TXN1705312345678A3F9",
      "amount": "50000.00",
      "currency": "INR",
      "status": "pending"
    },
    "gatewayData": {
      "paymentUrl": "https://eazypay.icicibank.com/EazyPG?...",
      "referenceNo": "TXN1705312345678A3F9",
      "redirectMethod": "GET"
    }
  }
}
```

---

## Certificate Endpoints

### List Certificates

```http
GET /v1/certificates
Authorization: Bearer {access_token}
```

**Query Parameters**:
- `application_id` (optional)
- `status` (optional)
- `certificate_type` (optional)

**Response**: 200 OK

---

### Get Certificate

```http
GET /v1/certificates/{id}
Authorization: Bearer {access_token}
```

**Response**: 200 OK

---

### Download Certificate PDF

```http
GET /v1/certificates/{certificateNumber}/download
Authorization: Bearer {access_token}
```

**Response**: 200 OK (application/pdf)

---

### Verify Certificate (Public)

**No Authentication Required**

```http
GET|POST /v1/verify-certificate
Content-Type: application/json
```

**Request Body**:
```json
{
  "certificate_number": "03012025_030125-11111"
}
```

**Response**: 200 OK
```json
{
  "success": true,
  "valid": true,
  "data": {
    "certificate_number": "03012025_030125-11111",
    "organization_name": "Acme Defense Corp",
    "status": "active",
    "valid_from": "2025-01-01",
    "valid_until": "2028-01-01",
    "scope": "Design and manufacture of defense equipment"
  }
}
```

---

## User Management Endpoints

> **CRITICAL CONSTRAINTS**:
> - Users CANNOT be deleted (use deactivate instead)
> - User roles CANNOT be changed after creation
> - Roles must be assigned during user creation only

### List Users

```http
GET /v1/users
Authorization: Bearer {access_token}
```

**Query Parameters**:
- `search` (optional): Search by name, email, or phone
- `role` (optional): Filter by role slug
- `status` (optional): Filter by status (active, inactive)
- `per_page` (optional): Items per page (default: 15)

**Response**: 200 OK

---

### Create User

**Role Required**: `system_admin` or `enterprise_admin`

> **IMPORTANT**: Roles can ONLY be assigned here. They cannot be changed later.

```http
POST /v1/users
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "phone": "9876543210",
  "password": "SecurePass123!",
  "organization_id": 5,
  "roles": [
    {
      "slug": "unit_admin",
      "organization_id": 5,
      "unit_id": 12
    }
  ],
  "designation": "Quality Manager",
  "department": "Quality Assurance"
}
```

**Response**: 201 Created
```json
{
  "success": true,
  "message": "User created successfully.",
  "data": {
    "id": 25,
    "full_name": "John Doe",
    "email": "john.doe@example.com",
    "roles": [
      {
        "slug": "unit_admin",
        "name": "Unit Admin"
      }
    ]
  }
}
```

---

### Get User

```http
GET /v1/users/{id}
Authorization: Bearer {access_token}
```

**Response**: 200 OK

---

### Update User

**Note**: Profile can be updated, but roles CANNOT be changed.

```http
PUT /v1/users/{id}
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "first_name": "John",
  "designation": "Senior Quality Manager"
}
```

**Response**: 200 OK

---

### Activate User

**Role Required**: `system_admin` or `enterprise_admin`

```http
POST /v1/users/{id}/activate
Authorization: Bearer {access_token}
```

**Response**: 200 OK

---

### Deactivate User

**Role Required**: `system_admin` or `enterprise_admin`

> **IMPORTANT**: Users cannot be deleted. Use this endpoint to disable access instead.

```http
POST /v1/users/{id}/deactivate
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "reason": "User resigned"
}
```

**Response**: 200 OK

---

### ~~Delete User~~ (REMOVED)

> **REMOVED**: Users cannot be deleted. Use the deactivate endpoint instead.

---

### ~~Update User Roles~~ (REMOVED)

> **REMOVED**: User roles cannot be changed after creation. Roles must be assigned during user creation via `POST /v1/users`.

---

## Webhook Endpoints

### ICICI EazyPay Webhook

**No Authentication** (signature verified via SHA512)

```http
POST /webhooks/payments/icici-eazypay
Content-Type: application/xml
```

**Request Body**: ICICI EazyPay push notification payload (encrypted XML)

**Response**: 200 OK

---

## Rate Limits

| Endpoint Group | Limit | Window |
|----------------|-------|--------|
| Authentication | 5-10 requests | 1-5 minutes |
| General API | 60 requests | 1 minute |
| Webhooks | Unlimited | - |

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Invalid request data |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 422 | Validation Error - Invalid input data |
| 423 | Locked - Resource locked |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |

---

**For more information**:
- **Quick Start Examples**: See [README.md](README.md) for step-by-step API usage
- **Authentication Details**: See [32-authentication-api.md](32-authentication-api.md) for the auth endpoints, and [../20-features/21-authentication.md](../20-features/21-authentication.md) for the flow
- **OpenAPI Specification**: `storage/api-docs/api-docs.json` (generated; served at `/api/documentation` in local/development only)
- **System Overview**: See [../INDEX.md](../INDEX.md)
