---
title: "System Architecture"
category: "architecture"
tags: ["architecture", "design", "layers", "multi-tenancy", "services"]
related:
  - 12-database-schema.md
  - 13-state-machines.md
  - 14-design-patterns.md
  - ../20-features/22-authorization-rbac.md
code_files:
  - app/Http/Kernel.php
  - app/Providers/AppServiceProvider.php
  - bootstrap/app.php
last_updated: "2026-07-22"
version: "1.0"
---

# System Architecture

**Location**: `docs/10-architecture/11-system-architecture.md`
**Related**: [Database Schema](12-database-schema.md) | [State Machines](13-state-machines.md) | [Design Patterns](14-design-patterns.md)

---

## Overview

The QCI SAMAR Certification Portal backend is built as a modern, layered RESTful API using Laravel 12 and PHP 8.4+. The system implements multi-tenant architecture with organization-level data isolation, role-based access control, and state machine-driven workflows for managing the complete certification lifecycle.

**Key Characteristics**:
- **Architecture Style**: Layered, service-oriented
- **API Style**: RESTful JSON API
- **Multi-Tenancy**: Organization-level data scoping
- **Authentication**: JWT with refresh tokens
- **Authorization**: Role-Based Access Control (RBAC)
- **State Management**: Configuration-driven state machines
- **Data Layer**: Eloquent ORM with MySQL 8.0+

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  Frontend (React/Vue) │ Mobile App │ Third-party Integrations    │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS/TLS
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                      API GATEWAY LAYER                           │
│                    Nginx / Load Balancer                         │
│              SSL Termination │ Rate Limiting                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                     APPLICATION LAYER                            │
│                      Laravel 12 API                              │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │                    Routing Layer                            │ │
│ │  routes/api.php - RESTful endpoints with versioning        │ │
│ └────────────────────┬───────────────────────────────────────┘ │
│                      │                                           │
│ ┌────────────────────▼───────────────────────────────────────┐ │
│ │                  Middleware Layer                          │ │
│ │  ├─ Authentication (JWT)                                   │ │
│ │  ├─ Authorization (RBAC: roles, permissions)               │ │
│ │  ├─ CORS                                                   │ │
│ │  ├─ Rate Limiting                                          │ │
│ │  ├─ Security Headers (HSTS, CSP, X-Frame-Options)         │ │
│ │  ├─ Request Validation                                     │ │
│ │  └─ Multi-Tenant Scoping                                   │ │
│ └────────────────────┬───────────────────────────────────────┘ │
│                      │                                           │
│ ┌────────────────────▼───────────────────────────────────────┐ │
│ │                  Controller Layer                          │ │
│ │  RESTful Controllers in app/Http/Controllers/Api/V1/       │ │
│ │  ├─ Request validation (Form Requests)                    │ │
│ │  ├─ Business logic delegation (to Services)               │ │
│ │  ├─ Response formatting (API Resources)                   │ │
│ │  └─ Error handling                                         │ │
│ └────────────────────┬───────────────────────────────────────┘ │
│                      │                                           │
│ ┌────────────────────▼───────────────────────────────────────┐ │
│ │                   Service Layer                            │ │
│ │  Business Logic Services in app/Services/                 │ │
│ │  ├─ AuthService (680+ lines) - Complete auth logic        │ │
│ │  ├─ NotificationService - Multi-channel notifications     │ │
│ │  ├─ PaymentGatewayFactory - Payment processing            │ │
│ │  ├─ ApplicationStateMachine - application workflow        │ │
│ │  ├─ AssessmentStateMachine - assessment workflow          │ │
│ │  └─ Custom business logic                                 │ │
│ └────────────────────┬───────────────────────────────────────┘ │
│                      │                                           │
│ ┌────────────────────▼───────────────────────────────────────┐ │
│ │                Authorization Layer                         │ │
│ │  Laravel Policies in app/Policies/                        │ │
│ │  ├─ ApplicationPolicy - Application authorization          │ │
│ │  ├─ AssessmentPolicy - Assessment authorization            │ │
│ │  └─ OrganizationPolicy - Organization authorization        │ │
│ └────────────────────┬───────────────────────────────────────┘ │
│                      │                                           │
│ ┌────────────────────▼───────────────────────────────────────┐ │
│ │                    Model Layer                             │ │
│ │  Eloquent Models in app/Models/                            │ │
│ │  ├─ Relationships (50+ defined)                            │ │
│ │  ├─ Scopes (query filtering)                               │ │
│ │  ├─ Traits (cross-cutting concerns)                        │ │
│ │  ├─ Business methods                                       │ │
│ │  └─ Accessors/Mutators                                     │ │
│ └────────────────────┬───────────────────────────────────────┘ │
│                      │                                           │
└──────────────────────┼───────────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────────┐
│                    DATA LAYER                                 │
│              MySQL 8.0+ Database                              │
│  ├─ Tables with indexes                                       │
│  ├─ Foreign key constraints                                  │
│  ├─ Soft deletes                                             │
│  ├─ Timestamps                                               │
│  └─ Full-text search indexes (planned)                       │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│                  EXTERNAL SERVICES                             │
│  ├─ Payment Gateway (ICICI EazyPay)                         │
│  ├─ Email Service (SMTP/SendGrid/AWS SES)                    │
│  ├─ File Storage (AWS S3/Azure Blob)                         │
│  └─ Support Tickets (Zoho Desk API)                          │
└───────────────────────────────────────────────────────────────┘
```

---

## Architectural Layers

### 1. Routing Layer

**Purpose**: Map HTTP requests to controllers

**Location**: `routes/api.php`

**Features**:
- RESTful endpoint design
- API versioning (v1)
- Route grouping by module
- Middleware application
- Route model binding

**Example**:
```php
// routes/api.php
Route::prefix('v1')->group(function () {
    // Authentication routes (public)
    Route::prefix('auth')->group(function () {
        Route::post('register', [RegisterController::class, 'register']);
        Route::post('login', [LoginController::class, 'login']);
    });

    // Protected routes
    Route::middleware('auth:api')->group(function () {
        // Applications (with RBAC)
        Route::middleware('permission:view-applications')
            ->get('applications', [ApplicationController::class, 'index']);
    });
});
```

**Total Routes**: 50+ API endpoints

**Code Reference**: [`routes/api.php`](../../routes/api.php)

---

### 2. Middleware Layer

**Purpose**: Request/response processing pipeline

**Location**: `app/Http/Middleware/`, `bootstrap/app.php`

**Middleware Stack**:

#### Global Middleware (Applied to All Requests)
1. **TrustProxies** - Handle proxy headers
2. **PreventRequestsDuringMaintenance** - Maintenance mode
3. **ValidatePostSize** - Request size validation
4. **TrimStrings** - Trim input strings
5. **ConvertEmptyStringsToNull** - Normalize empty values

#### API Middleware Group
1. **ForceJsonResponse** - Ensure JSON responses
2. **SecurityHeaders** - Add security headers (HSTS, CSP, etc.)
3. **ThrottleRequests** - Rate limiting
4. **SubstituteBindings** - Route model binding

#### Custom Middleware
1. **Authenticate (auth:api)** - JWT authentication
2. **CheckRole** - Role-based access (`role:admin`)
3. **CheckPermission** - Permission-based access (`permission:create-user`)
4. **VerifyCsrfToken** - CSRF protection (web routes)

**Security Headers Added**:
```php
// app/Http/Middleware/SecurityHeaders.php
'Strict-Transport-Security' => 'max-age=31536000; includeSubDomains',
'X-Content-Type-Options' => 'nosniff',
'X-Frame-Options' => 'SAMEORIGIN',
'X-XSS-Protection' => '1; mode=block',
'Referrer-Policy' => 'strict-origin-when-cross-origin',
'Content-Security-Policy' => "default-src 'self'",
'Permissions-Policy' => 'geolocation=(), microphone=(), camera=()'
```

**Rate Limiting Configuration**:
```env
RATE_LIMIT_LOGIN=20             # 20 attempts per minute per IP (code default)
RATE_LIMIT_REGISTER=3           # 3 attempts per 5 minutes
RATE_LIMIT_PASSWORD_RESET=3     # 3 attempts per 10 minutes
RATE_LIMIT_REFRESH=10           # 10 attempts per minute
```

**Code References**:
- [`app/Http/Middleware/CheckRoleMiddleware.php`](../../app/Http/Middleware/CheckRoleMiddleware.php)
- [`app/Http/Middleware/CheckPermissionMiddleware.php`](../../app/Http/Middleware/CheckPermissionMiddleware.php)
- [`bootstrap/app.php`](../../bootstrap/app.php)

---

### 3. Controller Layer

**Purpose**: Handle HTTP requests, delegate to services, format responses

**Location**: `app/Http/Controllers/Api/V1/`

**Design Principles**:
- ✅ Thin controllers - business logic in services
- ✅ RESTful naming (index, store, show, update, destroy)
- ✅ Form Request validation
- ✅ API Resource responses
- ✅ Consistent error handling

**Controllers**: see [`app/Http/Controllers/Api/V1/`](../../app/Http/Controllers/Api/V1/) for the current list.

**Example Controller**:
```php
class ApplicationController extends Controller
{
    public function __construct(
        private ApplicationStateMachine $stateMachine
    ) {}

