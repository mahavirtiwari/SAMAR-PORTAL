---
title: "Token Validation & Security"
category: "features"
tags: ["authentication", "security", "jwt", "tokens", "middleware"]
related:
  - 21-authentication.md
  - 22-authorization-rbac.md
  - ../30-api/32-authentication-api.md
  - ../40-development/44-testing-guide.md
last_updated: "2026-07-21"
version: "1.1"
---

# Token Validation & Security

**Location**: `docs/20-features/25-token-validation.md`

## Overview

The QCI Samar system implements comprehensive token validation to ensure secure authentication and prevent token misuse. The system uses two distinct token types:

- **Access Tokens**: Short-lived JWT tokens (15 minutes) for API authentication
- **Refresh Tokens**: Tokens valid for 2 hours (120 minutes) for obtaining new access tokens

---

## Token Types

### Access Tokens (JWT)

**Technology**: JSON Web Tokens (JWT)
**Duration**: 15 minutes (`config/jwt.php` `ttl`, OWASP-recommended default; configurable via `JWT_TTL`)
**Format**: JWT with signature
**Usage**: Authenticate API requests
**Storage**: Bearer token in Authorization header

**Example**:
```
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

### Refresh Tokens

**Technology**: Random secure string (64 characters, `Str::random(64)`)
**Duration**: 2 hours / 120 minutes (`config/jwt.php` `refresh_ttl`, configurable via `JWT_REFRESH_TTL`)
**Format**: Random alphanumeric string
**Usage**: Obtain new access tokens
**Storage**: Database (`sessions` table)

**Example**:
```json
{
  "refresh_token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6..."
}
```

---

## Token Validation Middleware

### ValidateTokenType Middleware

**Location**: `app/Http/Middleware/ValidateTokenType.php`

The middleware validates that the correct token type is used for each endpoint:

#### For Refresh Endpoints (`validate.token.type:refresh`)

✅ Validates `refresh_token` parameter exists
✅ Verifies token exists in `sessions` table
✅ Checks `token_type = 'refresh'`
✅ Ensures session is active (`is_active = true`)
✅ Validates token hasn't expired

**Applied to**: `/api/v1/auth/refresh`

#### For Protected Endpoints (`validate.token.type:access`)

✅ Validates `Authorization` header exists
✅ Extracts token from `Bearer <token>` format
✅ Ensures token is NOT a refresh token
✅ Prevents refresh token abuse on API endpoints

**Applied to**: All authenticated routes (`auth:api` middleware group)

---

## Security Features

### 1. Token Type Segregation

**Problem Prevented**: Users attempting to use refresh tokens for API calls or access tokens for token refresh

**Implementation**:
```php
// Refresh tokens can ONLY be used here
Route::post('/refresh', [...])->middleware('validate.token.type:refresh');

// Access tokens required for all other endpoints
Route::middleware(['auth:api', 'validate.token.type:access'])->group([...]);
```

### 2. Database-Backed Validation

Refresh tokens are validated against the database to ensure:
- Token exists and is active
- Token hasn't been revoked
- Session is still valid
- Token hasn't expired

### 3. Session Tracking

Every token (access and refresh) is tracked in the `sessions` table:

```php
'session_id'           // Unique session identifier (UUID)
'user_id'              // Associated user
'token'                // Full token value (access JWT or refresh string — not truncated)
'token_type'           // 'access' or 'refresh'
'expires_at'           // Token expiration timestamp
'is_active'            // Session status
'ip_address'           // Client IP
'user_agent'           // Client user agent
'device_type'          // web, tablet, mobile, ios, android
'device_id'            // Optional client-supplied device identifier
'last_activity_at'     // Used for the web idle-timeout check
'started_at' / 'ended_at'
'termination_reason'   // logout, new_session, expired, idle_timeout, password_reset, organization_inactive, ...
```

### 4. Single Session Enforcement

Every role except `erp_integration` has `enforce_single_session = true` (`RoleSeeder`). Enforcement is **device-class scoped**, not global — a new login only terminates other sessions of the **same class**:
- **mobile class**: `device_type` of `ios` or `android`
- **web class**: everything else (`web`, `tablet`, browser `mobile`)

So one web session and one mobile-app session can be active for the same user at once; a second web login ends the first web session but leaves the mobile session untouched. Web sessions additionally idle-time-out after `auth.session.idle_timeout_minutes` (default 60 minutes) of no access-token activity, checked on refresh; mobile is exempt.

### 5. Automatic Expiry

**Access Tokens**:
- Expire after 15 minutes
- Validated by JWT library
- Must be refreshed for continued access

**Refresh Tokens**:
- Expire after 2 hours (120 minutes)
- Validated against database `expires_at`
- Rotated on every use (old row terminated, new pair issued) — not "cleaned up", replaced

---

## Token Lifecycle

### 1. Login

```mermaid
sequenceDiagram
    Client->>API: POST /api/v1/auth/login
    API->>Database: Create user session
    API->>Client: Return access_token + refresh_token
