<?php

namespace App\Http\Requests\FeeConfiguration;

use App\Models\FeeConfiguration;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateFeeConfigurationRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
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
            'sector' => [
                'sometimes',
                'required',
                'string',
                Rule::in(FeeConfiguration::getSectors()),
            ],
            'enterprise_size' => [
                'sometimes',
                'required',
                'string',
                Rule::in(FeeConfiguration::getEnterpriseSizes()),
            ],
            'base_certification_fee' => [
                'sometimes',
                'required',
                'numeric',
                'min:0',
                'max:99999999.99',
            ],
            'food_and_accommodation_fee' => [
                'sometimes',
                'required',
                'numeric',
                'min:0',
                'max:99999999.99',
            ],
            'gst_percentage' => [
                'sometimes',
                'required',
                'numeric',
                'min:0',
                'max:100',
            ],
            'tds_enabled' => [
                'sometimes',
                'boolean',
            ],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'sector.in' => 'Sector must be either manufacturing or service.',
            'enterprise_size.in' => 'Enterprise size must be one of: startup, micro, small, medium, large.',
            'base_certification_fee.numeric' => 'Base certification fee must be a valid number.',
            'base_certification_fee.min' => 'Base certification fee cannot be negative.',
            'food_and_accommodation_fee.numeric' => 'Food and accommodation fee must be a valid number.',
            'food_and_accommodation_fee.min' => 'Food and accommodation fee cannot be negative.',
            'gst_percentage.numeric' => 'GST percentage must be a valid number.',
            'gst_percentage.min' => 'GST percentage cannot be negative.',
            'gst_percentage.max' => 'GST percentage cannot exceed 100%.',
        ];
    }

    /**
     * Get custom attributes for validator errors.
     *
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'sector' => 'sector',
            'enterprise_size' => 'enterprise size',
            'base_certification_fee' => 'base certification fee',
            'food_and_accommodation_fee' => 'food and accommodation fee',
            'gst_percentage' => 'GST percentage',
        ];
    }

    /**
     * Configure the validator instance.
     *
     * @param  Validator  $validator
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            // Check for duplicate sector + enterprise_size combination (excluding current record)
            $sector = $this->sector;
            $enterpriseSize = $this->enterprise_size;
            $currentId = $this->route('id');

            if ($sector || $enterpriseSize) {
                $current = FeeConfiguration::find($currentId);

                if ($current) {
                    $checkSector = $sector ?? $current->sector;
                    $checkEnterpriseSize = $enterpriseSize ?? $current->enterprise_size;

                    $exists = FeeConfiguration::where('sector', $checkSector)
                        ->where('enterprise_size', $checkEnterpriseSize)
                        ->where('id', '!=', $currentId)
                        ->exists();

                    if ($exists) {
                        $validator->errors()->add(
                            'sector',
                            'A fee configuration for this sector and enterprise size combination already exists.'
                        );
                    }
                }
            }
        });
    }
}
