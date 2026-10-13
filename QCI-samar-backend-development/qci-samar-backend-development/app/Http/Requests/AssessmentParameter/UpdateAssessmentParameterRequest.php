<?php

namespace App\Http\Requests\AssessmentParameter;

use App\Models\AssessmentParameter;
use App\Rules\EntityName;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateAssessmentParameterRequest extends FormRequest
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
        $parameterId = $this->route('id');

        // Determine sector from request or existing model
        $sector = $this->input('sector');
        if (! $sector) {
            $parameter = AssessmentParameter::find($parameterId);
            $sector = $parameter?->sector;
        }

        $vendorCategoryTable = $sector === 'service'
            ? 'service_vendor_categories'
            : 'manufacturing_vendor_categories';

        return [
            'name' => ['sometimes', 'string', 'max:150', new EntityName],
            'discipline_id' => ['nullable', 'integer', 'exists:disciplines,id'],
            'vendor_category_id' => ['nullable', 'integer', "exists:{$vendorCategoryTable},id"],
            'sector' => ['sometimes', 'string', 'in:manufacturing,service'],
            'enterprise_size' => ['sometimes', 'string', 'in:startup,micro,small,medium,large'],
            'service_provider_type' => ['nullable', 'string', 'in:annual_maintenance_contract,critical_service_provider,civil_works_contractor', 'required_if:sector,service'],
            'is_mandatory' => ['nullable', 'boolean'],
        ];
    }

    /**
     * Configure the validator instance.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $this->validateUniqueParameter($validator);
        });
    }

    /**
     * Validate that the assessment parameter is unique based on sector-specific rules.
     * Excludes the current parameter being updated.
     */
    protected function validateUniqueParameter(Validator $validator): void
    {
        $parameterId = $this->route('id');
        $existingParameter = AssessmentParameter::find($parameterId);

        if (! $existingParameter) {
            return;
        }

        // Merge request data with existing data (request takes precedence)
        $sector = $this->input('sector', $existingParameter->sector);
        $name = trim($this->input('name', $existingParameter->name));
        $disciplineId = $this->has('discipline_id') ? $this->input('discipline_id') : $existingParameter->discipline_id;
        $isMandatory = $this->has('is_mandatory')
            ? filter_var($this->input('is_mandatory'), FILTER_VALIDATE_BOOLEAN)
            : $existingParameter->is_mandatory;
        $enterpriseSize = $this->input('enterprise_size', $existingParameter->enterprise_size);
        $vendorCategoryId = $this->has('vendor_category_id')
            ? $this->input('vendor_category_id')
            : $existingParameter->vendor_category_id;
        $serviceProviderType = $this->has('service_provider_type')
            ? $this->input('service_provider_type')
            : $existingParameter->service_provider_type;

        $query = AssessmentParameter::query()
            ->whereRaw('LOWER(TRIM(name)) = ?', [strtolower($name)])
            ->where('sector', $sector)
            ->where('is_mandatory', $isMandatory)
            ->where('enterprise_size', $enterpriseSize)
            ->where('id', '!=', $parameterId);

        // Handle nullable discipline_id
        if ($disciplineId === null) {
            $query->whereNull('discipline_id');
        } else {
            $query->where('discipline_id', $disciplineId);
        }

        // Handle nullable vendor_category_id
        if ($vendorCategoryId === null) {
            $query->whereNull('vendor_category_id');
        } else {
            $query->where('vendor_category_id', $vendorCategoryId);
        }

        // For service sector, also check service_provider_type
        if ($sector === 'service') {
            if ($serviceProviderType === null) {
                $query->whereNull('service_provider_type');
            } else {
                $query->where('service_provider_type', $serviceProviderType);
            }
        }

        if ($query->exists()) {
            $errorMessage = $sector === 'service'
                ? 'This service assessment parameter already exists for the selected discipline, service provider type, classification, and vendor category.'
                : 'This parameter already exists for the selected discipline, classification, and vendor category.';

            $validator->errors()->add('name', $errorMessage);
        }
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'discipline_id.exists' => 'Selected discipline does not exist.',
            'sector.in' => 'Sector must be either manufacturing or service.',
            'enterprise_size.in' => 'Invalid enterprise size selected.',
            'service_provider_type.required_if' => 'Service provider type is required when sector is service.',
            'service_provider_type.in' => 'Service provider type must be annual_maintenance_contract, critical_service_provider, or civil_works_contractor.',
            'vendor_category_id.exists' => 'Selected DRDO vendor category does not exist.',
        ];
    }
}