    public function index(Request $request): JsonResponse
    {
        // Policy authorization (automatic via Eloquent)
        $applications = Application::query()
            ->with(['organization', 'unit', 'products'])
            ->filter($request->only(['status', 'type', 'search']))
            ->paginate($request->get('per_page', 15));

        return $this->successResponse(
            ApplicationResource::collection($applications),
            'Applications retrieved successfully'
        );
    }

    public function store(StoreApplicationRequest $request): JsonResponse
    {
        // Validation handled by Form Request
        $application = Application::create($request->validated());

        return $this->successResponse(
            new ApplicationResource($application),
            'Application created successfully',
            201
        );
    }

    public function submit(Application $application): JsonResponse
    {
        // Policy authorization
        $this->authorize('submit', $application);

        // Business logic in service/state machine
        $this->stateMachine->transition($application, 'submit');

        return $this->successResponse(
            new ApplicationResource($application->fresh()),
            'Application submitted successfully'
        );
    }
}
```

**Base Controller Helpers**:
```php
// app/Http/Controllers/Controller.php
protected function successResponse($data, string $message, int $statusCode = 200)
{
    return response()->json([
        'success' => true,
        'message' => $message,
        'data' => $data
    ], $statusCode);
}

protected function errorResponse(string $message, int $statusCode = 400, array $errors = [])
{
    return response()->json([
        'success' => false,
        'message' => $message,
        'errors' => $errors
    ], $statusCode);
}
```

---

### 4. Service Layer

**Purpose**: Encapsulate complex business logic

**Location**: `app/Services/`

**Services Implemented**:

#### AuthService (680+ lines)
**Responsibilities**:
- User registration with organization creation
- Login with JWT token generation
- OTP generation and verification
- Lockout protection (5 attempts, 30-minute lockout)
- Single session enforcement for sensitive roles
- Password reset flow
- Token refresh logic

**Key Methods**:
```php
public function register(array $data): array
{
    // Create organization + admin user atomically
    // Generate OTP
    // Send verification email
    return ['user' => $user, 'organization' => $org];
}

