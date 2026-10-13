<?php

namespace App\Http\Requests\User;

use App\Models\Role;
use App\Rules\PersonName;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreUserRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        // Authorization handled by policy in controller
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            // Required fields
            'first_name' => ['required', 'string', 'max:50', new PersonName],
            'last_name' => ['required', 'string', 'max:50', new PersonName],
            'email' => ['required', 'email', 'max:320'],
            'mobile_number' => ['required', 'string', 'regex:/^[0-9]{10}$/'],
            'designation' => ['nullable', 'string', 'max:100'],
            'district' => ['nullable', 'string', 'max:100'],
            'state' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:500'],
            'city' => ['nullable', 'string', 'max:100'],
            'pincode' => ['nullable', 'digits:6'],
            'organization_id' => ['nullable', 'integer', 'exists:organizations,id'],

            // Password (optional - will generate temp password if not provided)
            'password' => ['nullable', 'string', 'min:7', 'max:20', 'confirmed'],

            // Status
            'status' => ['sometimes', 'string', Rule::in(['invited', 'pending_verification', 'active', 'inactive', 'suspended'])],

            // Roles
            'roles' => ['sometimes', 'array', 'min:1'],
            'roles.*.slug' => ['required_with:roles', 'string', 'exists:roles,slug'],
            'roles.*.organization_id' => ['nullable', 'integer', 'exists:organizations,id'],
            'roles.*.unit_id' => ['nullable', 'integer', 'exists:units,id'],

            // Assessor-specific fields (validated conditionally in withValidator)
            'assessor_domains' => ['sometimes', 'array'],
            'assessor_domains.*' => ['integer', 'exists:assessor_domains,id'],
            'assessor_districts' => ['sometimes', 'array'],
            'assessor_districts.*' => ['integer', 'exists:districts,id'],

            // Operations Manager state restrictions
            'assigned_states' => ['nullable', 'array'],
            'assigned_states.*' => ['string', 'max:100'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'first_name.required' => 'First name is required.',
            'last_name.required' => 'Last name is required.',
            'email.required' => 'Email address is required.',
            'email.email' => 'Please provide a valid email address.',
            'mobile_number.regex' => 'Mobile number must be exactly 10 digits.',
            'pincode.digits' => 'Pincode must be a 6-digit number.',
            'organization_id.exists' => 'Selected organization does not exist.',
            'password.min' => 'Password must be at least 7 characters.',
            'password.confirmed' => 'Password confirmation does not match.',
            'roles.min' => 'At least one role must be assigned.',
            'roles.*.slug.exists' => 'One or more roles are invalid.',
            'assessor_domains.required' => 'Assessor domains are required when assigning the assessor role.',
            'assessor_domains.array' => 'Assessor domains must be an array.',
            'assessor_domains.*.exists' => 'One or more selected assessor domains are invalid.',
            'assessor_districts.required' => 'Assessor districts are required when assigning the assessor role.',
            'assessor_districts.array' => 'Assessor districts must be an array.',
            'assessor_districts.*.exists' => 'One or more selected assessor districts are invalid.',
        ];
    }

    /**
     * Get custom attribute names for validation errors.
     */
    public function attributes(): array
    {
        return [
            'first_name' => 'first name',
            'last_name' => 'last name',
            'email' => 'email address',
            'mobile_number' => 'mobile number',
            'organization_id' => 'organization',
        ];
    }

    /**
     * Configure the validator instance.
     *
     * @param  Validator  $validator
     * @return void
     */
    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            $user = $this->user();

            if (! $user) {
                return;
            }

            // Validate role assignment permissions
            $roles = $this->input('roles', []);

            // Check which roles are being assigned
            $hasAssessorRole = false;
            $hasOperationsManagerRole = false;
            foreach ($roles as $roleData) {
                $roleSlug = is_array($roleData) ? ($roleData['slug'] ?? null) : $roleData;
                if ($roleSlug === Role::ASSESSOR) {
                    $hasAssessorRole = true;
                }
                if ($roleSlug === Role::OPERATIONS_MANAGER) {
                    $hasOperationsManagerRole = true;
                }
            }

            // Validate assessor domains and states if assessor role is assigned
            if ($hasAssessorRole) {
                $assessorDomains = $this->input('assessor_domains', []);
                $assignedStates = $this->input('assigned_states', []);

                if (empty($assessorDomains) || ! is_array($assessorDomains)) {
                    $validator->errors()->add(
                        'assessor_domains',
                        'Assessor domains are required when assigning the assessor role.'
                    );
                }

                if (empty($assignedStates) || ! is_array($assignedStates)) {
                    $validator->errors()->add(
                        'assigned_states',
                        'Assessment states are required when assigning the assessor role.'
                    );
                }
            }

            // Validate assigned states if operations manager role is assigned
            if ($hasOperationsManagerRole) {
                $assignedStates = $this->input('assigned_states', []);

                if (empty($assignedStates) || ! is_array($assignedStates)) {
                    $validator->errors()->add(
                        'assigned_states',
                        'Assigned states are required when assigning the operations manager role.'
                    );
                }
            }

            // Check if any assigned roles require organization or unit
            $requiresOrganization = false;
            $requiresUnit = false;
            $roleRequiringOrg = null;
            $roleRequiringUnit = null;

            foreach ($roles as $index => $roleData) {
                $roleSlug = is_array($roleData) ? ($roleData['slug'] ?? null) : $roleData;

                if (! $roleSlug) {
                    continue;
                }

                // Fetch role from database to check requirements
                $role = Role::where('slug', $roleSlug)->first();

                if ($role) {
                    // Check organization requirement at role assignment level
                    if ($role->requires_organization) {
                        $roleOrgId = is_array($roleData) ? ($roleData['organization_id'] ?? null) : null;

                        if (! $roleOrgId) {
                            $validator->errors()->add(
                                "roles.{$index}.organization_id",
                                "Role '{$role->name}' requires an organization to be specified in the role assignment."
                            );
                        }
                    }

                    // Check unit requirement at role assignment level
                    if ($role->requires_unit) {
                        $roleUnitId = is_array($roleData) ? ($roleData['unit_id'] ?? null) : null;

                        if (! $roleUnitId) {
                            $validator->errors()->add(
                                "roles.{$index}.unit_id",
                                "Role '{$role->name}' requires a unit to be specified in the role assignment."
                            );
                        }
                    }

                    // Track if any role requires organization (for user-level org validation)
                    if ($role->requires_organization && ! $requiresOrganization) {
                        $requiresOrganization = true;
                        $roleRequiringOrg = $role->name;
                    }
                }

                // System Admin cannot assign Enterprise Admin or Unit Admin
                if ($user->hasRole(Role::SYSTEM_ADMIN)) {
                    if (in_array($roleSlug, [Role::ENTERPRISE_ADMIN, Role::UNIT_ADMIN])) {
                        $roleName = $roleSlug === Role::ENTERPRISE_ADMIN ? 'Enterprise Admin' : 'Unit Admin';
                        $additionalInfo = $roleSlug === Role::ENTERPRISE_ADMIN
                            ? ' Enterprise Admins must self-register via /api/v1/auth/register.'
                            : ' Only Enterprise Admins can assign Unit Admin roles.';

                        $validator->errors()->add(
                            'roles',
                            "System Admins cannot assign the '{$roleName}' role.{$additionalInfo}"
                        );
                    }
                }

                // Enterprise Admin can ONLY assign Unit Admin
                if ($user->hasRole(Role::ENTERPRISE_ADMIN)) {
                    if ($roleSlug !== Role::UNIT_ADMIN) {
                        $validator->errors()->add(
                            'roles',
                            "Enterprise Admins can only assign the 'Unit Admin' role."
                        );
                    }
                }
            }

            // Validate user-level organization_id if any role requires it
            if ($requiresOrganization && ! $this->input('organization_id')) {
                $validator->errors()->add(
                    'organization_id',
                    "Organization is required because role '{$roleRequiringOrg}' requires an organization."
                );
            }
        });
    }
}
