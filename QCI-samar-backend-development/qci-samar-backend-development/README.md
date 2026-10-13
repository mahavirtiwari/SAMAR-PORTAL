# QCI SAMAR Certification Portal - Backend API

Laravel-based backend API for the QCI SAMAR Certification Lifecycle Management System. This project provides a complete, production-ready API infrastructure with JWT authentication, OTP verification, role-based access control, state machine workflows, payment gateway integration, and comprehensive audit trails.

## Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Documentation](#documentation)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Security Features](#security-features)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Deployment](#deployment)
- [Project Structure](#project-structure)

## Documentation

Documentation lives in [docs/](docs/) - start at [docs/INDEX.md](docs/INDEX.md).

- **[System Architecture](docs/10-architecture/11-system-architecture.md)** - layers, multi-tenancy, services
- **[Database Schema](docs/10-architecture/12-database-schema.md)**
- **[State Machines](docs/10-architecture/13-state-machines.md)** - application and assessment workflow
- **[Authentication](docs/20-features/21-authentication.md)** - JWT, OTP, session management
- **[Authorization / RBAC](docs/20-features/22-authorization-rbac.md)**
- **[Assessment Lifecycle (end-to-end)](docs/20-features/assessment-lifecycle-end-to-end.md)** - cross-stack, authoritative
- **[API Reference](docs/30-api/37-api-reference.md)**

Deployment is documented separately in [deploy/README.md](deploy/README.md).

## Features

### Core Functionality
- **Multi-Tenant Architecture**: Organization and unit-level data scoping with automatic filtering
- **Application Lifecycle Management**: 7-state workflow from draft to certification
- **Assessment Workflow**: 10-state assessment process with team allocation and QC review
- **Committee Management**: Meeting scheduling, decision recording, and approval workflows
- **Certificate Issuance**: Automated certificate generation with type-specific numbering and public verification
- **Payment Gateway Integration**: ICICI EazyPay with webhook verification
- **Notification System**: Email only, 35 seeded templates with variable substitution

### Security & Authentication
- **JWT Authentication**: Secure token-based authentication with refresh tokens
- **OTP Verification**: Email verification with 6-digit OTP codes and lockout protection
- **Single Session Enforcement**: Role-based session management for sensitive roles
- **RBAC System**: 9 roles enforced by route middleware and 26 Laravel policies
- **Policy-Based Authorization**: Laravel policies for model-level access control
- **Audit Trail**: Complete audit logging for all create/update/delete operations

### Technical Features
- **State Machine Pattern**: Configuration-driven workflow management with guards and hooks
- **Trait-Based Architecture**: Reusable traits for scoping, auditing, and state management
- **Polymorphic Relationships**: Flexible document and audit log associations
- **Soft Deletes**: Data recovery capability across all entities
- **API Documentation**: OpenAPI 3.1 specification with role-based endpoint documentation
- **Security Middleware**: Comprehensive security headers (HSTS, CSP, X-Frame-Options, etc.)
- **Rate Limiting**: Configurable rate limiting for authentication endpoints

## Technology Stack

- **Framework**: Laravel 12.x
- **PHP**: 8.4+
- **Database**: MySQL 8.0+
- **Authentication**: JWT (php-open-source-saver/jwt-auth)
- **Documentation**: Swagger/OpenAPI (L5-Swagger)
- **Testing**: PHPUnit
- **Code Quality**: Laravel Pint

## Prerequisites

- PHP 8.4 or higher
- Composer 2.x
- MySQL 8.0 or higher
- Node.js 18+ and NPM (for development tools)
- Git

## Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd qci-samar-backend
```

2. **Install PHP dependencies**

```bash
composer install
```

3. **Environment configuration**

```bash
# Copy the example environment file
cp .env.example .env

# Generate application key
php artisan key:generate

# Generate JWT secret
php artisan jwt:secret
```

4. **Configure your database**

Edit `.env` file and update database credentials:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=qci_samar
DB_USERNAME=root
DB_PASSWORD=your_password
```

5. **Run database migrations and seeders**

```bash
# Run all migrations
php artisan migrate

# Seed roles
php artisan db:seed --class=RoleSeeder

# Seed notification templates
php artisan db:seed --class=NotificationTemplateSeeder
```

6. **Create storage link** (for file uploads)

```bash
php artisan storage:link
```

7. **Generate API documentation**

```bash
php artisan l5-swagger:generate
```

## Configuration

### Environment Files

The project includes three environment files:

- **`.env.example`**: Template for local development
- **`.env.staging`**: Configuration for staging environment
- **`.env.production`**: Configuration for production environment

### Key Configuration Areas

#### JWT Configuration

```env
JWT_SECRET=your-secret-key
JWT_TTL=15                    # Access token lifetime (minutes)
JWT_REFRESH_TTL=120           # Refresh token lifetime (minutes)
JWT_ALGO=HS256
JWT_BLACKLIST_ENABLED=true
```

#### Rate Limiting

```env
RATE_LIMIT_LOGIN=5              # Max login attempts per minute
RATE_LIMIT_LOGIN_DECAY=1        # Time window in minutes
RATE_LIMIT_REGISTER=3           # Max registration attempts per 5 minutes
RATE_LIMIT_REGISTER_DECAY=5
RATE_LIMIT_PASSWORD_RESET=3     # Max password reset attempts per 10 minutes
RATE_LIMIT_PASSWORD_RESET_DECAY=10
RATE_LIMIT_REFRESH=10           # Max token refresh attempts per minute
RATE_LIMIT_REFRESH_DECAY=1
```

#### CORS Configuration

```env
CORS_ALLOWED_ORIGINS=*
CORS_ALLOWED_METHODS="GET,POST,PUT,PATCH,DELETE,OPTIONS"
CORS_ALLOWED_HEADERS="Content-Type,Authorization,X-Requested-With,Accept,Origin"
CORS_SUPPORTS_CREDENTIALS=false
```

#### Payment Gateway Configuration

```env
# Default payment gateway (icici_eazypay)
PAYMENT_DEFAULT_GATEWAY=icici_eazypay

# ICICI EazyPay
ICICI_EAZYPAY_ENABLED=true
ICICI_EAZYPAY_MERCHANT_ID=your_merchant_id
ICICI_EAZYPAY_ENCRYPTION_KEY=your_encryption_key
ICICI_EAZYPAY_SUB_MERCHANT_ID=1
ICICI_EAZYPAY_RETURN_URL=your_return_url
ICICI_EAZYPAY_PUSH_URL=your_push_url
```

#### OTP Configuration

```env
OTP_EXPIRY_MINUTES=2
```

#### Session Configuration

```env
# Single-session enforcement is per-role via roles.enforce_single_session
# (on for all eight human roles, off for erp_integration) and gated globally by:
SINGLE_SESSION_ENABLED=true
```

## Security Features

### Security Middleware

The application includes several security middleware automatically applied to all API routes:

1. **SecurityHeaders**: Adds security headers to all responses
   - Strict-Transport-Security (HSTS)
   - X-Content-Type-Options
   - X-Frame-Options
   - X-XSS-Protection
   - Referrer-Policy
   - Content-Security-Policy
   - Permissions-Policy

2. **ForceJsonResponse**: Ensures all API responses are JSON formatted

3. **TrustProxies**: Properly handles proxy headers for cloud deployments

### RBAC Middleware

- **`role` middleware**: Restrict access to specific roles
  ```php
  Route::middleware('role:admin,manager')->group(function () {
      // Admin and manager only routes
  });
  ```

- **`permission` middleware**: Restrict access to specific permissions
  ```php
  Route::middleware('permission:create-user,edit-user')->group(function () {
      // Routes requiring specific permissions
  });
  ```

### Rate Limiting

Authentication endpoints are protected with strict rate limiting:
- Login: 5 attempts per minute
- Registration: 3 attempts per 5 minutes
- Password reset: 3 attempts per 10 minutes
- Token refresh: 10 attempts per minute

## API Documentation

Access the API documentation:

- **Local**: http://localhost:8000/api/documentation
- **OpenAPI Spec**: [storage/api-docs/openapi.yaml](storage/api-docs/openapi.yaml)

### System Roles

Nine roles, seeded by `database/seeders/RoleSeeder.php` (that file is the source of truth; slugs are `Role::` constants):

1. **system_admin** - Full system access; owns master data and the questionnaire
2. **drdo_admin** - Approves/rejects applications, verifies organizations
3. **drdo_lab** - Read-only access to the certified vendor register
4. **operations_manager** - Allocates assessment teams; performs QC review
5. **operations_admin** - Processes applications; runs rating committee meetings
6. **assessor** - Conducts assessments they are assigned to
7. **enterprise_admin** - Organization-level administrator
8. **unit_admin** - Unit-level administrator
9. **erp_integration** - Machine account for the Business Central push; not a human role

There is no `lead_assessor` role - lead vs co-assessor is a per-assessment team position on
`application_assessment_team_members`. `committee_member` is an entity (a person seated on a
rating committee), not a role.

Authorization is **role-based with Laravel policies**. There is no permission model: no
`Permission` model, no `permissions` table, and no `permission:` middleware.

### Key API Endpoints

#### Authentication
- `POST /api/v1/auth/register` - Register new organization
- `POST /api/v1/auth/login` - User login (returns JWT tokens)
- `POST /api/v1/auth/logout` - User logout
- `GET /api/v1/auth/me` - Get current user profile
- `POST /api/v1/auth/verify-otp` - Verify email OTP
- `POST /api/v1/auth/resend-otp` - Resend OTP code

#### Applications
- `GET /api/v1/applications` - List applications (filtered by role)
- `POST /api/v1/applications` - Create new application
- `GET /api/v1/applications/{id}` - Get application details
- `POST /api/v1/applications/{id}/submit` - Submit application for review

#### Assessments
- `GET /api/v1/assessments` - List assessments
- `POST /api/v1/assessments/{id}/allocate` - Allocate assessors (ops_manager)
- `POST /api/v1/assessments/{id}/submit` - Submit assessment for QC
- `POST /api/v1/assessments/{id}/qc-review` - QC review decision

#### Payments
- `POST /api/v1/payments/initiate` - Initiate payment
- `POST /api/v1/payments/{id}/verify` - Verify payment status
- `POST /api/webhooks/payments/icici-eazypay` - ICICI EazyPay webhook handler

#### Certificates
- `GET /api/v1/certificates` - List certificates
- `POST /api/v1/certificates/issue` - Issue certificate (ops_manager)
- `POST /api/v1/certificates/{id}/approve` - Approve certificate (drdo_admin)
- `POST /api/verify-certificate` - Public certificate verification

#### Notifications
- `GET /api/v1/notifications` - Get user notifications
- `GET /api/v1/notifications/unread-count` - Get unread count
- `POST /api/v1/notifications/{id}/mark-read` - Mark notification as read
- `POST /api/v1/notifications/mark-all-read` - Mark all as read

### State Machines

#### Application Workflow (7 states)
```
draft → drdo_approval_pending → payment_pending → payment_completed →
in_progress → certified
                ↘ rejected (from drdo_approval_pending only)
```
`draft` may go straight to `payment_pending` when the `drdo_approval_required` system
setting is off. `certified` and `rejected` are terminal; there is no `withdrawn` state.

#### Assessment Workflow (10 states)
```
allocation_pending → scheduled → in_progress → mobile_complete →
submitted_for_qc → ready_for_committee → committee_review → certified
         ↕ qc_feedback              ↕ committee_feedback
```
Committee feedback returns to `submitted_for_qc`, i.e. back through the QC loop, and is
capped at two send-backs. Committee decisions are recorded during a meeting and applied
when the meeting is closed, not at the moment of the decision.

## Development

### Running the development server

```bash
# Using Laravel's built-in server
php artisan serve

# Or use the dev script (includes queue worker, logs, and Vite)
composer run dev
```

### Running tests

```bash
composer test
# or
php artisan test
```

### Code formatting

```bash
# Run Laravel Pint for code formatting
./vendor/bin/pint
```

### Queue workers

```bash
# Run queue worker
php artisan queue:listen

# Run queue worker with specific queue
php artisan queue:listen --queue=high,default
```

## Deployment

### Staging/Production Checklist

1. **Update environment file**
   - Copy `.env.staging` or `.env.production` to `.env`
   - Update all credentials and secrets
   - Set `APP_DEBUG=false`
   - Set `APP_ENV` to `staging` or `production`

2. **Install dependencies**
   ```bash
   composer install --optimize-autoloader --no-dev
   ```

3. **Optimize application**
   ```bash
   php artisan config:cache
   php artisan route:cache
   php artisan view:cache
   ```

4. **Run migrations**
   ```bash
   php artisan migrate --force
   ```

5. **Set proper permissions**
   ```bash
   chmod -R 755 storage bootstrap/cache
   ```

## Project Structure

```
qci-samar-backend/
├── app/
│   ├── Contracts/                      # Interfaces
│   │   └── PaymentGatewayInterface.php
│   ├── Exceptions/                     # Custom exception handlers
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── Api/
│   │   │   │   └── V1/                # Version 1 API controllers
│   │   │   │       ├── Auth/          # Authentication controllers
│   │   │   │       ├── ApplicationController.php
│   │   │   │       ├── ApplicationProductController.php
│   │   │   │       ├── AssessmentController.php
│   │   │   │       ├── ScorecardController.php
│   │   │   │       ├── PaymentController.php
│   │   │   │       ├── CertificateController.php
│   │   │   │       ├── CommitteeController.php
│   │   │   │       ├── CommitteeDecisionController.php
│   │   │   │       ├── NotificationController.php
│   │   │   │       ├── OrganizationController.php
│   │   │   │       └── UnitController.php
│   │   │   └── PaymentWebhookController.php
│   │   ├── Middleware/                # Security and auth middleware
│   │   │   ├── CheckPermissionMiddleware.php
│   │   │   └── CheckRoleMiddleware.php
│   │   ├── Requests/                  # Form request validation
│   │   └── Resources/                 # API resource transformers
│   ├── Models/                        # 67 Eloquent models
│   │   ├── User.php
│   │   ├── Organization.php
│   │   ├── Unit.php
│   │   ├── Application.php
│   │   ├── ApplicationProduct.php
│   │   ├── ApplicationCustomer.php
│   │   ├── ApplicationProcess.php
│   │   ├── Assessment.php
│   │   ├── Scorecard.php
│   │   ├── Payment.php
│   │   ├── Certificate.php
│   │   ├── CommitteeMeeting.php
│   │   ├── CommitteeDecision.php
│   │   ├── Notification.php
│   │   ├── NotificationTemplate.php
│   │   ├── Role.php
│   │   ├── Permission.php
│   │   ├── AuditLog.php
│   │   └── Document.php
│   ├── Policies/                      # Authorization policies
│   │   ├── ApplicationPolicy.php
│   │   ├── AssessmentPolicy.php
│   │   └── OrganizationPolicy.php
│   ├── Providers/                     # Service providers
│   ├── Services/                      # Business logic services
│   │   ├── Auth/
│   │   │   └── AuthService.php       # Complete auth logic (680+ lines)
│   │   ├── Notification/
│   │   │   └── NotificationService.php
│   │   ├── Payment/
│   │   │   ├── PaymentGatewayFactory.php
│   │   │   └── ICICIEazyPayAdapter.php
│   │   └── StateMachine/
│   │       ├── StateMachine.php      # Abstract base class
│   │       ├── ApplicationStateMachine.php
│   │       └── AssessmentStateMachine.php
│   ├── Traits/                        # Reusable traits
│   │   ├── HasAuditLog.php
│   │   ├── HasOrganizationScope.php
│   │   ├── HasStateMachine.php
│   │   ├── HasUnitScope.php
│   │   └── TracksUserActions.php
│   └── Jobs/                          # Queue jobs
├── bootstrap/
│   └── app.php                        # Middleware registration
├── config/
│   └── services.php                   # Payment gateway config
├── database/
│   ├── migrations/                    # 32 database migrations
│   │   ├── 2024_01_01_000001_create_organizations_table.php
│   │   ├── 2024_01_01_000005_create_users_table.php
│   │   ├── 2024_01_01_000010_create_applications_table.php
│   │   ├── 2024_01_01_000017_create_assessments_table.php
│   │   └── ... (28 more migrations)
│   └── seeders/
│       ├── RoleSeeder.php             # 9 roles (no permission model)
│       └── NotificationTemplateSeeder.php  # 35 email templates
├── routes/
│   ├── api.php                        # All API routes with RBAC
│   ├── console.php
│   └── web.php
├── storage/
│   └── api-docs/
│       └── openapi.yaml               # OpenAPI 3.1 specification
├── tests/                             # Unit and feature tests
├── .env.example                       # Environment template
├── composer.json                      # PHP dependencies
└── README.md                          # This file
```

## Database Schema

### Core Entities

**Organizations & Units**
- Organizations: Multi-tenant entities with profile completion tracking
- Units: Sub-entities within organizations with location and contact details

**Users & RBAC**
- Users: With OTP verification, session management, and role assignments
- Roles: 9 predefined roles (system_admin, drdo_admin, enterprise_admin, etc.)
- RoleUser: Many-to-many relationship with expiry dates

**Applications**
- Applications: 7-state workflow with auto-generated numbers (SAMAR-{id}-{MMYY})
- ApplicationProducts: Products/services being certified
- ApplicationCustomers: Key customers of the applicant
- ApplicationProcesses: Manufacturing/operational processes

**Assessments**
- Assessments: 10-state workflow; team held on `application_assessment_team_members` (one lead, N co-assessors)
- Parameters and questions are copied per assessment at creation, so editing the master questionnaire never alters an assessment already under way

**Payments**
- Payments: Multi-gateway support with webhook verification
- Payment numbers: TXN{unix_millis}{4 hex}

**Committees & Certificates**
- CommitteeMeetings: Meeting management with agenda and minutes
- CommitteeDecisions: Decision recording with conditions and validity
- Certificates: {DDMMYYYY}_{tail of issuing user's samar_id}, with a -N suffix on same-day collision. Types are initial or renewal only

**Notifications & Audit**
- NotificationTemplates: 35 seeded email templates with variable substitution
- NotificationEvents: one row per email attempted, with the subject and body actually sent
- AuditLogs: Complete audit trail with before/after values
- Documents: Polymorphic document storage

## Implementation Status

✅ **Completed Components:**

1. ✅ Database Schema (117 migrations)
2. ✅ Eloquent Models (67 models with relationships)
3. ✅ Authentication System (JWT, OTP, single session)
4. ✅ RBAC System (roles, permissions, policies, middleware)
5. ✅ State Machines (Application, Assessment workflows)
6. ✅ Audit Trail System (automatic logging)
7. ✅ Multi-Tenancy (organization/unit scoping)
8. ✅ Application Lifecycle APIs
9. ✅ Assessment Workflow APIs
10. ✅ Payment Gateway Integration (ICICI EazyPay)
11. ✅ Committee & Certification APIs
12. ✅ Email Notification System (35 templates)
13. ✅ OpenAPI 3.1 Documentation

🔄 **Pending/Optional Components:**

1. ⏳ SMS / push notification channels - email is the only channel today
2. ⏳ Cloud object storage - uploads currently live on the local filesystem
3. ⏳ Queue workers - `QUEUE_CONNECTION=sync`, so jobs run inline in the request
4. ⏳ CI/CD pipeline
5. ⏳ Application performance monitoring

## Support

For issues, questions, or contributions, please contact the development team.

## License

Proprietary - QCI Samar Project