public function login(string $email, string $password): array
{
    // Validate credentials
    // Check email verification
    // Check OTP lockout
    // Enforce single session (if applicable)
    // Generate JWT tokens
    return ['access_token' => $token, 'refresh_token' => $refresh, 'user' => $user];
}

public function verifyOtp(string $email, string $otp): bool
{
    // Validate OTP code
    // Check expiry (10 minutes)
    // Increment attempts, apply lockout
    // Mark email as verified
}
```

**Code Reference**: [`app/Services/Auth/AuthService.php`](../../app/Services/Auth/AuthService.php)

---

#### NotificationService
**Responsibilities**:
- Email notification delivery
- Template-based rendering with variable substitution
- Event-driven notification sending
- Priority management
- Queue integration for async email delivery

**Key Methods**:
```php
public function send(int $userId, string $templateSlug, array $variables): void
{
    $template = NotificationTemplate::where('slug', $templateSlug)->first();
    $subject = $this->renderTemplate($template->subject, $variables);
    $body = $this->renderTemplate($template->body, $variables);

    // Send email notification
    $this->sendEmail($user->email, $subject, $body);

    // Log notification event
    NotificationEvent::create([
        'user_id' => $userId,
        'template_id' => $template->id,
        'subject' => $subject,
        'body' => $body,
        'sent_at' => now(),
    ]);
}

private function renderTemplate(string $template, array $variables): string
{
    // Blade template rendering
    return Blade::render($template, $variables);
}
```

**Note**: In-app notifications were removed in v3.0. System now supports email notifications only.

**Code Reference**: [`app/Services/Notification/NotificationService.php`](../../app/Services/Notification/NotificationService.php)

---

#### PaymentGatewayFactory & Adapters
**Responsibilities**:
- Abstract payment gateway operations
- Support ICICI EazyPay gateway
- Webhook signature verification
- Refund processing

**Architecture** (Adapter Pattern):

Authoritative source for the interface: `app/Contracts/PaymentGatewayInterface.php`

```php
class PaymentGatewayFactory
{
    public static function create(string $gateway): PaymentGatewayInterface
    {
        return match($gateway) {
            'icici_eazypay' => new ICICIEazyPayAdapter(),
            default => throw new InvalidArgumentException("Unsupported gateway: $gateway")
        };
    }
}
```

**ICICI EazyPay Implementation**:
```php
class ICICIEazyPayAdapter implements PaymentGatewayInterface
{
    public function initiatePayment(array $data): array
    {
        // Build 17 mandatory fields (pipe-separated)
        $mandatoryFields = implode('|', [
            $data['order_id'],           // Reference No
            $this->subMerchantId,        // Sub Merchant ID
            $data['amount'],             // Amount
            // ... 14 more fields from organization data
        ]);

        // Encrypt using AES-128-ECB
        $encrypted = $this->encrypt($mandatoryFields);

        return [
            'gateway_order_id' => $data['order_id'],
            'payment_url' => $this->baseUrl . '?' . http_build_query([...]),
            'amount' => $data['amount'],
            'currency' => 'INR'
        ];
    }

