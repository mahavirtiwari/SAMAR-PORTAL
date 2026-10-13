<?php

namespace App\Http\Requests\Payment;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PaymentExportRequest extends FormRequest
{
    /**
     * Role gating happens in the controller, alongside the list endpoint this
     * export mirrors, because the same route serves several roles with
     * different data scoping.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'min:2', 'max:100'],
            'application_id' => ['nullable', 'integer'],
            'payment_type' => ['nullable', 'string'],
            'sector' => ['nullable', 'string', Rule::in(['manufacturing', 'service'])],
            'enterprise_classification' => ['nullable', 'string'],
            'from_date' => ['nullable', 'date'],
            'to_date' => ['nullable', 'date', 'after_or_equal:from_date'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'search.min' => 'Search term must be at least 2 characters.',
            'search.max' => 'Search term cannot exceed 100 characters.',
            'sector.in' => 'Sector must be one of: manufacturing, service.',
            'to_date.after_or_equal' => 'The To Date cannot be earlier than the From Date.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'search' => 'search term',
            'from_date' => 'From Date',
            'to_date' => 'To Date',
        ];
    }
}
