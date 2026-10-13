<?php

namespace App\Http\Requests\AssessmentParameter;

use App\Rules\EntityName;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreAssessmentParameterRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        // Authorization handled in controller
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $sector = $this->input('sector');
        $vendorCategoryTable = $sector === 'service'
            ? 'service_vendor_categories'
            : 'manufacturing_vendor_categories';

        return [
            'name' => ['required', 'string', 'max:150', new EntityName],
            'discipline_id' => ['nullable', 'integer', 'exists:disciplines,id'],

            // Accept a single integer OR an array of integers
            'vendor_category_id' => ['nullable'],
            'vendor_category_id.*' => ['integer', "exists:{$vendorCategoryTable},id"],

            'sector' => ['required', 'string', 'in:manufacturing,service'],

            // Accept a single string OR an array of strings
            'enterprise_size' => ['required'],
            'enterprise_size.*' => ['string', 'in:startup,micro,small,medium,large'],

            'service_provider_type' => ['nullable', 'string', 'in:annual_maintenance_contract,critical_service_provider,civil_works_contractor', 'required_if:sector,service'],
            'is_mandatory' => ['nullable', 'boolean'],
        ];
    }

    /**
     * Prepare the data for validation.
     * Normalize vendor_category_id and enterprise_size to arrays so wildcard
     * rules (.*) apply correctly even when single scalars are submitted.
     */
    protected function prepareForValidation(): void
    {
        $vendorCategoryId = $this->input('vendor_category_id');
        $enterpriseSize = $this->input('enterprise_size');

        $merge = [];

        if ($vendorCategoryId !== null && ! is_array($vendorCategoryId)) {
            $merge['vendor_category_id'] = [$vendorCategoryId];
        }

        if ($enterpriseSize !== null && ! is_array($enterpriseSize)) {
            $merge['enterprise_size'] = [$enterpriseSize];
        }

        if (! empty($merge)) {
            $this->merge($merge);
        }
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Parameter name is required.',
            'discipline_id.exists' => 'Selected discipline does not exist.',
            'sector.required' => 'Sector is required.',
            'sector.in' => 'Sector must be either manufacturing or service.',
            'enterprise_size.required' => 'Enterprise size is required.',
            'enterprise_size.*.string' => 'Each enterprise size must be a string.',
            'enterprise_size.*.in' => 'Invalid enterprise size. Allowed: startup, micro, small, medium, large.',
            'vendor_category_id.*.integer' => 'Each vendor category ID must be an integer.',
            'vendor_category_id.*.exists' => 'One or more selected DRDO vendor categories do not exist.',
            'service_provider_type.required_if' => 'Service provider type is required when sector is service.',
            'service_provider_type.in' => 'Service provider type must be annual_maintenance_contract, critical_service_provider, or civil_works_contractor.',
        ];
    }
}