    public function verifyWebhookSignature(array $payload, string $signature, ?string $secret): bool
    {
        // SHA512 verification
        $signatureString = implode('|', [...fields...]);
        $expectedSignature = hash('sha512', $signatureString);
        return hash_equals($expectedSignature, $signature);
    }
}
```

**Code References**:
- [`app/Contracts/PaymentGatewayInterface.php`](../../app/Contracts/PaymentGatewayInterface.php)
- [`app/Services/Payment/PaymentGatewayFactory.php`](../../app/Services/Payment/PaymentGatewayFactory.php)
- [`app/Services/Payment/ICICIEazyPayAdapter.php`](../../app/Services/Payment/ICICIEazyPayAdapter.php)

---

#### StateMachine (Application & Assessment)
**Responsibilities**:
- Manage workflow state transitions
- Validate transitions with guard conditions
- Execute before/after hooks
- Dispatch state change events

**See Also**: [State Machines Documentation](13-state-machines.md)

**Code References**:
- [`app/Services/StateMachine/StateMachine.php`](../../app/Services/StateMachine/StateMachine.php)
- [`app/Services/StateMachine/ApplicationStateMachine.php`](../../app/Services/StateMachine/ApplicationStateMachine.php)
- [`app/Services/StateMachine/AssessmentStateMachine.php`](../../app/Services/StateMachine/AssessmentStateMachine.php)

---

### 5. Authorization Layer

**Purpose**: Model-level authorization logic

**Location**: `app/Policies/`

**Laravel Policy Pattern**:
```php
class ApplicationPolicy
{
    // View any applications
    public function viewAny(User $user): bool
    {
        return $user->hasAnyPermission(['view-applications', 'view-all-applications']);
    }

    // View specific application
    public function view(User $user, Application $application): bool
    {
        // System/DRDO admins can view all
        if ($user->hasAnyRole(['system_admin', 'drdo_admin'])) {
            return true;
        }

        // Organization admins can view their own
        if ($user->hasRole('enterprise_admin')) {
            return $application->organization_id === $user->organization_id;
        }

        // Operations staff can view assigned assessments
        if ($user->hasRole('operations_manager')) {
            return true; // Based on assigned applications
        }

        return false;
    }

    // Submit application
    public function submit(User $user, Application $application): bool
    {
        return $application->status === 'draft'
            && $application->organization_id === $user->organization_id
            && $user->hasPermission('submit-applications');
    }

    // Approve for payment
    public function approveForPayment(User $user, Application $application): bool
    {
        return $application->status === 'under_review'
            && $user->hasAnyRole(['operations_admin', 'operations_manager'])
            && $user->hasPermission('approve-applications');
    }
}
```

**Usage in Controllers**:
```php
// Automatic via route model binding
public function show(Application $application)
{
    // Laravel automatically calls ApplicationPolicy::view()
    // Throws 403 if not authorized
}

// Explicit authorization
public function submit(Application $application)
{
    $this->authorize('submit', $application);
    // ... continue if authorized
}

// Conditional authorization
if ($user->can('update', $application)) {
    // Show edit button
}
```

**Policies Implemented**:
- **ApplicationPolicy** - Application authorization
- **AssessmentPolicy** - Assessment authorization
- **OrganizationPolicy** - Organization authorization

**Code References**:
- [`app/Policies/ApplicationPolicy.php`](../../app/Policies/ApplicationPolicy.php)
- [`app/Policies/AssessmentPolicy.php`](../../app/Policies/AssessmentPolicy.php)

---

### 6. Model Layer

**Purpose**: Data access, relationships, business methods

**Location**: `app/Models/`

**Models**: see [`app/Models/`](../../app/Models/) for the current list.

**Model Features**:
- ✅ Eloquent ORM relationships (50+ defined)
- ✅ Query scopes for filtering
- ✅ Traits for cross-cutting concerns
- ✅ Accessors/Mutators for data transformation
- ✅ Model events (observers)
- ✅ Soft deletes
- ✅ Timestamps (created_at, updated_at)

**Example Model**:
```php
class Application extends Model
{
    use HasFactory,
        SoftDeletes,
        HasAuditLog,              // Automatic audit logging
        HasOrganizationScope,     // Multi-tenant filtering
        HasStateMachine;          // State machine integration

