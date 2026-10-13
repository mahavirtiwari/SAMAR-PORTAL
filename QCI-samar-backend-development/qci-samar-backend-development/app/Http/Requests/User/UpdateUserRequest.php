<?php

namespace App\Http\Requests\User;

use App\Models\User;
use App\Rules\PersonName;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateUserRequest extends FormRequest
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
        $userId = $this->route('id');
        $currentUser = $this->user();
        $isSelfUpdate = $currentUser && $currentUser->id == $userId;

        $rules = [
            // Personal information
            'first_name' => ['sometimes', 'string', 'max:50', new PersonName],
            'last_name' => ['sometimes', 'string', 'max:50', new PersonName],
            'email' => ['sometimes', 'email', 'max:320'],
            'mobile_number' => ['sometimes', 'required', 'string', 'regex:/^[0-9]{10}$/'],
            'designation' => ['nullable', 'string', 'max:100'],
            'district' => ['nullable', 'string', 'max:100'],
            'state' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:500'],
            'city' => ['nullable', 'string', 'max:100'],
            'pincode' => ['nullable', 'digits:6'],

            // Password (only for admins updating users or self password change)
            'password' => ['nullable', 'string', 'min:7', 'max:20', 'confirmed'],

            // Status (admin only fields)
            'status' => ['sometimes', 'string', Rule::in(['active', 'inactive', 'suspended'])],
            'organization_id' => ['nullable', 'integer', 'exists:organizations,id'],

            // Assessor-specific fields (optional on update)
            'assessor_domains' => ['sometimes', 'array'],
            'assessor_domains.*' => ['integer', 'exists:assessor_domains,id'],
            'assessor_districts' => ['sometimes', 'array'],
            'assessor_districts.*' => ['integer', 'exists:districts,id'],

            // Operations Manager state restrictions
            'assigned_states' => ['nullable', 'array'],
            'assigned_states.*' => ['string', 'max:100'],
        ];

        // Only require current_password when user is updating their own password
        if ($isSelfUpdate) {
            $rules['current_password'] = ['required_with:password', 'string'];
        } else {
            $rules['current_password'] = ['nullable', 'string'];
        }

        return $rules;
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'email.email' => 'Please provide a valid email address.',
            'mobile_number.regex' => 'Mobile number must be exactly 10 digits.',
            'pincode.digits' => 'Pincode must be a 6-digit number.',
            'password.min' => 'Password must be at least 7 characters.',
            'password.confirmed' => 'Password confirmation does not match.',
            'current_password.required_with' => 'Current password is required to change password.',
            'organization_id.exists' => 'Selected organization does not exist.',
            'assessor_domains.array' => 'Assessor domains must be an array.',
            'assessor_domains.*.exists' => 'One or more selected assessor domains are invalid.',
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
            'current_password' => 'current password',
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
            // Get the user being updated
            $userId = $this->route('id');
            $targetUser = User::find($userId);

            if (! $targetUser) {
                return;
            }

            // If organization_id is being updated, validate it against user's roles
            if ($this->has('organization_id')) {
                $newOrgId = $this->input('organization_id');

                // Check if user has any roles that require organization
                $rolesRequiringOrg = $targetUser->roles()->where('requires_organization', true)->get();

                if ($rolesRequiringOrg->isNotEmpty() && ! $newOrgId) {
                    $roleNames = $rolesRequiringOrg->pluck('name')->join(', ');
                    $validator->errors()->add(
                        'organization_id',
                        "Cannot remove organization because the user has role(s) that require it: {$roleNames}"
                    );
                }
            }
        });
    }

    /**
     * Prepare data for validation.
     */
    protected function prepareForValidation(): void
    {
        // Remove roles from update request (handled by separate endpoint)
        if ($this->has('roles')) {
            $this->request->remove('roles');
        }
    }
}
