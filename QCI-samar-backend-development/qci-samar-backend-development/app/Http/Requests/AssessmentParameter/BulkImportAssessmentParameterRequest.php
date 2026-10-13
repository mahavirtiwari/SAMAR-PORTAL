<?php

namespace App\Http\Requests\AssessmentParameter;

use App\Models\ManufacturingVendorCategory;
use App\Models\ServiceVendorCategory;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class BulkImportAssessmentParameterRequest extends FormRequest
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
        return [
            'file' => [
                'required',
                'file',
                'mimes:xlsx,xls,csv',
                'max:5120', // 5MB
            ],
            'sector' => [
                'required',
                'string',
                'in:manufacturing,service',
            ],
            // Accept a single string OR an array of strings (multi-select fan-out).
            'enterprise_size' => ['required', 'array', 'min:1'],
            'enterprise_size.*' => ['string', 'in:startup,micro,small,medium,large'],
            'service_provider_type' => [
                'required_if:sector,service',
                'nullable',
                'string',
                'in:annual_maintenance_contract,critical_service_provider,civil_works_contractor',
            ],
            // Accept a single integer OR an array of integers (multi-select fan-out).
            'vendor_category_id' => ['required', 'array', 'min:1'],
            'vendor_category_id.*' => [
                'integer',
                function ($attribute, $value, $fail) {
                    $sector = $this->input('sector');
                    $serviceProviderType = $this->input('service_provider_type');

                    if ($sector === 'manufacturing') {
                        $exists = ManufacturingVendorCategory::query()
                            ->where('id', $value)
                            ->where('is_active', true)
                            ->exists();

                        if (! $exists) {
                            $fail('The selected DRDO vendor category does not exist in manufacturing categories.');
                        }
                    } elseif ($sector === 'service') {
                        $exists = ServiceVendorCategory::query()
                            ->where('id', $value)
                            ->where('service_provider_type', $serviceProviderType)
                            ->where('is_active', true)
                            ->exists();

                        if (! $exists) {
                            $fail('The selected DRDO vendor category does not exist in service categories or does not match the service type.');
                        }
                    }
                },
            ],
        ];
    }

    /**
     * Normalize enterprise_size and vendor_category_id to arrays so the wildcard (.*) rules
     * apply correctly even when a single scalar is submitted (back-compat with single-select).
     */
    protected function prepareForValidation(): void
    {
        $merge = [];

        $enterpriseSize = $this->input('enterprise_size');
        if ($enterpriseSize !== null && ! is_array($enterpriseSize)) {
            $merge['enterprise_size'] = [$enterpriseSize];
        }

        $vendorCategoryId = $this->input('vendor_category_id');
        if ($vendorCategoryId !== null && ! is_array($vendorCategoryId)) {
            $merge['vendor_category_id'] = [$vendorCategoryId];
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
            'file.required' => 'Please upload a file.',
            'file.file' => 'The uploaded file is invalid.',
            'file.mimes' => 'The file must be an Excel (.xlsx, .xls) or CSV (.csv) file.',
            'file.max' => 'The file size must not exceed 5MB.',
            'sector.required' => 'Sector is required.',
            'sector.in' => 'Sector must be either manufacturing or service.',
            'enterprise_size.required' => 'Select at least one enterprise classification.',
            'enterprise_size.*.in' => 'Enterprise size must be one of: startup, micro, small, medium, large.',
            'service_provider_type.required_if' => 'Service provider type is required when sector is service.',
            'service_provider_type.in' => 'Service provider type must be annual_maintenance_contract, critical_service_provider, or civil_works_contractor.',
            'vendor_category_id.required' => 'Select at least one DRDO vendor category.',
            'vendor_category_id.*.integer' => 'DRDO vendor category ID must be an integer.',
        ];
    }
}