    protected $fillable = [
        'organization_id', 'unit_id', 'application_number',
        'type', 'scope', 'status', 'submitted_at'
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'certified_at' => 'datetime',
    ];

    // Relationships
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(ApplicationProduct::class);
    }

    public function assessment(): HasOne
    {
        return $this->hasOne(Assessment::class);
    }

    public function payment(): HasOne
    {
        return $this->hasOne(Payment::class);
    }

    public function certificate(): HasOne
    {
        return $this->hasOne(Certificate::class);
    }

    public function documents(): MorphMany
    {
        return $this->morphMany(Document::class, 'documentable');
    }

    public function auditLogs(): MorphMany
    {
        return $this->morphMany(AuditLog::class, 'auditable');
    }

    // Scopes
    public function scopeStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    public function scopeType($query, string $type)
    {
        return $query->where('type', $type);
    }

    public function scopeSearch($query, string $search)
    {
        return $query->where(function ($q) use ($search) {
            $q->where('application_number', 'like', "%{$search}%")
              ->orWhere('scope', 'like', "%{$search}%")
              ->orWhereHas('organization', fn($q) =>
                  $q->where('name', 'like', "%{$search}%")
              );
        });
    }

    // Business Methods
    public function isComplete(): bool
    {
        return $this->products()->exists()
            && $this->processes()->exists()
            && !empty($this->scope);
    }

    public function canSubmit(): bool
    {
        return $this->status === 'draft' && $this->isComplete();
    }

    public function requiresPayment(): bool
    {
        return in_array($this->status, ['payment_pending'])
            && !$this->payment()->where('status', 'success')->exists();
    }

    // Accessors
    public function getIsSubmittedAttribute(): bool
    {
        return !is_null($this->submitted_at);
    }

    // Mutators
    public function setApplicationNumberAttribute($value)
    {
        $this->attributes['application_number'] = strtoupper($value);
    }

    // Auto-generate application number
    protected static function booted()
    {
        static::creating(function ($application) {
            if (!$application->application_number) {
                $application->application_number = $application->generateApplicationNumber();
            }
        });
    }

    private function generateApplicationNumber(): string
    {
        $year = date('Y');
        $orgId = str_pad($this->organization_id, 3, '0', STR_PAD_LEFT);
        $sequence = static::where('organization_id', $this->organization_id)
            ->whereYear('created_at', $year)
            ->count() + 1;
        $seqStr = str_pad($sequence, 6, '0', STR_PAD_LEFT);

        return "APP-{$year}-{$orgId}-{$seqStr}";
    }
}
```

**See Also**: [Database Schema Documentation](12-database-schema.md)

---

### 7. Data Layer

**Purpose**: Persistent data storage

**Database**: MySQL 8.0+

**Schema Overview**:
- **Foreign key constraints**
- **Composite indexes**
- **Soft deletes on most tables**
- **Timestamps on all tables**

**Key Features**:
- ✅ Normalized schema (3NF)
- ✅ Foreign key relationships with cascading
- ✅ Indexes for performance (35+ indexes)
- ✅ Full-text search support (planned)
- ✅ JSON columns for flexible data
- ✅ ENUM types for fixed values
- ✅ Soft deletes for data recovery

**See Also**: [Database Schema Documentation](12-database-schema.md)

**Code Reference**: [`database/migrations/`](../../database/migrations/)

---

## Multi-Tenant Architecture

### Organization- and Unit-Level Data Scoping

**Implementation**: Manual, per-query scoping — **not** an automatic Eloquent global scope.

`HasOrganizationScope` and `HasUnitScope` (`app/Traits/HasOrganizationScope.php`,
`app/Traits/HasUnitScope.php`) do two things only:
- Auto-set `organization_id` on model creation from the authenticated user
  (`HasOrganizationScope`'s `creating` hook only — `HasUnitScope`'s equivalent hook is a no-op).
- Provide manual query scopes: `scopeForOrganization()` / `scopeWhereOrganization()` on
  `HasOrganizationScope`, `scopeForUnit()` / `scopeForOrganizationUnits()` on `HasUnitScope`.

There is no `addGlobalScope` call anywhere in either trait. Every query that must be
tenant-scoped has to explicitly call one of these scopes, or filter by `organization_id` /
`unit_id` directly — omitting it does not error, it silently returns cross-tenant data.
Isolation across the codebase is enforced this way: explicit `where('organization_id', ...)`
/ `where('unit_id', ...)` filters in controllers and services, plus policy checks in
`app/Policies/`.

**See Also**: [Multi-Tenancy Feature](../20-features/README.md)

---

## Security Architecture

### Authentication Layer

**Implementation**: JWT (JSON Web Tokens)

**Library**: `php-open-source-saver/jwt-auth`

**Token Types**:
- **Access Token**: Short-lived (60 minutes), for API calls
- **Refresh Token**: Long-lived (14 days), to obtain new access token

**Flow**:
```
1. User logs in with email + password
2. Server validates credentials
3. Server generates JWT access + refresh tokens
4. Client stores tokens securely
5. Client includes access token in API requests: Authorization: Bearer {token}
6. When access token expires, use refresh token to get new access token
7. On logout, tokens are blacklisted
```

**JWT Configuration**:
```env
JWT_SECRET=your-secret-key           # HMAC signing key
JWT_TTL=60                           # Access token: 60 minutes
JWT_REFRESH_TTL=20160                # Refresh token: 14 days
JWT_ALGO=HS256                       # HMAC SHA256
JWT_BLACKLIST_ENABLED=true           # Enable token blacklisting
```

**Token Structure**:
```json
{
  "header": {
    "typ": "JWT",
    "alg": "HS256"
  },
  "payload": {
    "iss": "https://api.qcisamar.gov.in",
    "sub": 123,                      // User ID
    "iat": 1704461234,               // Issued at
    "exp": 1704464834,               // Expires at (60 min later)
    "jti": "unique-token-id"
  },
  "signature": "HMAC_SHA256_SIGNATURE"
}
```

**OTP Verification**:
- 6-digit numeric code
- 10-minute expiry
- 5 attempt limit
- 30-minute lockout after max attempts
- Hashed storage in database

**Single Session Enforcement**:
```env
SINGLE_SESSION_ROLES=system_admin,drdo_admin,operations_manager
```

When users with these roles log in:
- Previous session tokens are invalidated
- Only one active session allowed at a time
- Enhances security for privileged accounts

**See Also**: [Authentication Feature](../20-features/21-authentication.md)

---

### Authorization Layer

**Implementation**: Role-Based Access Control (RBAC)

**Components**:
1. **Roles**: 9 predefined roles (system_admin, drdo_admin, etc.)
2. **Permissions**: 60+ granular permissions across 12 modules
3. **Policies**: Laravel policy classes for model-level authorization
4. **Middleware**: Route-level access control

**Authorization Layers**:

**Layer 1: Route Middleware**
```php
Route::middleware('role:admin')->group(function () {
    // Admin-only routes
});

