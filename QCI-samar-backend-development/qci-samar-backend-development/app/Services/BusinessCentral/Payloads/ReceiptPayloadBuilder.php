<?php

namespace App\Services\BusinessCentral\Payloads;

use App\Models\Receipt;

/**
 * Assembles the ProcessReceipt payload from the Receipt projection (snapshotted
 * at payment success). Reference_ID carries the customer key; Applied_to_invoice
 * carries the portal invoice reference the payment settles.
 */
class ReceiptPayloadBuilder
{
    public function build(Receipt $receipt): array
    {
        return [
            'Posting_Date' => $receipt->posting_date->toDateString(),
            'Order_ID' => mb_substr((string) $receipt->payment->order_id, 0, 20),
            'Reference_ID' => $receipt->customer->reference_no,
            'Board' => config('services.business_central.board'),
            'PortalName' => config('services.business_central.portal_name'),
            'TDS_Deducted' => (bool) $receipt->tds_deducted,
            'Payment_Mode' => mb_substr($receipt->payment_mode, 0, 100),
            'TAN' => mb_substr((string) $receipt->tan, 0, 10),
            'Amount_Received' => (float) $receipt->amount_received,
            'Invoice_1_Amount' => (float) $receipt->invoice_amount,
            'Invoice_2_Amount' => 0,
            'TDS_Amount' => (float) $receipt->tds_amount,
            'Payment_Date' => $receipt->payment_date->toDateString(),
            'UTR_No' => mb_substr($receipt->utr_no, 0, 20),
            'Created_At' => now()->toIso8601String(),
            'Applied_to_invoice' => (string) ($receipt->invoice?->invoice_reference ?? ''),
            'Applied_to_invoice2' => '',
            'NABL4' => '',
            'Sub_Discipline_Name' => config('services.business_central.sub_discipline_name'),
            'SubmissionID' => '',
        ];
    }
}
