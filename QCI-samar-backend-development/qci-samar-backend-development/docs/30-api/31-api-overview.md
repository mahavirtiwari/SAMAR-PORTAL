---
title: "API Overview"
category: "api"
tags: ["api", "rest", "authentication", "error-handling", "rate-limiting", "camelCase", "snake_case", "case-conversion"]
related:
  - 32-authentication-api.md
  - 37-api-reference.md
  - ../20-features/21-authentication.md
code_files:
  - app/Http/Controllers/BaseController.php
  - app/Http/Middleware/ConvertRequestToSnakeCase.php
  - app/Http/Middleware/ConvertResponseToCamelCase.php
  - app/Support/CaseConverter.php
  - routes/api.php
last_updated: "2025-01-26"
version: "2.1"
---

# API Overview

**Location**: `docs/30-api/31-api-overview.md`
**Related**: [Authentication API](32-authentication-api.md) | [API Reference](37-api-reference.md)

## Overview

The QCI SAMAR backend provides a **RESTful API** for all system functionality.

> **IMPORTANT USER MANAGEMENT CONSTRAINTS**:
> - ✅ **Users CANNOT be deleted** - Use deactivate endpoint instead
> - ✅ **User roles CANNOT be changed** - Roles assigned only during user creation
> - ✅ **No role update endpoint** - `PATCH /api/v1/users/{id}/roles` has been removed

### Base URL

```
Development: http://localhost:8000/api
```

See `.webority/infra.json` for the current staging host (no production environment exists).

---

## Authentication

All API requests (except public endpoints) require **JWT authentication**.

### Include Token in Requests

```http
GET /api/applications
Authorization: Bearer {your_jwt_token}
```

See [Authentication API](32-authentication-api.md) for login/registration.

---

## Case Conversion (camelCase ↔ snake_case)

> **⚡ IMPORTANT**: The API supports flexible naming conventions!

The QCI SAMAR API automatically handles case conversion between frontend JavaScript conventions (camelCase) and backend PHP conventions (snake_case).

### How It Works

**Incoming Requests** (Your Input):
- ✅ **camelCase supported**: `firstName`, `emailAddress`, `organizationName`
- ✅ **snake_case supported**: `first_name`, `email_address`, `organization_name`
- ✅ **Both work equally**: Use whichever format your client prefers!

**Outgoing Responses** (API Output):
- 🔄 **Always camelCase**: All response keys are automatically converted to camelCase
- 📱 **JavaScript-friendly**: Perfect for React, Angular, Vue.js, etc.

### Example: Both Formats Work

**Request with camelCase** (recommended for JavaScript clients):
```json
POST /api/v1/users
{
  "firstName": "John",
  "lastName": "Doe",
  "emailAddress": "john@example.com",
  "phoneNumber": "+91-9876543210"
}
```

**Request with snake_case** (traditional backend format):
```json
POST /api/v1/users
{
  "first_name": "John",
  "last_name": "Doe",
  "email_address": "john@example.com",
  "phone_number": "+91-9876543210"
}
```

**Response** (always camelCase):
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": 42,
    "firstName": "John",
    "lastName": "Doe",
    "emailAddress": "john@example.com",
    "phoneNumber": "+91-9876543210",
    "createdAt": "2025-01-26T10:30:00Z",
    "updatedAt": "2025-01-26T10:30:00Z"
  }
}
```

### Implementation Details

**Middleware Stack**:
1. `ConvertRequestToSnakeCase` - Converts incoming camelCase → snake_case
2. *(Your controller logic runs with snake_case data)*
3. `ConvertResponseToCamelCase` - Converts outgoing snake_case → camelCase

**Code References**:
- [`ConvertRequestToSnakeCase.php`](../../app/Http/Middleware/ConvertRequestToSnakeCase.php)
- [`ConvertResponseToCamelCase.php`](../../app/Http/Middleware/ConvertResponseToCamelCase.php)
- [`CaseConverter.php`](../../app/Support/CaseConverter.php) - Utility class
- [`bootstrap/app.php`](../../bootstrap/app.php#L31-L32) - Middleware registration

### Nested Objects & Arrays

Case conversion works recursively for nested structures:

**Request**:
```json
{
  "organizationInfo": {
    "companyName": "ABC Corp",
    "contactDetails": {
      "primaryEmail": "contact@abc.com",
      "phoneNumbers": ["+91-1234567890"]
    }
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "organizationInfo": {
      "companyName": "ABC Corp",
      "contactDetails": {
        "primaryEmail": "contact@abc.com",
        "phoneNumbers": ["+91-1234567890"]
      }
    }
  }
}
```

### Why This Matters

**Frontend Developers**: Use camelCase (matches JavaScript conventions)
```javascript
const user = {
  firstName: "John",
  emailAddress: "john@example.com"
};
```

**Backend Developers**: Internally uses snake_case (matches PHP/Laravel conventions)
```php
$user = [
  'first_name' => 'John',
  'email_address' => 'john@example.com'
];
```

### Best Practice

**Recommendation**: Use **camelCase** in your API requests for consistency with JavaScript/TypeScript frontends.

---

## Request Format

### Headers

**Required**:
```
Authorization: Bearer {token}
Content-Type: application/json
Accept: application/json
```

**Optional**:
```
X-Request-ID: {unique-request-id}
X-Client-Version: {app-version}
```

### JSON Body (camelCase recommended)

```json
{
  "fieldName": "value1",
  "anotherField": "value2"
}
```

---

## Response Format

### Success Response

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    "id": 1,
    "name": "Resource name"
  }
}
```

