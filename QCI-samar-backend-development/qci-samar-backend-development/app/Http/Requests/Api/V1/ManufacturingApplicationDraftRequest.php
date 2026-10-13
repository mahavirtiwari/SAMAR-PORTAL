<?php

namespace App\Http\Requests\Api\V1;

use App\Rules\PersonName;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ManufacturingApplicationDraftRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // Authorization handled by controller/policy
    }

    /**
     * Prepare the data for validation.
     */
    protected function prepareForValidation()
    {
        $input = $this->all();
        $transformedInput = $this->transformKeys($input);

        // Accept numeric vendorCategory from frontends (id)
        if (isset($transformedInput['vendor_category']) && is_numeric($transformedInput['vendor_category'])) {
            // keep as string representation for DB, but allow numeric input
            $transformedInput['vendor_category'] = (string) $transformedInput['vendor_category'];
        }

        // mfg_drdo_vendor_stores expects array of objects [{store_name: string}]
        // No special normalization needed - JSON parsing handles it

        // If mfg_products are present, ensure export_percentage is null when is_exported is falsy
        if (isset($transformedInput['mfg_products']) && is_array($transformedInput['mfg_products'])) {
            foreach ($transformedInput['mfg_products'] as $idx => $prod) {
                $isExported = $prod['is_exported'] ?? null;
                if (! $isExported) {
                    $transformedInput['mfg_products'][$idx]['export_percentage'] = null;
                }
            }
        }

        // If mfg_raw_materials present, ensure import_percentage is null when is_imported is falsy
        if (isset($transformedInput['mfg_raw_materials']) && is_array($transformedInput['mfg_raw_materials'])) {
            foreach ($transformedInput['mfg_raw_materials'] as $idx => $mat) {
                $isImported = $mat['is_imported'] ?? null;
                if (! $isImported) {
                    $transformedInput['mfg_raw_materials'][$idx]['import_percentage'] = null;
                }
            }
        }

        // If mfg_bought_out_parts present, ensure import_percentage is null when is_imported is falsy
        if (isset($transformedInput['mfg_bought_out_parts']) && is_array($transformedInput['mfg_bought_out_parts'])) {
            foreach ($transformedInput['mfg_bought_out_parts'] as $idx => $part) {
                $isImported = $part['is_imported'] ?? null;
                if (! $isImported) {
                    $transformedInput['mfg_bought_out_parts'][$idx]['import_percentage'] = null;
                }
            }
        }

        $this->replace($transformedInput);
    }

    /**
     * Transform camelCase keys to snake_case recursively and handle form data.
     */
    private function transformKeys(array $data): array
    {
        $transformed = [];

        foreach ($data as $key => $value) {
            $snakeKey = $this->camelToSnake($key);

            if (is_array($value)) {
                $transformed[$snakeKey] = $this->transformKeys($value);
            } else {
                // normalize string values by trimming whitespace
                if (is_string($value)) {
                    $trimmedValue = trim($value);
                } else {
                    $trimmedValue = $value;
                }

                // Handle JSON strings from multipart/form-data
                if (is_string($trimmedValue) && $this->isJsonArray($trimmedValue)) {
                    $decoded = json_decode($trimmedValue, true);
                    $transformed[$snakeKey] = is_array($decoded) ? $this->transformKeys($decoded) : $decoded;
                }
                // Handle boolean strings
                elseif (in_array($trimmedValue, ['true', 'false'], true)) {
                    $transformed[$snakeKey] = $trimmedValue === 'true';
                }
                // Handle comma-separated strings for simple string arrays
                elseif (is_string($trimmedValue) && in_array($snakeKey, ['third_party_certifications', 'blacklisted_organizations'])) {
                    $transformed[$snakeKey] = $trimmedValue ? array_map('trim', explode(',', $trimmedValue)) : [];
                } else {
                    // Convert empty strings for numeric/decimal fields to null to avoid SQL errors
                    $numericKeys = [
                        'export_percentage', 'total_production_capacity', 'current_utilized_capacity',
                        'production_capacity', 'import_percentage',
                        'total_services_capacity',
                    ];

                    if (is_string($trimmedValue) && $trimmedValue === '' && in_array($snakeKey, $numericKeys, true)) {
                        $transformed[$snakeKey] = null;
                    } else {
                        $transformed[$snakeKey] = $trimmedValue;
                    }
                }
            }
        }

        return $transformed;
    }

    /**
     * Check if a string is a JSON array.
     */
    private function isJsonArray(string $value): bool
    {
        $value = trim($value);
        if (empty($value) || (! str_starts_with($value, '[') && ! str_starts_with($value, '{'))) {
            return false;
        }

        $decoded = json_decode($value, true);

        return json_last_error() === JSON_ERROR_NONE && is_array($decoded);
    }

    /**
     * Convert camelCase string to snake_case.
     */
    private function camelToSnake(string $input): string
    {
        return strtolower(preg_replace('/(?<!^)[A-Z]/', '_$0', $input));
    }

    /**
     * Get the validation rules that apply to the request.
     * For draft applications, all fields are optional. Unit is auto-created from application data.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            // service_provider_type is not allowed for manufacturing
            'service_provider_type' => 'prohibited',

            // organization_id is derived from authenticated user's token (not accepted in request)
            // organization_name is denormalized data for immutability
            'organization_name' => 'nullable|string|max:255',

            // Application ID - used to update existing draft instead of creating new one
            // Scoped to the authenticated user's organization to prevent ID enumeration
            'application_id' => [
                'nullable',
                'integer',
                Rule::exists('applications', 'id')->where('organization_id', auth()->user()?->organization_id ?? 0),
            ],

            // Application Type
            'application_type' => 'nullable|in:new,renewal',

            // DRDO Vendor Information
            'is_existing_drdo_vendor' => 'nullable|boolean',
            // Vendor category stored as string in DB but frontend may send numeric id
            'vendor_category' => ['nullable', 'sometimes', 'string', 'max:100'],
            // Accept array of objects [{store_name: string}]
            'mfg_drdo_vendor_stores' => ['nullable', 'array'],
            'mfg_drdo_vendor_stores.*.store_name' => 'nullable|string|max:255',
            'drdo_registration_number' => 'nullable|string|max:255',
            // Accept file upload OR existing path string (for draft resume)
            'drdo_certificate_file' => 'nullable',

            // Enterprise Information
            'enterprise_classification' => 'nullable|in:startup,micro,small,medium,large',
            'enterprise_name' => 'nullable|string|max:255',

            // Registered Office Details
            'registered_office_address' => 'nullable|string|max:500',
            'registered_office_state' => 'nullable|string|max:100',
            'registered_office_district' => 'nullable|string|max:100',
            'registered_office_district_code' => 'nullable|string|max:10',
            'registered_office_pincode' => 'nullable|string|max:10',
            'registered_office_mobile' => 'nullable|string|max:10',
            'registered_office_landline' => 'nullable|string|max:12',
            'registered_office_email' => 'nullable|email|max:320',
            'registered_office_alternate_email' => 'nullable|email|max:320',

            // Unit Details
            'unit_name' => 'nullable|string|max:255',
            'unit_address' => 'nullable|string|max:500',
            'unit_state' => 'nullable|string|max:100',
            'unit_district' => 'nullable|string|max:100',
            'unit_pincode' => 'nullable|string|max:10',
            'unit_mobile' => 'nullable|string|max:10',
            'unit_landline' => 'nullable|string|max:12',
            'unit_email' => 'nullable|email|max:320',
            'unit_alternate_email' => 'nullable|email|max:320',
            'unit_commencement_date' => 'nullable|date_format:Y-m-d',
            // Accept file upload OR existing path string (for draft resume)
            'site_exterior_photo' => 'nullable',

            // Contact Person
            'contact_person_name' => ['nullable', 'string', 'max:255', new PersonName],
            'contact_person_designation' => 'nullable|string|max:255',
            'contact_person_mobile' => 'nullable|string|max:10',
            'contact_person_email' => 'nullable|email|max:320',

            // Ownership & Employees
            // Allowed canonical values: proprietorship, partnership, private_limited, public_limited, joint_venture, limited_liability_partnership, other
            'ownership_type' => 'nullable|in:proprietorship,partnership,private_limited,public_limited,joint_venture,limited_liability_partnership,other',
            'male_employees_count' => 'nullable|integer|min:0',
            'female_employees_count' => 'nullable|integer|min:0',
            'other_employees_count' => 'nullable|integer|min:0',

            // GST Information
            'gst_number' => 'nullable|string|max:15',
            // Accept file upload OR existing path string (for draft resume)
            'gst_certificate_file' => 'nullable',
            // Tri-state: null keeps "not answered" distinct from an answered No
            'has_gst' => 'nullable|boolean',

            // Government Registration
            'govt_organisation_name' => 'nullable|string|max:255',
            // Accept file upload OR existing path string (for draft resume)
            'govt_registration_certificate' => 'nullable',
            'has_govt_registration' => 'nullable|boolean',

            // Other Registrations
            'dpiit_registration_number' => 'nullable|string|max:20',
            // Accept file upload OR existing path string (for draft resume)
            'dpiit_certificate_file' => 'nullable',
            'udyam_registration_number' => 'nullable|string|max:255',
            // Accept file upload OR existing path string (for draft resume)
            'udyam_certificate_file' => 'nullable',
            // CIN (Corporate Identification Number) - 21-character alphanumeric code
            'cin' => 'nullable|string|max:21',
            // Accept file upload OR existing path string (for draft resume)
            'incorporation_certificate_file' => 'nullable',

            // Manufacturing Production Details
            'mfg_production_capacity' => 'nullable|numeric|min:0',
            'mfg_capacity_unit' => 'nullable|string|max:50',

            // Certifications (array of certification names)
            'third_party_certifications' => 'nullable|array',
            'third_party_certifications.*' => 'nullable|string|max:255',

            // Blacklisting & Enquiry
            'is_blacklisted' => 'nullable|boolean',
            'blacklisted_organizations' => 'nullable|array',
            'has_ongoing_enquiry' => 'nullable|boolean',

            // Products (Manufacturing-specific) - Optional for drafts
            'mfg_products' => 'nullable|array',
            'mfg_products.*.product_name' => 'required|string|max:255',
            'mfg_products.*.total_production_capacity' => 'nullable|numeric|min:0',
            'mfg_products.*.capacity_unit' => 'nullable|string|max:50',
            'mfg_products.*.capacity_unit_utilized' => 'nullable|string|max:50',
            'mfg_products.*.current_utilized_capacity' => 'nullable|numeric|min:0',
            'mfg_products.*.commencement_date' => 'nullable|date',
            'mfg_products.*.is_exported' => 'nullable|boolean',
            'mfg_products.*.export_countries' => 'nullable|array',
            'mfg_products.*.export_percentage' => 'nullable|numeric|min:0|max:100',

            // Raw Materials (Manufacturing-specific) - Optional for drafts
            'mfg_raw_materials' => 'nullable|array',
            'mfg_raw_materials.*.material_name' => 'nullable|string|max:100',
            'mfg_raw_materials.*.is_imported' => 'nullable|boolean',
            // Country name stored as string for immutability
            'mfg_raw_materials.*.import_country' => 'nullable|string|max:100',
            'mfg_raw_materials.*.import_percentage' => 'nullable|numeric|min:0|max:100',

            // Bought Out Parts (Manufacturing-specific) - Optional for drafts
            'mfg_bought_out_parts' => 'nullable|array',
            'mfg_bought_out_parts.*.part_name' => 'nullable|string|max:100',
            'mfg_bought_out_parts.*.is_imported' => 'nullable|boolean',
            // Country name stored as string for immutability
            'mfg_bought_out_parts.*.import_country' => 'nullable|string|max:100',
            'mfg_bought_out_parts.*.import_percentage' => 'nullable|numeric|min:0|max:100',

            // Key Processes (Manufacturing-specific) - Optional for drafts
            'mfg_key_processes' => 'nullable|array',
            'mfg_key_processes.*.process_name' => 'nullable|string|max:100',

            // Outsourced Processes (Manufacturing-specific) - Optional for drafts
            'mfg_outsourced_processes' => 'nullable|array',
            'mfg_outsourced_processes.*.process_name' => 'nullable|string|max:100',

            // Customers (Common to both sectors) - Optional for drafts
            'customers' => 'nullable|array',
            'customers.*.customer_name' => 'nullable|string|max:255',
            'customers.*.customer_type' => 'nullable|in:domestic,international',
            // Country name stored as string for immutability
            'customers.*.country' => 'nullable|string|max:100',
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
            'service_provider_type.prohibited' => 'Service provider type is not allowed for manufacturing applications.',
            'mfg_products.*.product_name.required' => 'Product name is required when adding products.',
            'mfg_products.*.export_percentage.max' => 'Export percentage cannot exceed 100%.',
            'mfg_raw_materials.*.import_percentage.max' => 'Import percentage cannot exceed 100%.',
        ];
    }
}