```

**Response**:
```json
{
  "success": true,
  "data": {
    "access_token": "eyJ0eXAi...",
    "refresh_token": "a1b2c3d4...",
    "token_type": "Bearer",
    "expires_in": 900
  }
}
```

### 2. API Access

```mermaid
sequenceDiagram
    Client->>API: GET /api/v1/resource
    Note over Client,API: Authorization: Bearer {access_token}
    API->>Middleware: ValidateTokenType:access
    Middleware->>Database: Check if token is refresh token
    Database-->>Middleware: Not a refresh token ✓
    Middleware->>API: Allow request
    API->>Client: Return resource data
```

### 3. Token Refresh

```mermaid
sequenceDiagram
    Client->>API: POST /api/v1/auth/refresh
    Note over Client,API: Body: { refresh_token: "..." }
    API->>Middleware: ValidateTokenType:refresh
    Middleware->>Database: Validate refresh token
    Database-->>Middleware: Valid and active ✓
    API->>Database: Create new access token session
    API->>Client: Return new access_token
```

**Response** (a new refresh token is issued too — the old one is retired, not reusable):
```json
{
  "success": true,
  "data": {
    "access_token": "eyJ0eXAi...",
    "refresh_token": "b2c3d4e5...",
    "token_type": "Bearer",
    "access_token_expiration": "2026-07-21T10:15:00+05:30",
    "refresh_token_expiration": "2026-07-21T12:00:00+05:30"
  }
}
```

### 4. Logout

```mermaid
sequenceDiagram
    Client->>API: POST /api/v1/auth/logout
    API->>JWT: Invalidate access token
    API->>Database: Terminate session
    API->>Client: Logout successful
```

---

## Error Responses

### Refresh Token Errors

#### Invalid or Expired Refresh Token
```json
{
  "success": false,
  "message": "Invalid or expired refresh token."
}
```
**Status**: 401 Unauthorized

#### Missing Refresh Token
```json
{
  "success": false,
  "message": "Refresh token is required."
}
```
**Status**: 401 Unauthorized

### Access Token Errors

#### Refresh Token Used on API Endpoint
```json
{
  "success": false,
  "message": "Refresh tokens cannot be used for API requests. Please use an access token."
}
```
**Status**: 403 Forbidden

#### Missing Authorization Header
```json
{
  "success": false,
  "message": "Authorization header is missing."
}
```
**Status**: 401 Unauthorized

#### Invalid Token Format
```json
{
  "success": false,
  "message": "Invalid authorization token format."
}
```
**Status**: 401 Unauthorized

---

## Configuration

### JWT Configuration

**File**: `config/jwt.php`

```php
'ttl' => (int) env('JWT_TTL', 15),           // Access token lifetime (minutes)
'refresh_ttl' => (int) env('JWT_REFRESH_TTL', 120), // Refresh token lifetime (minutes) — actively used
```

### Session Configuration

**Refresh Token Duration**: driven by `config('jwt.refresh_ttl')`, not hardcoded:
```php
// app/Services/Auth/AuthService.php — generateRefreshToken()
'expires_at' => now()->addMinutes((int) config('jwt.refresh_ttl')),
```

**Idle timeout (web sessions only)**: `auth.session.idle_timeout_minutes` (default 60), checked in `AuthService::refreshToken()`.

---

## Best Practices

### For Frontend Developers

1. **Store tokens securely**
   - Use `httpOnly` cookies or secure storage
   - Never store in localStorage for sensitive apps
   - Clear tokens on logout

2. **Handle token refresh**
   ```javascript
   // When access token expires (401)
   const refreshResponse = await fetch('/api/v1/auth/refresh', {
     method: 'POST',
     body: JSON.stringify({ refresh_token: storedRefreshToken })
   });

   const { access_token } = await refreshResponse.json();
   // Retry original request with new token
   ```

3. **Use correct token types**
   - Access token → All API calls (in Authorization header)
   - Refresh token → Only for `/refresh` endpoint (in request body)

4. **Handle expired refresh tokens**
   - If refresh fails → Redirect to login
   - Don't retry indefinitely

### For Backend Developers

1. **Always use middleware**
   ```php
   // ✅ Correct
   Route::post('/refresh', [...])->middleware('validate.token.type:refresh');

   // ❌ Incorrect (no validation)
   Route::post('/refresh', [...]);
   ```

2. **Validate before processing**
   - Middleware validates before controller logic
   - Fail fast on invalid tokens

3. **Log security events**
   - Failed token validation attempts
   - Refresh token usage
   - Session terminations

---

## Testing

### Automated Tests

There is no dedicated token-validation test suite (`tests/Feature/Auth/TokenValidationTest.php` does not exist). The closest existing coverage is `tests/Feature/AuthAuditLogTest.php`.

### Manual Testing

**Quick Test** (login is 2FA-optional — this assumes the account has 2FA disabled, see [Authentication](21-authentication.md)):
```bash
# 1. Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"samar_id":"SAMAR-040226-1","password":"password"}'

