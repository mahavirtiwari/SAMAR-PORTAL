---
title: "Authentication API"
category: "api"
tags: ["api", "authentication", "jwt", "login", "registration"]
related:
  - 31-api-overview.md
  - ../20-features/21-authentication.md
code_files:
  - app/Http/Controllers/Api/V1/Auth/LoginController.php
  - app/Http/Controllers/Api/V1/Auth/RegisterController.php
  - app/Http/Controllers/Api/V1/Auth/PasswordController.php
  - app/Http/Controllers/Api/V1/Auth/TwoFactorController.php
last_updated: "2025-01-05"
version: "1.0"
---

# Authentication API

**Location**: `docs/30-api/32-authentication-api.md`
**Related**: [API Overview](31-api-overview.md) | [Authentication](../20-features/21-authentication.md)

## Overview

Authentication endpoints for **login, registration, token management, and user profile**.

**Base Path**: `/api/v1/auth`

---

## Endpoints

### 1. Register

Creates a new organization and its enterprise admin user. The password is system-generated and emailed; the account must complete OTP verification before it can log in.

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "organization_name": "ABC Manufacturing Pvt Ltd",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "mobile_number": "9876543210"
}
```

**Success Response** (201):
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

### 2. Login

Step 1 of 2FA login: validates credentials and emails an OTP. Complete the login with `POST /api/v1/auth/verify-login-otp` using the returned `session_token`.

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "samar_id": "SAMAR-040226-1",
  "password": "SecurePass123!"
}
```

**Success Response** (200):
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

### 3. Logout

```http
POST /api/v1/auth/logout
Authorization: Bearer {token}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### 4. Refresh Token

Refresh tokens rotate on every use — the presented one is retired and a new pair is issued.

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "token_type": "Bearer",
    "access_token_expiration": "2025-01-15T11:30:00+05:30",
    "refresh_token_expiration": "2025-01-29T10:30:00+05:30"
  }
}
```

---

### 5. Get Current User

```http
GET /api/v1/auth/me
Authorization: Bearer {token}
```

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "id": 101,
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone": "+919876543210",
    "organization": {
      "id": 5,
      "name": "ABC Manufacturing Pvt Ltd"
    },
    "roles": [
      {
        "id": 1,
        "slug": "enterprise_admin",
        "name": "Enterprise Administrator",
        "is_active": true
      }
    ],
    "permissions": [
      "applications.create",
      "applications.view_own",
      "applications.update_own"
    ]
  }
}
```

---

### 6. Forgot Password

```http
POST /api/v1/auth/forgot-password
Content-Type: application/json

{
  "samar_id": "SAMAR-040226-1"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Password reset OTP has been sent to your email. Valid for 2 minutes."
}
```

---

### 7. Reset Password

```http
POST /api/v1/auth/reset-password
Content-Type: application/json

{
  "samar_id": "SAMAR-040226-1",
  "otp": "123456",
  "password": "NewSecurePass123!",
  "password_confirmation": "NewSecurePass123!"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Password has been reset successfully. Please login with your new password."
}
```

---

### 8. Change Password

```http
POST /api/v1/auth/change-password
Authorization: Bearer {token}
Content-Type: application/json

{
  "current_password": "OldPass123!",
  "new_password": "NewPass456!",
  "new_password_confirmation": "NewPass456!"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

## Error Responses

### Invalid Credentials (401)

```json
{
  "success": false,
  "message": "Invalid credentials",
  "status": 401
}
```

### Validation Error (422)

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "email": ["The email field is required."],
    "password": ["The password must be at least 8 characters."]
  },
  "status": 422
}
```

### Token Expired (401)

```json
{
  "success": false,
  "message": "Token has expired",
  "status": 401
}
```

---

## Request/Response Examples

### Complete Login Flow

**1. Login**:
```bash
curl -X POST https://api.qci-samar.in/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "samar_id": "SAMAR-040226-1",
    "password": "SecurePass123!"
  }'
```

**2. Use Token**:
```bash
curl -X GET https://api.qci-samar.in/api/v1/applications \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGci..."
```

**3. Refresh Token (before expiry)**:
```bash
curl -X POST https://api.qci-samar.in/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGci..."}'
```

**4. Logout**:
```bash
curl -X POST https://api.qci-samar.in/api/v1/auth/logout \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGci..."
```

---

## See Also

- [API Overview](31-api-overview.md) - API basics
- [Authentication](../20-features/21-authentication.md) - Authentication system details

**Code Reference**:
- [`LoginController`](../../app/Http/Controllers/Api/V1/Auth/LoginController.php)
- [`RegisterController`](../../app/Http/Controllers/Api/V1/Auth/RegisterController.php)
- [`PasswordController`](../../app/Http/Controllers/Api/V1/Auth/PasswordController.php)