Route::middleware('permission:create-user')->post('/users', ...);
```

**Layer 2: Policy Authorization**
```php
// Automatic via route model binding
public function show(Application $application) {
    // ApplicationPolicy::view() called automatically
}

// Explicit check
$this->authorize('update', $application);
```

**Layer 3: Manual Permission Check**
```php
if (auth()->user()->hasPermission('delete-applications')) {
    // Allow deletion
}

if (auth()->user()->hasAnyRole(['admin', 'manager'])) {
    // Show admin panel
}
```

**See Also**: [Authorization & RBAC Feature](../20-features/22-authorization-rbac.md)

---

### Data Security

**Encryption**:
- ✅ Passwords: BCrypt (cost: 12)
- ✅ OTP codes: Hashed before storage
- ✅ Payment gateway secrets: Environment variables
- ✅ JWT tokens: HMAC SHA256 signing

**Input Validation**:
- ✅ Form Request validation on all endpoints
- ✅ Type hinting and type declarations
- ✅ SQL injection prevention (Eloquent ORM)
- ✅ XSS prevention (output escaping)
- ✅ Mass assignment protection (fillable/guarded)

**Audit Trail**:
- ✅ All create/update/delete operations logged
- ✅ User attribution (who made the change)
- ✅ Before/after values captured
- ✅ IP address and user agent logged
- ✅ Sensitive fields redacted (passwords, tokens)

**Rate Limiting**:
```php
// Authentication endpoints
'login' => '5 per minute',
'register' => '3 per 5 minutes',
'password-reset' => '3 per 10 minutes',
'otp-verify' => '5 per minute',

// API endpoints
'api' => '60 per minute',
```

---

## Performance Architecture

### Database Optimization

**Indexes** (35+ composite indexes):
```php
// Applications table indexes
$table->index(['organization_id', 'status']);          // Filter by org + status
$table->index(['status', 'created_at']);               // Dashboard queries
$table->index('application_number');                   // Lookup by number
$table->fullText(['scope', 'title']);                  // Search (planned)