### Paginated Response

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "current_page": 1,
    "per_page": 15,
    "total": 150,
    "last_page": 10,
    "from": 1,
    "to": 15
  },
  "links": {
    "first": "https://api.qci-samar.in/api/applications?page=1",
    "last": "https://api.qci-samar.in/api/applications?page=10",
    "prev": null,
    "next": "https://api.qci-samar.in/api/applications?page=2"
  }
}
```

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "message": "Error message",
  "errors": {
    "field_name": ["Validation error message"]
  },
  "code": "ERROR_CODE",
  "status": 400
}
```

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| **200** | OK | Request successful |
| **201** | Created | Resource created successfully |
| **204** | No Content | Successful delete, no content |
| **400** | Bad Request | Invalid request format |
| **401** | Unauthorized | Missing or invalid authentication |
| **403** | Forbidden | Insufficient permissions |
| **404** | Not Found | Resource not found |
| **422** | Unprocessable Entity | Validation failed |
| **429** | Too Many Requests | Rate limit exceeded |
| **500** | Internal Server Error | Server error |
| **503** | Service Unavailable | Service temporarily unavailable |

### Common Error Codes

| Error Code | Description |
|-----------|-------------|
| `UNAUTHENTICATED` | No valid authentication token |
| `UNAUTHORIZED` | Insufficient permissions |
| `VALIDATION_ERROR` | Request validation failed |
| `RESOURCE_NOT_FOUND` | Requested resource doesn't exist |
| `INVALID_TRANSITION` | State transition not allowed |
| `PAYMENT_REQUIRED` | Payment required to proceed |
| `RATE_LIMIT_EXCEEDED` | Too many requests |

### Validation Errors

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "email": [
      "The email field is required."
    ],
    "password": [
      "The password must be at least 8 characters."
    ]
  },
  "status": 422
}
```

---

## Pagination

### Default Pagination

- **Per Page**: 15 items (default)
- **Max Per Page**: 100 items

### Pagination Parameters

```http
GET /api/applications?page=2&per_page=20
```

**Parameters**:
- `page` - Page number (default: 1)
- `per_page` - Items per page (default: 15, max: 100)

---

## Filtering & Sorting

### Filtering

```http
GET /api/applications?status=draft&organization_id=5&created_after=2025-01-01
```

### Sorting

```http
GET /api/applications?sort=created_at&direction=desc
```

**Parameters**:
- `sort` - Field to sort by
- `direction` - `asc` or `desc` (default: `asc`)

### Search

```http
GET /api/applications?search=quality+management
```

---

## Rate Limiting

### Default Limits

- **Authenticated Requests**: 300 requests per minute per user (sized for the assessor app flushing a day of offline captures)
- **Unauthenticated Requests**: 100 requests per minute per IP
- **Password-verifying endpoints** (`auth/change-password`, `auth/2fa/disable`): 5 requests per minute per user
- **Login, registration, OTP, password reset, refresh**: their own per-IP limits (see `AppServiceProvider::configureRateLimiting`)
- **Webhook Endpoints**: No limit

### Rate Limit Headers

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1641024000
```

### Rate Limit Exceeded

```json
{
  "success": false,
  "message": "Too many requests",
  "retry_after": 45,
  "status": 429
}
```

---

## Versioning

### Current Version

**API Version**: `v1`

### Version in URL

```http
GET /api/v1/applications
```

Currently, version is optional (defaults to v1).

---

## CORS

### Allowed Origins

