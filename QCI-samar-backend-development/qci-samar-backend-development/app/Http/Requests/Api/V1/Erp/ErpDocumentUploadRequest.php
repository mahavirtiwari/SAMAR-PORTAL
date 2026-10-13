<?php

namespace App\Http\Requests\Api\V1\Erp;

use Illuminate\Foundation\Http\FormRequest;

class ErpDocumentUploadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Field names follow QCI's vendor API reference (invstr/erp_invstr/pdfstr/
     * pdffor) so the ERP side integrates against a contract they already know.
     */
    public function rules(): array
    {
        return [
            'invstr' => ['required', 'string', 'max:20', 'exists:invoices,invoice_reference'],
            'erp_invstr' => ['nullable', 'string', 'max:20'],
            'pdfstr' => ['required', 'string'],
            'pdffor' => ['required', 'in:i,r'],
        ];
    }

    public function messages(): array
    {
        return [
            'invstr.exists' => 'No invoice found for the given invstr (portal invoice reference).',
            'pdffor.in' => "pdffor must be 'i' (invoice) or 'r' (receipt).",
        ];
    }
}