// Users table indexes
$table->unique('email');                               // Login queries
$table->index(['organization_id', 'email_verified_at']); // Active users

// Assessments table indexes
$table->index(['application_id', 'status']);           // Assessment queries
$table->index(['lead_assessor_id', 'status']);         // Assessor dashboard
```

**Query Optimization**:
- ✅ Eager loading to prevent N+1 queries
- ✅ Query scopes for reusable filters
- ✅ Database-level cascading deletes
- ✅ Selective column retrieval (`select()`)
- ✅ Chunking for large datasets

**Example**:
```php
// Bad: N+1 queries
$applications = Application::all();
foreach ($applications as $app) {
    echo $app->organization->name; // Query per app
}

// Good: Eager loading
$applications = Application::with('organization')->get();
foreach ($applications as $app) {
    echo $app->organization->name; // No additional queries
}
```

---

### Caching Strategy (Planned — NOT currently deployed)

> **Illustrative / aspirational.** The deployed system does **not** use Redis. Per `.env.example`, `CACHE_STORE=database` and `SESSION_DRIVER=array`; the Redis cache/session layers below describe a possible future setup, not the current one. Do not assume Redis is available at runtime.

**Cache Layers**:
1. **Application Cache** (Redis):
   - Role and permission definitions
   - Notification templates
   - Configuration values
   - Session data

2. **Query Cache**:
   - Dashboard statistics
   - User role/permission checks
   - Lookup tables (roles, permissions)

3. **HTTP Cache**:
   - Public certificate verification
   - Static content (images, documents)

**Cache Configuration**:
```env
CACHE_DRIVER=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DB=0
```

---

### Queue Jobs (Planned — NOT currently deployed)

> **Illustrative / aspirational.** The deployed system runs `QUEUE_CONNECTION=sync` (see `.env.example`) — jobs execute synchronously in the request/CLI process. There is **no** Redis queue, **no** long-running `queue:work` workers, and **no** supervisor process in the current deployment. The Redis/supervisor configuration below is a possible future setup only; work that must not block a request (e.g. the meeting-completion emails) uses Laravel's `defer()` in-process, not a queue worker.

**Queued Operations**:
- Email sending (asynchronous)
- In-app notifications
- Certificate PDF generation
- Report generation
- Audit log cleanup (scheduled)
- Data exports

**Queue Configuration**:
```env
QUEUE_CONNECTION=redis

