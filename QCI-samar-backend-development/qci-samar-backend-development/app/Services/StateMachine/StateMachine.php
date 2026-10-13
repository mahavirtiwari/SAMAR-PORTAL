<?php

namespace App\Services\StateMachine;

use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

abstract class StateMachine
{
    protected Model $model;

    protected array $config;

    protected ?User $user;

    public function __construct(Model $model, ?User $user = null)
    {
        $this->model = $model;
        $this->user = $user ?? Auth::user();
        $this->config = $this->getConfig();
    }

    /**
     * Get state machine configuration.
     * Must be implemented by child classes.
     */
    abstract protected function getConfig(): array;

    /**
     * Get the full state machine configuration.
     */
    public function getStateConfig(): array
    {
        return $this->config;
    }

    /**
     * Get current state.
     */
    public function getCurrentState(): string
    {
        return $this->model->status;
    }

    /**
     * Get all valid states.
     */
    public function getStates(): array
    {
        return array_keys($this->config);
    }

    /**
     * Get available transitions from current state.
     */
    public function getAvailableTransitions(): array
    {
        $currentState = $this->getCurrentState();

        if (! isset($this->config[$currentState])) {
            return [];
        }

        $transitions = [];

        foreach ($this->config[$currentState]['transitions'] ?? [] as $transition => $targetState) {
            if ($this->canTransition($transition)) {
                $transitions[$transition] = $targetState;
            }
        }

        return $transitions;
    }

