---
title: "State Machines"
category: "architecture"
tags: ["state-machine", "workflow", "application", "assessment"]
related:
  - 11-system-architecture.md
  - ../20-features/23-application-workflow.md
  - ../20-features/24-assessment-workflow.md
code_files:
  - app/Services/StateMachine/ApplicationStateMachine.php
  - app/Services/StateMachine/AssessmentStateMachine.php
  - app/Traits/HasStateMachine.php
last_updated: "2026-07-22"
version: "2.0"
---

# State Machines

**Location**: `docs/10-architecture/13-state-machines.md`
**Related**: [System Architecture](11-system-architecture.md) | [Application Workflow](../20-features/23-application-workflow.md) | [Assessment Workflow](../20-features/24-assessment-workflow.md)

## Overview

The QCI SAMAR system uses **state machines** to manage complex business workflows for applications and assessments. State machines provide:

- **Clear state definitions** with explicit transitions
- **Role-based guards** preventing unauthorized state changes
- **Automated actions** triggered on state transitions
- **Audit trails** tracking all state changes
- **Consistent business logic** across the application

## Architecture

### State Machine Pattern

```
┌──────────────────────────────────────────────────┐
│              HasStateMachine Trait               │
├──────────────────────────────────────────────────┤
│  - stateMachine()                                │
│  - transitionTo()                                │
│  - canTransitionTo()                             │
│  - getAvailableTransitions()                     │
└──────────────────────────────────────────────────┘
                        ▲
                        │
        ┌───────────────┴───────────────┐
        │                               │
┌───────┴────────┐            ┌────────┴─────────┐
│  Application   │            │   Assessment     │
│     Model      │            │      Model       │
└───────┬────────┘            └────────┬─────────┘
        │                               │
        │                               │
┌───────▼────────────┐        ┌────────▼──────────────┐
│  ApplicationState  │        │  AssessmentState      │
│    Machine         │        │    Machine            │
├────────────────────┤        ├───────────────────────┤
│ Role Guards        │        │ Role Guards           │
│ Business Rules     │        │ Business Rules        │
└────────────────────┘        └───────────────────────┘
```

### Component Structure

**Core Files**:
- [`app/Traits/HasStateMachine.php`](../../app/Traits/HasStateMachine.php) - Trait for state machine models
- [`app/Services/StateMachine/StateMachine.php`](../../app/Services/StateMachine/StateMachine.php) - Base state machine
- [`app/Services/StateMachine/ApplicationStateMachine.php`](../../app/Services/StateMachine/ApplicationStateMachine.php) - Application workflow
- [`app/Services/StateMachine/AssessmentStateMachine.php`](../../app/Services/StateMachine/AssessmentStateMachine.php) - Assessment workflow

---

## Application State Machine

Authoritative source: `app/Services/StateMachine/ApplicationStateMachine.php`

---

## Assessment State Machine

Authoritative source: `app/Services/StateMachine/AssessmentStateMachine.php` — its `afterTransition()`
method sets timestamps per transition, syncs the parent application's status, and drives
certificate creation on certification.

---

## Usage

### Using State Machines in Code

#### Check Current State

```php
$application = Application::find(1);
$currentState = $application->status; // 'draft'
$stateLabel = $application->getStatusLabel(); // 'Draft'
```

#### Check Available Transitions

```php
$user = auth()->user();
$availableTransitions = $application->getAvailableTransitions($user);

// Returns a map of transition name => target state (only the transitions
// currently allowed by the guards). Example output for a 'draft' application:
// ['submit' => 'drdo_approval_pending']
```

#### Perform Transition

```php
// Check if transition is allowed
if ($application->canTransitionTo('submit', $user)) {
    // Perform transition
    $application->transitionTo('submit', [], $user);
}

// With additional data (DRDO rejection from drdo_approval_pending)
$application->transitionTo('drdo_reject', [
    'reason' => 'Incomplete documentation'
], $user);
```

#### Get State Metadata

```php
$metadata = $application->getStatusMetadata();

// Example output:
// [
//     'editable' => true,
//     'color' => 'gray',
//     'label' => 'Draft'
// ]
```

### In Controllers

```php
use App\Models\Application;

public function submit(Application $application)
{
    $this->authorize('submit', $application);

    if (!$application->canTransitionTo('submit', auth()->user())) {
        return $this->errorResponse('Cannot submit application', 400);
    }

    try {
        $application->transitionTo('submit', [], auth()->user());
        return $this->successResponse($application, 'Application submitted');
    } catch (\Exception $e) {
        return $this->errorResponse($e->getMessage(), 500);
    }
}
```

---

## Automated Actions