# Worker process (run with supervisor)
php artisan queue:work --queue=high,default,low --tries=3
```

**Supervisor Configuration**:
```ini
[program:laravel-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/qci-samar-backend/artisan queue:work redis --sleep=3 --tries=3
autostart=true
autorestart=true
numprocs=4
user=www-data
```

---

## Scalability Considerations

### Horizontal Scaling

> **This section is aspirational.** The system is deployed on a single server today, without Redis. The Redis-backed shared session/cache items below are prerequisites for the multi-server topology described here, not the current deployment.

**Application Servers**:
- ✅ Stateless application design (JWT, no server sessions)
- ✅ Load balancer friendly (Nginx, AWS ELB)
- ⬜ Shared session storage (Redis) — not deployed; currently `SESSION_DRIVER=array`
- ⬜ Shared cache (Redis) — not deployed; currently `CACHE_STORE=database`

**Architecture**:
```
          [Load Balancer]
                |
    +-----------+-----------+
    |           |           |
[App Server 1][App Server 2][App Server 3]
    |           |           |
    +-----+-----+-----+-----+
          |           |
    [Primary DB]  [Redis Cluster]
          |
    [Replica DB]
```

---

### Database Scaling

**Vertical Scaling**:
- Increase server resources (CPU, RAM, storage)
- Optimize queries and indexes
- Tune MySQL configuration

**Horizontal Scaling** (Future):
- Read replicas for read-heavy operations
- Write to primary, read from replicas
- Load balancing read queries

**Sharding** (If needed):
- Shard by organization_id
- Each shard contains subset of organizations
- Complex but supports massive scale

---

## External Service Integration

### Payment Gateways

**Supported**:
- ✅ ICICI EazyPay (fully implemented)

**Pattern**: Adapter pattern with common interface

**See Also**: [Payment Processing Feature](../20-features/26-payment-processing.md)

---

### Email Service

**Options**:
- SMTP (Gmail, Outlook)
- SendGrid
- AWS SES
- Mailgun

**Configuration**:
```env
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=noreply@qcisamar.gov.in
MAIL_PASSWORD=your-password
MAIL_ENCRYPTION=tls
```

**Status**: Fully configured and operational

---

### File Storage (Planned)

**Options**:
- Local filesystem (development)
- AWS S3 (production)
- Azure Blob Storage
- DigitalOcean Spaces

**Configuration**:
```env
FILESYSTEM_DISK=s3
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_DEFAULT_REGION=ap-south-1
AWS_BUCKET=qci-samar-documents
```

---

## Deployment Architecture

**Note**: No production environment currently exists for this project — only `development` and
`staging` are provisioned (see `.webority/infra.json`). The scaling patterns below are illustrative,
not a description of a live deployment.

### Single Server (Small Scale)

```
┌──────────────────────────────────────┐
│         Ubuntu Server                 │
│  ┌────────────────────────────────┐  │
│  │  Nginx (Web Server + SSL)      │  │
│  └─────────┬──────────────────────┘  │
│            │                          │
│  ┌─────────▼──────────────────────┐  │
│  │  PHP-FPM (Application)         │  │
│  └─────────┬──────────────────────┘  │
│            │                          │
│  ┌─────────▼──────────────────────┐  │
│  │  MySQL (Database)              │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │  Redis (Cache + Queue)         │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │  Supervisor (Queue Workers)    │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

**Suitable for**:
- Development
- Staging
- Small production (<100 users, <1000 requests/day)

---

### Multi-Server (High Availability)

```
                [DNS + CloudFlare CDN]
                         |
                  [Load Balancer]
                    (Nginx/AWS ELB)
                         |
        +----------------+----------------+
        |                |                |
  [App Server 1]  [App Server 2]  [App Server 3]
    (PHP-FPM)       (PHP-FPM)       (PHP-FPM)
        |                |                |
        +--------+-------+--------+-------+
                 |                |
        [Primary Database]  [Redis Cluster]
        (MySQL Primary)     (Cache/Queue/Session)
                 |
        [Replica Database]
        (MySQL Read Replica)

  [File Storage: AWS S3/Azure Blob]
  [Email: SendGrid/AWS SES]
  [SMS: Twilio/AWS SNS]
  [Monitoring: New Relic/Datadog]
```

**Suitable for**:
- Production (>100 users, >1000 requests/day)
- High availability requirements
- Geographic distribution

---

## Technology Stack Summary

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Framework** | Laravel | 12.x | Web application framework |
| **Language** | PHP | 8.4+ | Programming language |
| **Database** | MySQL | 8.0+ | Primary data store |
| **Cache** | Redis | 7.x | Caching, sessions, queues |
| **Web Server** | Nginx | 1.18+ | HTTP server, reverse proxy |
| **Authentication** | JWT | - | Token-based auth |
| **API Docs** | Swagger/OpenAPI | 3.1 | API documentation |
| **Payments** | ICICI EazyPay | - | Payment processing |
| **Images** | Intervention Image | 2.x | Image manipulation |
| **PDFs** | DomPDF | 2.x | PDF generation |
| **Testing** | PHPUnit | 10.x | Unit/feature tests |
| **Code Quality** | Laravel Pint | - | Code formatting |

---

## Architecture Decision Records

### Key Decisions

1. **Laravel Framework**: Mature, well-documented, strong ecosystem
2. **JWT Authentication**: Stateless, scalable, mobile-friendly
3. **Multi-Tenant via Traits**: Simple, flexible, performant
4. **State Machines**: Formal workflow management, maintainable
5. **Service Layer**: Separation of concerns, testable business logic
6. **Adapter Pattern (Payments)**: Support multiple gateways easily
7. **Policy-Based Authorization**: Laravel best practice, clear logic
8. **Eloquent ORM**: Productivity, relationships, query builder
9. **MySQL**: ACID compliance, mature, good Laravel support
10. **RESTful API**: Standard, well-understood, tool support

---

## Related Documentation

- [Database Schema](12-database-schema.md) - Complete database documentation
- [State Machines](13-state-machines.md) - Workflow details
- [Design Patterns](14-design-patterns.md) - Patterns used
- [API Reference](../30-api/37-api-reference.md) - API endpoints

---

## Summary

The QCI SAMAR backend follows a **layered, service-oriented architecture** with:
- ✅ Clear separation of concerns
- ✅ SOLID principles
- ✅ Multi-tenant data isolation
- ✅ State machine workflows
- ✅ Comprehensive security (authentication, authorization, audit)
- ✅ Performance optimization (indexes, caching, queues)
- ✅ Scalability (stateless, load balancer ready)
- ✅ External service integration (payments, email, SMS)

---

**Last Updated**: January 2025
**Version**: 1.0
**Author**: Development Team
