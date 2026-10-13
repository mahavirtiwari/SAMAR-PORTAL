<?php

namespace App\Traits;

use App\Models\User;
use App\Services\StateMachine\StateMachine;
use Illuminate\Database\Eloquent\Collection;

trait HasStateMachine
{
    /**
     * Get state machine instance for the model.
     */
    public function stateMachine(?User $user = null): StateMachine
    {
        $class = $this->getStateMachineClass();

        return new $class($this, $user);
    }

    /**
     * Get the state machine class name.
     * Must be defined in the model using this trait.
     */
    abstract protected function getStateMachineClass(): string;

    /**
     * Transition to a new state.
     *
     * @throws \Exception
     */
    public function transitionTo(string $transition, array $data = [], ?User $user = null): bool
    {
        return $this->stateMachine($user)->transition($transition, $data);
    }

    /**
     * Check if a transition is allowed.
     */
    public function canTransitionTo(string $transition, ?User $user = null): bool
    {
        return $this->stateMachine($user)->canTransition($transition);
    }

    /**
     * Get available transitions from current state.
     */
    public function getAvailableTransitions(?User $user = null): array
    {
        return $this->stateMachine($user)->getAvailableTransitions();
    }

    /**
     * Get current state label.
     */
    public function getStatusLabel(): string
    {
        return $this->stateMachine()->getStateLabel();
    }

    /**
     * Get state metadata.
     */
    public function getStatusMetadata(): array
    {
        return $this->stateMachine()->getStateMetadata();
    }

    /**
     * Get transition history.
     *
     * @return Collection
     */
    public function getTransitionHistory()
    {
        return $this->stateMachine()->getHistory();
    }
}
