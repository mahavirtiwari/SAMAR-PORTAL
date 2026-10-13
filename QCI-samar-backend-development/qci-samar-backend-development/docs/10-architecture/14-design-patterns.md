---
title: "Design Patterns"
category: "architecture"
tags: ["design-patterns", "traits", "services", "policies", "repository"]
related:
  - 11-system-architecture.md
  - 13-state-machines.md
code_files:
  - app/Traits/
  - app/Services/
  - app/Policies/
last_updated: "2025-01-05"
version: "1.0"
---

# Design Patterns

**Location**: `docs/10-architecture/14-design-patterns.md`
**Related**: [System Architecture](11-system-architecture.md) | [State Machines](13-state-machines.md)

## Overview

The QCI SAMAR backend implements **proven design patterns** to ensure:

- **Code Reusability**: DRY (Don't Repeat Yourself) principles
- **Maintainability**: Clean, organized, and testable code
- **Scalability**: Easy to extend and modify
- **Separation of Concerns**: Clear responsibility boundaries
- **Consistency**: Uniform approaches across the codebase

## Core Design Patterns

### 1. Trait Pattern (Composition)
### 2. Service Layer Pattern
### 3. Policy Pattern (Authorization)
### 4. Repository Pattern
### 5. State Machine Pattern
### 6. Observer Pattern (Events)

---

## 1. Trait Pattern (Composition)

**Purpose**: Share common functionality across multiple models without inheritance.

### Architecture

```
┌────────────────────────────────────────────────┐
│              Laravel Models                    │
├────────────────────────────────────────────────┤
│  Application  │  Assessment  │  Organization  │
│     User      │  Certificate │    Document    │
└────────────────────────────────────────────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
         ▼            ▼            ▼
    ┌────────┐  ┌──────────┐  ┌────────────┐
    │HasAudit│  │HasState  │  │HasOrgScope │
    │  Log   │  │ Machine  │  │            │
    └────────┘  └──────────┘  └────────────┘
```

### Core Traits

#### HasAuditLog Trait

**Purpose**: Automatic audit logging for all model changes.

**Location**: [`app/Traits/HasAuditLog.php`](../../app/Traits/HasAuditLog.php)

**Features**:
- Automatically logs `created`, `updated`, `deleted`, `restored` events
- Stores old/new values, changed fields, user info, IP, user agent
- Redacts sensitive fields (passwords, tokens, etc.)
- Polymorphic relationship to any model

**Usage**:
```php
use App\Traits\HasAuditLog;

class Application extends Model
{
    use HasAuditLog;

    // Optionally customize sensitive fields
    protected function getAuditSensitiveFields(): array
    {
        return ['password', 'api_token', 'secret_key'];
    }
}
```

**Auto-logged Events**:
```php
protected static function bootHasAuditLog(): void
{
    static::created(function ($model) {
        $model->logAudit('created', null, $model->getAuditableAttributes());
    });

    static::updated(function ($model) {
        $changes = $model->getChanges();
        unset($changes['updated_at']);

        if (!empty($changes)) {
            $model->logAudit('updated', $model->getOriginal(), $model->getAttributes(), array_keys($changes));
        }
    });

    static::deleted(function ($model) {
        $model->logAudit('deleted', $model->getAuditableAttributes(), null);
    });
}
```

**Access Audit Logs**:
```php
$application = Application::find(1);
$auditLogs = $application->auditLogs; // Get all audit logs
$recentChanges = $application->auditLogs()->limit(10)->get();
```

---

#### HasStateMachine Trait

**Purpose**: State machine workflow management for models.

**Location**: [`app/Traits/HasStateMachine.php`](../../app/Traits/HasStateMachine.php)

**Features**:
- State transitions with role-based guards
- Available transitions based on current state and user
- Transition history tracking
- Automatic state metadata

**Usage**:
```php
use App\Traits\HasStateMachine;

class Application extends Model
{
    use HasStateMachine;

    protected function getStateMachineClass(): string
    {
        return \App\Services\StateMachine\ApplicationStateMachine::class;
    }
}
```

**Methods**:
```php
$application = Application::find(1);
$user = auth()->user();

// Get state machine instance
$stateMachine = $application->stateMachine($user);

// Check available transitions
$transitions = $application->getAvailableTransitions($user);
// ['submit', 'withdraw']

// Check if transition is allowed
if ($application->canTransitionTo('submit', $user)) {
    // Perform transition
    $application->transitionTo('submit', [], $user);
}

// Get current state label
$label = $application->getStatusLabel(); // 'Draft'

// Get state metadata
$metadata = $application->getStatusMetadata();
// ['editable' => true, 'color' => 'gray']
```

---

#### HasOrganizationScope Trait

**Purpose**: Manual, per-query scoping to an organization. This is **not** an automatic
Eloquent global scope — every query that must be tenant-scoped has to explicitly call one
of the scopes below, or filter by `organization_id` directly. Omitting it does not error;
it silently returns cross-tenant data.

**Location**: [`app/Traits/HasOrganizationScope.php`](../../app/Traits/HasOrganizationScope.php)

**Features**:
- `scopeForOrganization()` / `scopeWhereOrganization()` manual query scopes
- Automatic `organization_id` assignment on create (from the authenticated user, if not already set)

**Usage**:
```php
use App\Traits\HasOrganizationScope;

class Application extends Model
{
    use HasOrganizationScope;
}

// Scope to the current user's organization
$applications = Application::forOrganization()->get();

// Scope to a specific organization
$applications = Application::whereOrganization($orgId)->get();
```

---

#### HasUnitScope Trait

**Purpose**: Manual, per-query scoping to a unit. Same caveat as `HasOrganizationScope` —
no automatic global scope; callers must invoke these scopes explicitly.

**Location**: [`app/Traits/HasUnitScope.php`](../../app/Traits/HasUnitScope.php)

**Usage**:
```php
use App\Traits\HasUnitScope;

class Application extends Model
{
    use HasUnitScope;
}

// Scope to a specific unit (or array of units)
$applications = Application::forUnit($unitId)->get();

// Scope to all units within an organization
$applications = Application::forOrganizationUnits($organizationId)->get();
```

---

#### TracksUserActions Trait

**Purpose**: Automatically track which user created/updated/deleted records.

**Location**: [`app/Traits/TracksUserActions.php`](../../app/Traits/TracksUserActions.php)

**Features**:
- Auto-populates `created_by`, `updated_by`, `deleted_by` fields
- Boot method hooks into Eloquent events

**Usage**:
```php
use App\Traits\TracksUserActions;

class Application extends Model
{
    use TracksUserActions;

    protected $fillable = [
        'title',
        'created_by',
        'updated_by',
        'deleted_by',
    ];
}
```

**Automatic Tracking**:
```php
// created_by automatically set
$application = Application::create(['title' => 'Test']);
// $application->created_by = auth()->id()

// updated_by automatically updated
$application->update(['title' => 'Updated']);
// $application->updated_by = auth()->id()
```

---

### Benefits of Trait Pattern

**Advantages**:
- ✅ **Code Reuse**: Share functionality without inheritance
- ✅ **Flexibility**: Mix multiple traits in a single class
- ✅ **Testability**: Test traits independently
- ✅ **Maintainability**: Update behavior in one place
- ✅ **Composition**: Avoid deep inheritance hierarchies

**When to Use**:
- Cross-cutting concerns (logging, scoping, tracking)
- Functionality needed by multiple unrelated models
- Polymorphic behavior patterns

---

## 2. Service Layer Pattern

**Purpose**: Encapsulate complex business logic outside of controllers and models.

### Architecture

```
┌────────────────┐
│  Controllers   │  ← Thin controllers, delegate to services
└────────┬───────┘
         │
         ▼
┌────────────────┐
│   Services     │  ← Business logic, orchestration
├────────────────┤
│ DocumentService│
│ ScorecardService│
│ DashboardService│
│ SearchService  │
└────────┬───────┘
         │
         ▼
┌────────────────┐
│    Models      │  ← Data access, relationships
└────────────────┘
```

### Core Services

#### DocumentService

**Purpose**: Handle document upload, storage, validation, virus scanning.

**Location**: [`app/Services/DocumentService.php`](../../app/Services/DocumentService.php)

**Responsibilities**:
- File validation (size, MIME type, extension)
- Secure filename generation (UUID-based)
- Organized storage (year/month folders)
- Checksum calculation (SHA-256)
- Virus scanning integration
- Batch uploads

**Usage**:
```php
use App\Services\DocumentService;

$documentService = app(DocumentService::class);

// Upload single document
$document = $documentService->upload($file, [
    'organization_id' => $org->id,
    'documentable_type' => Application::class,
    'documentable_id' => $application->id,
    'type' => 'incorporation_certificate',
    'category' => 'legal',
    'description' => 'Company incorporation certificate',
], auth()->user());

// Batch upload
$results = $documentService->batchUpload($files, $metadata, auth()->user());

// Verify checksum
$isValid = $documentService->verifyChecksum($document);

// Delete document
$documentService->delete($document);
```

**Key Features**:
```php
class DocumentService
{
    // Allowed MIME types
    protected array $allowedMimeTypes = [
        'application/pdf',
        'image/jpeg', 'image/png',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        // ...
    ];

    // Max file size (10MB default)
    protected int $maxFileSize;

    // Storage disk
    protected string $storageDisk;

    protected function validateFile(UploadedFile $file): void
    {
        // Size check
        if ($file->getSize() > $this->maxFileSize) {
            throw new \Exception('File size exceeds maximum');
        }

        // MIME type check
        if (!in_array($file->getMimeType(), $this->allowedMimeTypes)) {
            throw new \Exception('File type not allowed');
        }

        // Extension check
        // ...
    }

    protected function generateSecureFilename(UploadedFile $file): string
    {
        $uuid = Str::uuid();
        $extension = $file->getClientOriginalExtension();
        return "{$uuid}.{$extension}";
    }

    protected function calculateChecksum(UploadedFile $file): string
    {
        return hash_file('sha256', $file->getRealPath());
    }
}
```

---

#### ScorecardService

**Purpose**: Manage assessment scorecards, score calculation, grading.

**Location**: [`app/Services/ScorecardService.php`](../../app/Services/ScorecardService.php)

**Responsibilities**:
- Create scorecards for assessments
- Calculate weighted scores
- Determine grades based on percentage
- Generate assessment reports
- Handle findings (major, minor, observations)

**Usage**:
```php
use App\Services\ScorecardService;

$scorecardService = app(ScorecardService::class);

// Create scorecards for assessment
$scorecards = $scorecardService->createScorecardsForAssessment($assessment);

// Update scorecard
$scorecard = $scorecardService->updateScorecard($scorecardId, [
    'score_obtained' => 8.5,
    'finding_type' => 'minor',
    'finding_description' => 'Minor documentation issue',
    'evidence' => 'Photo evidence uploaded',
]);

// Calculate total score for assessment
$scorecardService->calculateAssessmentScore($assessment);

// Get assessment summary
$summary = $scorecardService->getAssessmentSummary($assessment);
```

---

#### DashboardService

**Purpose**: Aggregate data for various dashboard views.

**Location**: [`app/Services/DashboardService.php`](../../app/Services/DashboardService.php)

**Responsibilities**:
- Organization dashboard statistics
- Assessor workload metrics
- Operations manager overview
- System-wide statistics
- Chart data aggregation

**Usage**:
```php
use App\Services\DashboardService;

$dashboardService = app(DashboardService::class);

// Organization dashboard
$data = $dashboardService->getOrganizationDashboard($user);

// Assessor dashboard
$data = $dashboardService->getAssessorDashboard($user);

// Operations dashboard
$data = $dashboardService->getOperationsDashboard($user);

// System dashboard (admin)
$data = $dashboardService->getSystemDashboard($user);
```

---

#### SearchService

**Purpose**: Unified search across multiple models with filters, sorting, pagination.

**Location**: [`app/Services/SearchService.php`](../../app/Services/SearchService.php)

**Features**:
- Full-text search
- Advanced filtering
- Sorting by multiple fields
- Relationship eager loading
- Pagination support
- Search indexes for performance

**Usage**:
```php
use App\Services\SearchService;

$searchService = app(SearchService::class);

$results = $searchService->search(Application::class, [
    'query' => 'certification',
    'filters' => [
        'status' => ['draft', 'allocation_pending'],
        'organization_id' => 123,
    ],
    'sort' => 'created_at',
    'direction' => 'desc',
    'per_page' => 15,
]);
```

---

### Service Layer Benefits

**Advantages**:
- ✅ **Thin Controllers**: Controllers remain simple HTTP handlers
- ✅ **Testable**: Services are easy to unit test
- ✅ **Reusable**: Same service used by multiple controllers
- ✅ **Single Responsibility**: Each service has clear purpose
- ✅ **Dependency Injection**: Easy to mock in tests

**When to Use**:
- Complex business logic
- Multi-step operations
- External API integrations
- Data aggregation and transformation
- File processing

**Best Practices**:
```php
// ❌ BAD - Business logic in controller
public function store(Request $request)
{
    $file = $request->file('document');

    // Validate file size
    if ($file->getSize() > 10485760) {
        return response()->json(['error' => 'File too large'], 400);
    }

    // Generate filename
    $filename = Str::uuid() . '.' . $file->extension();

    // Store file
    $path = Storage::put("documents/{$filename}", $file);

    // Calculate checksum
    $checksum = hash_file('sha256', $file->getRealPath());

    // Create record
    $document = Document::create([...]);

    return response()->json(['document' => $document], 201);
}

// ✅ GOOD - Delegate to service
public function store(Request $request, DocumentService $documentService)
{
    $validated = $request->validated();

    $document = $documentService->upload(
        $request->file('document'),
        $validated,
        auth()->user()
    );

    return $this->successResponse($document, 'Document uploaded', 201);
}
```

---

## 3. Policy Pattern (Authorization)

**Purpose**: Centralize authorization logic for each model.

### Architecture

```
┌────────────────┐
│  Controllers   │
└────────┬───────┘
         │ $this->authorize('view', $application);
         ▼
┌────────────────┐
│    Policies    │  ← Authorization logic
├────────────────┤
│ApplicationPolicy│
│AssessmentPolicy│
│DocumentPolicy  │
│UserPolicy      │
└────────┬───────┘
         │
         ▼
┌────────────────┐
│  Permission    │  ← Role + Permission check
│    Check       │
└────────────────┘
```

### Core Policies

#### ApplicationPolicy

**Location**: [`app/Policies/ApplicationPolicy.php`](../../app/Policies/ApplicationPolicy.php)

**Authorization Methods**:

```php
class ApplicationPolicy
{
    // Can view any applications?
    public function viewAny(User $user): bool
    {
        return $user->hasAnyRole([
            Role::ENTERPRISE_ADMIN,
            Role::UNIT_ADMIN,
            Role::DRDO_ADMIN,
            Role::OPERATIONS_MANAGER,
            // ...
        ]);
    }

    // Can view specific application?
    public function view(User $user, Application $application): bool
    {
        // System admins can view all
        if ($user->hasAnyRole([Role::SYSTEM_ADMIN, Role::OPERATIONS_ADMIN])) {
            return true;
        }

        // Enterprise admin can view their org's applications
        if ($user->hasRole(Role::ENTERPRISE_ADMIN) &&
            $user->organization_id === $application->organization_id) {
            return true;
        }

        // Unit admin can view their unit's applications
        if ($user->hasRole(Role::UNIT_ADMIN)) {
            $userUnits = $user->roles()
                ->where('slug', Role::UNIT_ADMIN)
                ->wherePivot('is_active', true)
                ->pluck('pivot.unit_id')
                ->toArray();

            return in_array($application->unit_id, $userUnits);
        }

        return false;
    }

    // Can create applications?
    public function create(User $user): bool
    {
        return $user->hasAnyRole([Role::ENTERPRISE_ADMIN, Role::UNIT_ADMIN]) &&
               $user->hasPermission('applications.create');
    }

    // Can update application?
    public function update(User $user, Application $application): bool
    {
        // Can only update if in draft or allocation_pending
        if (!in_array($application->status, ['draft', 'allocation_pending'])) {
            return false;
        }

        // Must be enterprise/unit admin with permission
        if ($user->hasRole(Role::ENTERPRISE_ADMIN) &&
            $user->organization_id === $application->organization_id &&
            $user->hasPermission('applications.update')) {
            return true;
        }

        return false;
    }

    // Can submit application?
    public function submit(User $user, Application $application): bool
    {
        return $application->status === 'draft' &&
               $this->update($user, $application) &&
               $user->hasPermission('applications.submit');
    }

    // Can approve application?
    public function approve(User $user, Application $application): bool
    {
        return $user->hasAnyRole([
            Role::DRDO_ADMIN,
            Role::OPERATIONS_MANAGER,
            Role::OPERATIONS_ADMIN,
        ]) && $user->hasPermission('applications.approve');
    }
}
```

**Usage in Controllers**:
```php
public function show(Application $application)
{
    // Automatically checks ApplicationPolicy::view()
    $this->authorize('view', $application);

    return $this->successResponse($application);
}

public function update(Request $request, Application $application)
{
    $this->authorize('update', $application);

    $validated = $request->validated();
    $application->update($validated);

    return $this->successResponse($application, 'Application updated');
}

// Check authorization manually
public function someMethod(Application $application)
{
    if (Gate::allows('submit', $application)) {
        // User can submit
    }

    if (Gate::denies('approve', $application)) {
        // User cannot approve
    }
}
```

---

### Policy Benefits

**Advantages**:
- ✅ **Centralized Authorization**: All rules in one place
- ✅ **Readable**: Clear authorization logic
- ✅ **Testable**: Easy to unit test policies
- ✅ **Reusable**: Same policy across controllers
- ✅ **Automatic**: Laravel auto-discovers policies

**Best Practices**:
- Always use `$this->authorize()` in controllers
- Combine role AND permission checks
- Consider resource state (draft vs published)
- Handle ownership (organization, unit)
- Return `bool` - no exceptions

---

## 4. Repository Pattern

**Purpose**: Abstract data access logic from business logic.

### Implementation

**Eloquent as Repository**:
Laravel's Eloquent ORM serves as a repository pattern out of the box:

```php
// Model acts as repository
class Application extends Model
{
    // Scopes (query filters)
    public function scopeByStatus(Builder $query, string|array $status): Builder
    {
        return is_array($status)
            ? $query->whereIn('status', $status)
            : $query->where('status', $status);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNotIn('status', ['rejected', 'withdrawn']);
    }

    public function scopePendingPayment(Builder $query): Builder
    {
        return $query->whereIn('payment_status', ['pending', 'partial']);
    }

    public function scopeCertified(Builder $query): Builder
    {
        return $query->where('status', 'certified');
    }

    public function scopeRequiringAttention(Builder $query): Builder
    {
        return $query->whereIn('status', [
            'allocation_pending',
            'qc_feedback',
            'committee_feedback'
        ]);
    }
}
```

**Usage**:
```php
// Use scopes to build queries
$applications = Application::byStatus('draft')
    ->active()
    ->pendingPayment()
    ->get();

// Combine scopes
$pendingApps = Application::requireingAttention()
    ->forOrganization($orgId)
    ->orderBy('created_at', 'desc')
    ->paginate(15);
```

---

## 5. State Machine Pattern

**Covered in**: [State Machines Documentation](13-state-machines.md)

**Key Points**:
- Encapsulates state transition logic
- Role-based guards
- Automated actions on transitions
- Audit trail

---

## 6. Observer Pattern (Events)

**Purpose**: Decouple event triggering from event handling.

### Laravel Events & Listeners

**Application Events**:
```php
// Event triggered on status change
event('application.status.changed', [
    'application' => $application,
    'event' => 'application.certified',
    'transition' => 'approve',
    'user' => $user,
]);
```

**Event Listeners**:
```php
// app/Listeners/SendApplicationNotification.php
class SendApplicationNotification
{
    public function handle($event)
    {
        $application = $event['application'];
        $eventType = $event['event'];

        // Send email notification
        Mail::to($application->organization->email)
            ->send(new ApplicationStatusChanged($application, $eventType));

        // Send SMS
        // SMS::send(...);

        // Create in-app notification
        Notification::create([...]);
    }
}
```

**Model Observers**:
```php
// app/Observers/ApplicationObserver.php
class ApplicationObserver
{
    public function created(Application $application)
    {
        // Auto-generate application number
        $application->application_number = 'APP-' . str_pad($application->id, 6, '0', STR_PAD_LEFT);
        $application->save();
    }

    public function updated(Application $application)
    {
        // Sync related data
    }

    public function deleting(Application $application)
    {
        // Delete related documents
        $application->documents()->delete();
    }
}
```

**Register Observer**:
```php
// app/Providers/EventServiceProvider.php
class EventServiceProvider extends ServiceProvider
{
    public function boot()
    {
        Application::observe(ApplicationObserver::class);
        Assessment::observe(AssessmentObserver::class);
    }
}
```

---

## Design Patterns Summary

| Pattern | Purpose | Location | When to Use |
|---------|---------|----------|-------------|
| **Trait** | Code reuse via composition | `app/Traits/` | Cross-cutting concerns, shared behavior |
| **Service Layer** | Business logic encapsulation | `app/Services/` | Complex operations, external integrations |
| **Policy** | Authorization logic | `app/Policies/` | Access control, permissions |
| **Repository** | Data access abstraction | Eloquent Models | Query building, data retrieval |
| **State Machine** | Workflow management | `app/Services/StateMachine/` | Status transitions, workflows |
| **Observer** | Event handling | `app/Observers/` | Model lifecycle events, notifications |

---

## Best Practices

### 1. Use Traits for Cross-Cutting Concerns

```php
// ✅ GOOD - Reusable trait
trait HasAuditLog { ... }

class Application extends Model
{
    use HasAuditLog, HasStateMachine, TracksUserActions;
}
```

### 2. Keep Controllers Thin

```php
// ✅ GOOD - Delegate to service
public function store(Request $request, DocumentService $documentService)
{
    $validated = $request->validated();
    $document = $documentService->upload($request->file('document'), $validated, auth()->user());
    return $this->successResponse($document, 'Document uploaded', 201);
}
```

### 3. Use Policies for Authorization

```php
// ✅ GOOD - Policy authorization
$this->authorize('view', $application);

// ❌ BAD - Inline authorization
if (auth()->user()->organization_id !== $application->organization_id) {
    abort(403);
}
```

### 4. Use Scopes for Query Building

```php
// ✅ GOOD - Reusable scopes
Application::byStatus('draft')->active()->forOrganization($orgId)->get();

// ❌ BAD - Inline queries everywhere
Application::where('status', 'draft')
    ->whereNotIn('status', ['rejected', 'withdrawn'])
    ->where('organization_id', $orgId)
    ->get();
```

### 5. Use State Machines for Workflows

```php
// ✅ GOOD - State machine transition
$application->transitionTo('submit', [], $user);

// ❌ BAD - Direct status update
$application->update(['status' => 'allocation_pending', 'submitted_at' => now()]);
```

---

## Testing Patterns

### Testing Traits

```php
public function test_has_audit_log_trait_logs_creation()
{
    $application = Application::create(['title' => 'Test']);

    $this->assertDatabaseHas('audit_logs', [
        'auditable_type' => Application::class,
        'auditable_id' => $application->id,
        'event' => 'created',
    ]);
}
```

### Testing Services

```php
public function test_document_service_uploads_file()
{
    Storage::fake('documents');

    $file = UploadedFile::fake()->create('test.pdf', 100);
    $documentService = app(DocumentService::class);

    $document = $documentService->upload($file, ['type' => 'test'], $this->user);

    $this->assertNotNull($document->uuid);
    Storage::disk('documents')->assertExists($document->file_path);
}
```

### Testing Policies

```php
public function test_enterprise_admin_can_view_own_application()
{
    $user = User::factory()->enterpriseAdmin()->create();
    $application = Application::factory()->create(['organization_id' => $user->organization_id]);

    $this->assertTrue($user->can('view', $application));
}

public function test_user_cannot_view_other_org_application()
{
    $user = User::factory()->enterpriseAdmin()->create();
    $otherApplication = Application::factory()->create();

    $this->assertFalse($user->can('view', $otherApplication));
}
```

---

## See Also

- [System Architecture](11-system-architecture.md) - Overall architecture
- [State Machines](13-state-machines.md) - Workflow state machines
- [Authorization & RBAC](../20-features/22-authorization-rbac.md) - Roles and permissions

**Code References**:
- [`app/Traits/`](../../app/Traits/) - All traits
- [`app/Services/`](../../app/Services/) - All services
- [`app/Policies/`](../../app/Policies/) - All policies