# 2. Try using refresh token on API endpoint (should fail)
curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer {refresh_token}"
# Expected: 403 Forbidden

# 3. Use access token (should succeed)
curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer {access_token}"
# Expected: 200 OK
```

---

## Security Considerations

### Potential Threats Mitigated

✅ **Token Substitution**: Refresh tokens cannot be used as access tokens
✅ **Token Theft**: Expired tokens are rejected
✅ **Session Hijacking**: Single-session enforcement (device-class scoped) for every role except `erp_integration`
✅ **Replay Attacks**: Database validation ensures token authenticity
✅ **Token Reuse**: Inactive sessions are rejected; refresh tokens are rotated on every use, not reusable

### Remaining Considerations

⚠️ **Token Storage**: Frontend must securely store tokens
⚠️ **HTTPS Required**: Tokens transmitted over secure connections
⚠️ **Rate Limiting**: Login/OTP endpoints are throttled (see [Authentication](21-authentication.md)); confirm the refresh endpoint has an equivalent limit

---

## Implementation Details

### Middleware Registration

**File**: `bootstrap/app.php`

```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->alias([
        'validate.token.type' => \App\Http\Middleware\ValidateTokenType::class,
        // ... other middleware
    ]);
})
```

### Route Protection

**File**: `routes/api.php`

```php
// Refresh endpoint - requires refresh token
Route::post('/refresh', [LoginController::class, 'refresh'])
    ->middleware('validate.token.type:refresh');

// All authenticated routes - requires access token
Route::middleware(['auth:api', 'validate.token.type:access'])->group(function () {
    // Protected routes here
});
```

---

## Troubleshooting

### Token Validation Fails Unexpectedly

1. **Check JWT secret**: `php artisan jwt:secret`
2. **Verify database**: Ensure `sessions` table exists
3. **Check token format**: Must be `Bearer <token>`
4. **Review logs**: `storage/logs/laravel.log`

### Refresh Token Always Invalid

1. **Check database**: Query `sessions` table for token
2. **Verify expiry**: Check `expires_at` timestamp
3. **Check active status**: Ensure `is_active = true`
4. **Token format**: Ensure exact token string (no whitespace)

### Access Token Rejected as Refresh Token

This shouldn't happen. If it does:
1. Check if token is stored in `sessions` table with `token_type = 'refresh'`
2. Review `AuthService::generateRefreshToken()` logic

(Note: `ValidateTokenType` stores/compares the full token value — its own source comment mentioning "first 50 characters" is stale and doesn't reflect what's actually stored.)

---

## See Also

- [Authentication](21-authentication.md) - Authentication system overview
- [Authorization & RBAC](22-authorization-rbac.md) - Role-based access control
- [Authentication API](../30-api/32-authentication-api.md) - API endpoints
- [Security Best Practices](../10-architecture/11-system-architecture.md#security-architecture) - General security
