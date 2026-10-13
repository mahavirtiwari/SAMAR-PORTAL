<?php

namespace App\Http\Requests\Api\V1;

use App\Rules\PersonName;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ServicesApplicationDraftRequest extends FormRequest
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

        if (isset($transformedInput['vendor_category']) && is_numeric($transformedInput['vendor_category'])) {
            $transformedInput['vendor_category'] = (string) $transformedInput['vendor_category'];
        }

        // svc_drdo_vendor_labs expects array of objects [{lab_name: string}]
        // No special normalization needed - JSON parsing handles it

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
                // Handle JSON strings from multipart/form-data
                if (is_string($value) && $this->isJsonArray($value)) {
                    $decoded = json_decode($value, true);
                    $transformed[$snakeKey] = is_array($decoded) ? $this->transformKeys($decoded) : $decoded;
                }
                // Handle boolean strings
                elseif (in_array($value, ['true', 'false'], true)) {
                    $transformed[$snakeKey] = $value === 'true';
                }
                // Handle comma-separated strings for simple string arrays
                elseif (is_string($value) && in_array($snakeKey, ['third_party_certifications', 'blacklisted_organizations'])) {
                    $transformed[$snakeKey] = $value ? explode(',', $value) : [];
                } else {
                    $transformed[$snakeKey] = $value;
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
        $rules = [
            // Service provider type is optional for draft (uses DB column name with svc_ prefix)
            'svc_provider_type' => 'nullable|in:annual_maintenance_contract,critical_service_provider,civil_works_contractor',

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
            'vendor_category' => 'nullable|string|max:100',
            // Note: drdo_vendor_stores is manufacturing-only (mfg_drdo_vendor_stores)
            // Services sector uses svc_drdo_vendor_labs instead
            // Accept array of objects [{lab_name: string}]
            'svc_drdo_vendor_labs' => 'nullable|array',
            'svc_drdo_vendor_labs.*.lab_name' => 'nullable|string|max:255',
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

            // Certifications (array of certification names)
            'third_party_certifications' => 'nullable|array',
            'third_party_certifications.*' => 'nullable|string|max:255',

            // Blacklisting & Enquiry
            'is_blacklisted' => 'nullable|boolean',
            'blacklisted_organizations' => 'nullable|array',
            'has_ongoing_enquiry' => 'nullable|boolean',

            // Services (Services-specific) - Optional for drafts
            'svc_services' => 'nullable|array',
            'svc_services.*.service_name' => 'nullable|string|max:255',
            'svc_services.*.total_services_capacity' => 'nullable|numeric|min:0',
            'svc_services.*.capacity_unit' => 'nullable|string|max:50',
            'svc_services.*.current_utilized_capacity' => 'nullable|numeric|min:0',
            'svc_services.*.commencement_date' => 'nullable|date',
            'svc_services.*.is_exported' => 'nullable|boolean',
            'svc_services.*.export_countries' => 'nullable|array',
            'svc_services.*.export_percentage' => 'nullable|numeric|min:0|max:100',

            // Key Service Resources (Services-specific) - Optional for drafts
            'svc_key_resources' => 'nullable|array',
            'svc_key_resources.*.resource_name' => 'nullable|string|max:100',
            'svc_key_resources.*.is_imported' => 'nullable|boolean',
            // Country name stored as string for immutability
            'svc_key_resources.*.import_country' => 'nullable|string|max:100',
            'svc_key_resources.*.import_percentage' => 'nullable|numeric|min:0|max:100',

            // Customers (Common to both sectors) - Optional for drafts
            'customers' => 'nullable|array',
            'customers.*.customer_name' => 'nullable|string|max:255',
            'customers.*.customer_type' => 'nullable|in:domestic,international',
            // Country name stored as string for immutability
            'customers.*.country' => 'nullable|string|max:100',

            // Key Processes (Services-specific) - Optional for drafts
            'svc_key_processes' => 'nullable|array',
            'svc_key_processes.*.process_name' => 'nullable|string|max:100',

            // Outsourced Processes (Services-specific) - Optional for drafts
            'svc_outsourced_processes' => 'nullable|array',
            'svc_outsourced_processes.*.process_name' => 'nullable|string|max:100',

            // Outsourced Service Components (Services-specific) - Optional for drafts
            'svc_outsourced_components' => 'nullable|array',
            'svc_outsourced_components.*.component_name' => 'nullable|string|max:255',
            'svc_outsourced_components.*.is_imported' => 'nullable|boolean',
            'svc_outsourced_components.*.import_country' => 'nullable|string|max:100',
            'svc_outsourced_components.*.import_percentage' => 'nullable|numeric|min:0|max:100',
        ];

        // Per-file upload metadata sent by the web portal alongside each picture
        // (upload geolocation + timestamp, folded into file_upload_metadata).
        foreach ([
            'drdo_certificate_file',
            'site_exterior_photo',
            'gst_certificate_file',
            'govt_registration_certificate',
            'dpiit_certificate_file',
            'udyam_certificate_file',
            'incorporation_certificate_file',
        ] as $fileField) {
            $rules["{$fileField}_latitude"] = 'nullable|numeric|between:-90,90';
            $rules["{$fileField}_longitude"] = 'nullable|numeric|between:-180,180';
            $rules["{$fileField}_captured_at"] = 'nullable|date';
        }

        return $rules;
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'svc_provider_type.in' => 'Service provider type must be one of: annual_maintenance_contract, critical_service_provider, or civil_works_contractor.',
            'svc_services.*.service_name.required' => 'Service name is required when adding services.',
            'svc_services.*.export_percentage.max' => 'Export percentage cannot exceed 100%.',
            'svc_key_resources.*.import_percentage.max' => 'Import percentage cannot exceed 100%.',
            'svc_outsourced_components.*.import_percentage.max' => 'Import percentage cannot exceed 100%.',
        ];
    }
}
