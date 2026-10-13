<?php

namespace App\Services\StateMachine;

use App\Models\Role;

class UserStateMachine extends StateMachine
{
    /**
     * User status transitions.
     */
    public const TRANSITION_VERIFY = 'verify';

    public const TRANSITION_ACTIVATE = 'activate';

    public const TRANSITION_DEACTIVATE = 'deactivate';

    public const TRANSITION_SUSPEND = 'suspend';

    public const TRANSITION_REACTIVATE = 'reactivate';

    /**
     * User statuses.
     */
    public const STATUS_INVITED = 'invited';

    public const STATUS_PENDING_VERIFICATION = 'pending_verification';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    public const STATUS_SUSPENDED = 'suspended';

    /**
     * Get state machine configuration for User workflow.
     *
     * User Status Flow:
     * - invited → active (on first successful login/OTP verification)
     * - pending_verification → active (on OTP verification during registration)
     * - active → inactive (admin deactivates)
     * - active → suspended (admin suspends)
     * - inactive → active (admin reactivates)
     * - suspended → active (admin reactivates)
     */
    protected function getConfig(): array
    {
        return [
            self::STATUS_INVITED => [
                'label' => 'Invited',
                'transitions' => [
                    self::TRANSITION_VERIFY => self::STATUS_ACTIVE,
                ],
                'guards' => [
                    self::TRANSITION_VERIFY => [], // No guards - system transition on login
                ],
                'metadata' => [
                    'can_login' => true,
                    'can_delete' => true,
                    'color' => 'yellow',
                    'description' => 'User has been invited but has not completed first login',
                ],
            ],

            self::STATUS_PENDING_VERIFICATION => [
                'label' => 'Pending Verification',
                'transitions' => [
                    self::TRANSITION_VERIFY => self::STATUS_ACTIVE,
                ],
                'guards' => [
                    self::TRANSITION_VERIFY => [], // No guards - system transition on OTP verification
                ],
                'metadata' => [
                    'can_login' => false,
                    'can_delete' => true,
                    'color' => 'orange',
                    'description' => 'User has registered but has not verified their email',
                ],
            ],

            self::STATUS_ACTIVE => [
                'label' => 'Active',
                'transitions' => [
                    self::TRANSITION_DEACTIVATE => self::STATUS_INACTIVE,
                    self::TRANSITION_SUSPEND => self::STATUS_SUSPENDED,
                ],
                'guards' => [
                    self::TRANSITION_DEACTIVATE => ['canChangeStatus'],
                    self::TRANSITION_SUSPEND => ['canChangeStatus'],
                ],
                'metadata' => [
                    'can_login' => true,
                    'can_delete' => false,
                    'color' => 'green',
                    'description' => 'User account is fully active',
                ],
            ],

            self::STATUS_INACTIVE => [
                'label' => 'Inactive',
                'transitions' => [
                    self::TRANSITION_REACTIVATE => self::STATUS_ACTIVE,
                ],
                'guards' => [
                    self::TRANSITION_REACTIVATE => ['canChangeStatus'],
                ],
                'metadata' => [
                    'can_login' => false,
                    'can_delete' => false,
                    'color' => 'gray',
                    'description' => 'User account has been deactivated by admin',
                ],
            ],

            self::STATUS_SUSPENDED => [
                'label' => 'Suspended',
                'transitions' => [
                    self::TRANSITION_REACTIVATE => self::STATUS_ACTIVE,
                ],
                'guards' => [
                    self::TRANSITION_REACTIVATE => ['canChangeStatus'],
                ],
                'metadata' => [
                    'can_login' => false,
                    'can_delete' => false,
                    'color' => 'red',
                    'description' => 'User account has been suspended',
                ],
            ],
        ];
    }

    /**
     * Guard: Check if the current user can change the target user's status.
     */
    protected function canChangeStatus(): bool
    {
        // No user context (system operation)
        if (! $this->user) {
            return false;
        }

        // Cannot change own status
        if ($this->user->id === $this->model->id) {
            return false;
        }

        // System Admins can change any user's status
        if ($this->user->hasRole(Role::SYSTEM_ADMIN)) {
            return true;
        }

        // Enterprise Admins can change status of users in their organization
        if ($this->user->hasRole(Role::ENTERPRISE_ADMIN) &&
            $this->user->organization_id === $this->model->organization_id) {
            return true;
        }

        return false;
    }

    /**
     * Hook: After transition - update related timestamps.
     */
    protected function afterTransition(string $transition, string $fromState, string $toState, array $data): void
    {
        // Set email_verified_at when user is verified/activated
        if ($transition === self::TRANSITION_VERIFY && ! $this->model->email_verified_at) {
            $this->model->update(['email_verified_at' => now()]);
        }
    }

    /**
     * Check if the user can login based on their current status.
     */
    public function canLogin(): bool
    {
        $currentState = $this->getCurrentState();
        $metadata = $this->config[$currentState]['metadata'] ?? [];

        return $metadata['can_login'] ?? false;
    }

    /**
     * Check if the user can be deleted based on their current status.
     */
    public function canDelete(): bool
    {
        $currentState = $this->getCurrentState();
        $metadata = $this->config[$currentState]['metadata'] ?? [];

        return $metadata['can_delete'] ?? false;
    }

    /**
     * Get all statuses that allow login.
     */
    public static function getLoginAllowedStatuses(): array
    {
        return [self::STATUS_ACTIVE, self::STATUS_INVITED];
    }

    /**
     * Get all statuses that allow deletion.
     */
    public static function getDeletableStatuses(): array
    {
        return [self::STATUS_INVITED, self::STATUS_PENDING_VERIFICATION];
    }
}