**Production**: `https://app.qci-samar.in`
**Staging**: `https://staging.qci-samar.in`
**Development**: `http://localhost:3000`, `http://localhost:4200`

### CORS Headers

```
Access-Control-Allow-Origin: https://app.qci-samar.in
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type, Accept
```

---

## File Uploads

### Upload Endpoint

```http
POST /api/documents
Content-Type: multipart/form-data
Authorization: Bearer {token}

file: (binary)
documentable_type: application
documentable_id: 101
document_type: incorporation_certificate
```

### File Constraints

- **Max Size**: 10 MB (configurable)
- **Allowed Types**: PDF, JPG, PNG, DOC, DOCX, XLS, XLSX, ZIP
- **Virus Scanning**: Enabled (if configured)

### Upload Response

```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "data": {
    "id": 301,
    "uuid": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "name": "Incorporation Certificate",
    "original_filename": "certificate.pdf",
    "file_path": "documents/2025/01/f47ac10b...pdf",
    "size": 2457600,
    "mime_type": "application/pdf",
    "download_url": "/api/documents/301/download"
  }
}
```

---

## Webhooks

### Supported Webhooks

- **Payment Webhooks**: ICICI EazyPay
- **Notification Webhooks**: Email delivery status

### Webhook Security

All webhooks verify signatures:

```php
$signature = hash_hmac('sha256', $payload, $webhookSecret);
if ($signature !== $receivedSignature) {
    abort(401, 'Invalid webhook signature');
}
```

---

## Common Patterns

### Resource URLs

```
GET    /api/resources          - List resources
POST   /api/resources          - Create resource
GET    /api/resources/{id}     - View resource
PUT    /api/resources/{id}     - Update resource (full)
PATCH  /api/resources/{id}     - Update resource (partial)
DELETE /api/resources/{id}     - Delete resource
```

### Nested Resources

```
GET /api/v1/applications/101/files/{field}   - Download an application file
```

### Actions on Resources

```
POST /api/v1/applications/101/submit         - Submit application
POST /api/v1/assessments/75/start            - Start assessment
```

---

## Best Practices

### 1. Always Include Authorization

```http
GET /api/applications
Authorization: Bearer {token}
```

### 2. Set Content-Type for JSON

```http
POST /api/applications
Content-Type: application/json
Authorization: Bearer {token}

{"title": "Application Title"}
```

### 3. Handle Errors Gracefully

```javascript
fetch('/api/applications', {
    method: 'GET',
    headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/json'
    }
})
.then(response => {
    if (!response.ok) {
        throw new Error('API request failed');
    }
    return response.json();
})
.then(data => {
    console.log(data);
})
.catch(error => {
    console.error('Error:', error);
});
```

### 4. Use Pagination

```http
GET /api/applications?page=1&per_page=20
```

### 5. Implement Retry Logic

For 429 (rate limit) and 5xx errors, implement exponential backoff retry.

---

## Testing the API

### Using cURL

```bash
# Login
curl -X POST https://api.qci-samar.in/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Get applications (with token)
curl -X GET https://api.qci-samar.in/api/applications \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: application/json"
```

### Using Postman

Import Swagger/OpenAPI spec:
```
https://api.qci-samar.in/api/documentation/json
```

---

## Swagger/OpenAPI Documentation

### Interactive API Docs

```
https://api.qci-samar.in/api/documentation
```

### OpenAPI JSON

```
https://api.qci-samar.in/api/documentation/json
```

---

## API Endpoints Summary

| Module | Endpoints | Documentation |
|--------|-----------|---------------|
| **Authentication** | `/api/auth/*` | [Auth API](32-authentication-api.md) |
| **Applications** | `/api/applications/*` | [Application API](33-application-api.md) |
| **Assessments** | `/api/assessments/*` | [Assessment API](34-assessment-api.md) |
| **Certificates** | `/api/certificates/*` | [Certificate API](35-certificate-api.md) |
| **Payments** | `/api/payments/*` | [Payment API](36-payment-api.md) |
| **Users** | `/api/users/*` | [API Reference](37-api-reference.md#user-management-endpoints) |
| **Organizations** | `/api/organizations/*` | [API Reference](37-api-reference.md#organization-endpoints) |

---

## See Also

- [Authentication API](32-authentication-api.md) - Login, registration, token management
- [API Reference](37-api-reference.md) - Complete endpoint listing
- [Authentication](../20-features/21-authentication.md) - Authentication system details

**Code References**:
- [`BaseController`](../../app/Http/Controllers/BaseController.php) - API response helpers
- [`routes/api.php`](../../routes/api.php) - All API routes