Both state machines run automated actions in their `afterTransition()` hooks — timestamp
updates, cross-model sync (assessment scheduling/certification driving the parent
application's status), and certificate creation on certification.

Authoritative source: `app/Services/StateMachine/ApplicationStateMachine.php` and
`app/Services/StateMachine/AssessmentStateMachine.php`.

---

## Audit Trail

All state transitions are automatically logged to status history tables:

### Application Status History

```php
ApplicationStatusHistory::create([
    'application_id' => $this->id,
    'from_status' => $fromStatus,
    'to_status' => $toStatus,
    'changed_by' => auth()->id(),
    'changed_by_role' => auth()->user()?->activeRoles->first()?->slug,
    'remarks' => $remarks,
    'ip_address' => request()->ip(),
    'user_agent' => request()->userAgent(),
]);
```

### Assessment Status History

```php
AssessmentStatusHistory::create([
    'assessment_id' => $this->id,
    'from_status' => $fromStatus,
    'to_status' => $toState,
    'changed_by' => auth()->id(),
    'changed_by_role' => auth()->user()?->activeRoles->first()?->slug,
    'remarks' => $remarks,
    'ip_address' => request()->ip(),
    'user_agent' => request()->userAgent(),
]);
```

---

## Testing State Machines

### Unit Tests

```php
public function test_application_can_transition_from_draft_to_pending()
{
    $user = User::factory()->enterpriseAdmin()->create();
    $application = Application::factory()->draft()->create([
        'organization_id' => $user->organization_id
    ]);

    $this->assertTrue($application->canTransitionTo('submit', $user));
    $application->transitionTo('submit', [], $user);

    $this->assertEquals('drdo_approval_pending', $application->fresh()->status);
}

public function test_unauthorized_user_cannot_transition()
{
    $user = User::factory()->assessor()->create();
    $application = Application::factory()->draft()->create();

    $this->assertFalse($application->canTransitionTo('submit', $user));
}
```

---

## Configuration Reference

### State Machine Components

**Trait**: `HasStateMachine`
- Provides state machine methods to models
- Methods: `stateMachine()`, `transitionTo()`, `canTransitionTo()`, `getAvailableTransitions()`

**Base Class**: `StateMachine`
- Abstract base for all state machines
- Implements core transition logic
- Provides guard evaluation and hooks

**State Configuration**:
```php
[
    'state_name' => [
        'label' => 'Human Readable Label',
        'transitions' => [
            'transition_name' => 'target_state'
        ],
        'guards' => [
            'transition_name' => ['role:admin', 'customGuard']
        ],
        'metadata' => [
            'color' => 'blue',
            'editable' => false,
            'final' => false
        ]
    ]
]
```

---

## Best Practices

### 1. Always Use State Machines

Never update status directly:

```php
// ❌ BAD - Direct status update
$application->update(['status' => 'certified']);

// ✅ GOOD - Use state machine (certification transition into 'certified')
$application->transitionTo('certify', [], $user);
```

### 2. Check Permissions First

```php
// Check both policy and state machine
$this->authorize('submit', $application);

if (!$application->canTransitionTo('submit', $user)) {
    abort(400, 'Cannot submit application');
}

$application->transitionTo('submit', [], $user);
```

### 3. Handle Exceptions

```php
try {
    $application->transitionTo('submit', [], $user);
} catch (\App\Exceptions\InvalidTransitionException $e) {
    return response()->json([
        'error' => $e->getMessage(),
        'available_transitions' => $application->getAvailableTransitions($user)
    ], 400);
}
```

### 4. Use Metadata for UI

```php
$metadata = $application->getStatusMetadata();

// Use color for badges
$badgeColor = $metadata['color']; // 'green', 'red', 'blue', etc.

// Check if editable
if ($metadata['editable']) {
    // Show edit button
}

// Check if final state
if ($metadata['final'] ?? false) {
    // Hide transition buttons
}
```

---

## See Also

- [System Architecture](11-system-architecture.md) - Overall system design
- [Application Workflow](../20-features/23-application-workflow.md) - Application lifecycle details
- [Assessment Workflow](../20-features/24-assessment-workflow.md) - Assessment process details
- [Authorization & RBAC](../20-features/22-authorization-rbac.md) - Role-based access control
- [Audit Trail](../20-features/29-audit-trail.md) - Audit logging system

**Code References**:
- [`ApplicationStateMachine`](../../app/Services/StateMachine/ApplicationStateMachine.php) - Application workflow
- [`AssessmentStateMachine`](../../app/Services/StateMachine/AssessmentStateMachine.php) - Assessment workflow
- [`HasStateMachine` trait](../../app/Traits/HasStateMachine.php) - State machine trait
- [`ApplicationPolicy`](../../app/Policies/ApplicationPolicy.php) - Application authorization
