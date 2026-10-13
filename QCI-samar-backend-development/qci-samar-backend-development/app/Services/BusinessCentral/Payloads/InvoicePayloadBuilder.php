<?php

namespace App\Services\BusinessCentral\Payloads;

use App\Models\Application;
use App\Models\Customer;
use App\Models\Invoice;

/**
 * Assembles the ProcessInvoice payload. Per QCI (16-Jul-2026): Invoice_No,
 * SubmissionID and Assessment_Type stay blank; the portal's unique reference
 * travels in TADA_Invoice_No; all NABL-only fields stay blank/zero.
 */
class InvoicePayloadBuilder
{
    public function build(Invoice $invoice): array
    {
        $customer = Customer::where('organization_id', $invoice->organization_id)->first();
        if (! $customer) {
            throw new \InvalidArgumentException(
                "No ERP customer record exists for organization {$invoice->organization_id}; push the customer first."
            );
        }

        $application = Application::find($invoice->application_id);
        $isRenewal = ($application?->application_type === 'renewal');
        $config = config('services.business_central');
        $ledgerName = $isRenewal ? $config['tada_ledger_renewal'] : $config['tada_ledger_new'];

        return [
            'Posting_Date' => $invoice->posting_date->toDateString(),
            'Board' => config('services.business_central.board'),
            'Portal' => config('services.business_central.portal_name'),
            'Login_Name' => $customer->reference_no,
            'Voucher_Date' => $invoice->voucher_date->toDateString(),
            'Location_Code' => config('services.business_central.location_code'),
            // QCI-required format: "<ledger>, <SAMAR ID>" e.g. "ASSESSMENT FEE, SAMAR-030726-63".
            'Line_Comments' => mb_substr($ledgerName.', '.$customer->reference_no, 0, 500),
            'NABL4' => '',
            'Quantity' => 1,
            'Ledger_Name' => '',
            'Ledger_Amount' => 0,
            'TA_DA_LedgerName' => $ledgerName,
            'Assessor_Name' => '',
            'Assessor_ID' => '',
            'Assessor_Type' => '',
            'Discipline_Name' => '',
            'Sub_Discipline_Name' => $config['sub_discipline_name'],
            'Other_Discipline' => '',
            'TADA_Amount' => 0,
            // Other_Amount is the pre-GST base fee (QCI-confirmed). base_amount
            // must be stored GST-exclusive.
            'Other_Amount' => (float) $invoice->base_amount,
            'Overhead_Charges' => 0,
            'Invoice_No' => '',
            'TADA_Invoice_No' => $invoice->invoice_reference,
            'Assessment_Type' => '',
            'HONORARIUM_Yes_No' => false,
            'SubmissionID' => '',
        ];
    }
}