    /**
     * Check if transition is allowed.
     */
    public function canTransition(string $transition): bool
    {
        $currentState = $this->getCurrentState();

        if (! isset($this->config[$currentState]['transitions'][$transition])) {
            return false;
        }

        // Check guard conditions
        $guards = $this->config[$currentState]['guards'][$transition] ?? [];

        foreach ($guards as $guard) {
            if (! $this->checkGuard($guard)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get the reason why a transition is not allowed.
     *
     * @return string|null Returns null if transition is allowed, otherwise returns the reason
     */
    public function getTransitionBlockedReason(string $transition): ?string
    {
        $currentState = $this->getCurrentState();

        if (! isset($this->config[$currentState]['transitions'][$transition])) {
            return "Transition '{$transition}' is not available from status '{$currentState}'";
        }

        // Check guard conditions and return specific reason
        $guards = $this->config[$currentState]['guards'][$transition] ?? [];

        foreach ($guards as $guard) {
            if (! $this->checkGuard($guard)) {
                return $this->getGuardFailureReason($guard);
            }
        }

        return null;
    }

    /**
     * Get human-readable reason for guard failure.
     */
    protected function getGuardFailureReason(string $guard): string
    {
        if (str_starts_with($guard, 'role:')) {
            $roleSlug = substr($guard, 5);

            return "You must have the '{$roleSlug}' role to perform this action";
        }

        if (str_starts_with($guard, 'permission:')) {
            $permissionSlug = substr($guard, 11);

            return "You don't have the required permission: {$permissionSlug}";
        }

        if (str_starts_with($guard, 'anyRole:')) {
            $roles = explode(',', substr($guard, 8));
            $roleList = implode(' or ', $roles);

            return "You must have one of these roles: {$roleList}";
        }

        // Custom guard methods - check for specific messages
        $guardMessages = $this->getGuardMessages();
        if (isset($guardMessages[$guard])) {
            return $guardMessages[$guard];
        }

        return "Condition '{$guard}' is not satisfied";
    }

    /**
     * Get custom messages for guard failures.
     * Override in child classes to provide specific messages.
     */
    protected function getGuardMessages(): array
    {
        return [];
    }

    /**
     * Transition to new state.
     *
     * @throws \Exception
     */
    public function transition(string $transition, array $data = []): bool
    {
        $currentState = $this->getCurrentState();

        $blockedReason = $this->getTransitionBlockedReason($transition);
        if ($blockedReason !== null) {
            throw new \Exception($blockedReason);
        }

        $targetState = $this->config[$currentState]['transitions'][$transition];
        $auditEvent = $this->auditableTransitions()[$transition] ?? null;

        // Call before transition hook
        $this->beforeTransition($transition, $currentState, $targetState, $data);

        // Update the model status. A whitelisted business transition emits its own
        // semantic audit entry below, so suppress the generic status-only "updated"
        // row the audit trait would otherwise write for the same change.
        if ($auditEvent !== null && method_exists($this->model, 'withoutStatusUpdateAudit')) {
            $this->model::withoutStatusUpdateAudit(fn () => $this->model->update(['status' => $targetState]));
        } else {
            $this->model->update(['status' => $targetState]);
        }

        // Log status change if model has statusHistories relationship
        if (method_exists($this->model, 'statusHistories')) {
            $this->logStatusChange($currentState, $targetState, $data);
        }

        // Record a semantic workflow audit entry for whitelisted business transitions.
        if ($auditEvent !== null && method_exists($this->model, 'logAudit')) {
            $this->logTransitionAudit($auditEvent, $currentState, $targetState, $data);
        }

        // Call after transition hook
        $this->afterTransition($transition, $currentState, $targetState, $data);

        return true;
    }

    /**
     * Transitions that emit a semantic workflow audit entry, keyed by transition
     * name → audit event. Only whitelisted transitions are logged; everything
     * else (self-loops, internal sub-steps) produces no activity entry. Keyed on
     * transition name, not target status, because several transitions share a
     * target (e.g. qc_approve and address_qc_feedback). Override in child machines.
     */
    protected function auditableTransitions(): array
    {
        return [];
    }

    /**
     * Write a semantic workflow audit entry for a whitelisted transition,
     * mirroring the actor / from → to shape of the status-history row. The
     * human label is resolved from the audit event name at read time.
     */
    protected function logTransitionAudit(string $event, string $fromStatus, string $toStatus, array $data): void
    {
        $metadata = [];
        if (isset($data['remarks'])) {
            $metadata['remarks'] = $data['remarks'];
        }
        if (isset($data['metadata']['automated'])) {
            $metadata['automated'] = (bool) $data['metadata']['automated'];
        }

        $this->model->logAudit(
            event: $event,
            oldValues: ['status' => $fromStatus],
            newValues: ['status' => $toStatus],
            changedFields: ['status'],
            metadata: $metadata,
            actor: $this->user,
        );
    }

    /**
     * Check guard condition.
     */
    protected function checkGuard(string $guard): bool
    {
        // Guard format: "role:role_slug" or "permission:permission_slug" or custom method
        if (str_starts_with($guard, 'role:')) {
            $roleSlug = substr($guard, 5);

            return $this->user && $this->user->hasRole($roleSlug);
        }

        // Permission guards are now handled via roles - always return true if user has any role
        if (str_starts_with($guard, 'permission:')) {
            return $this->user && $this->user->activeRoles()->exists();
        }

        if (str_starts_with($guard, 'anyRole:')) {
            $roles = explode(',', substr($guard, 8));

            return $this->user && $this->user->hasAnyRole($roles);
        }

        // Custom guard method
        if (method_exists($this, $guard)) {
            return $this->$guard();
        }

        \Log::warning("Unrecognized guard '{$guard}' in state machine - denying by default", [
            'guard' => $guard,
            'model' => get_class($this->model),
            'model_id' => $this->model->id,
        ]);

        return false;
    }

    /**
     * Log status change to history table.
     */
    protected function logStatusChange(string $fromStatus, string $toStatus, array $data): void
    {
        $this->model->statusHistories()->create([
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'changed_by' => $this->user?->id,
            'changed_by_role' => $this->user?->activeRoles->pluck('slug')->first(),
            'remarks' => $data['remarks'] ?? null,
            'metadata' => $data['metadata'] ?? null,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);
    }

    /**
     * Hook: Before transition.
     */
    protected function beforeTransition(string $transition, string $fromState, string $toState, array $data): void
    {
        // Override in child classes if needed
    }

    /**
     * Hook: After transition.
     */
    protected function afterTransition(string $transition, string $fromState, string $toState, array $data): void
    {
        // Override in child classes if needed
    }

    /**
     * Get transition history.
     *
     * @return Collection
     */
    public function getHistory()
    {
        if (method_exists($this->model, 'statusHistories')) {
            return $this->model->statusHistories()->orderBy('changed_at', 'desc')->get();
        }

        return collect();
    }

    /**
     * Get state label.
     */
    public function getStateLabel(?string $state = null): string
    {
        $state = $state ?? $this->getCurrentState();

        return $this->config[$state]['label'] ?? ucfirst(str_replace('_', ' ', $state));
    }

    /**
     * Get state metadata.
     */
    public function getStateMetadata(?string $state = null): array
    {
        $state = $state ?? $this->getCurrentState();

        return $this->config[$state]['metadata'] ?? [];
    }
}
