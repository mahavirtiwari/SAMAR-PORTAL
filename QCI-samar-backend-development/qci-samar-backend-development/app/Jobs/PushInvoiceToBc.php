<?php

namespace App\Jobs;

use App\Contracts\BusinessCentralClientInterface;
use App\Models\Invoice;
use App\Services\BusinessCentral\Payloads\InvoicePayloadBuilder;

class PushInvoiceToBc extends AbstractBcPushJob
{
    protected function record(): ?object
    {
        return Invoice::find($this->recordId);
    }

    protected function push(BusinessCentralClientInterface $bc, object $record): array
    {
        $payload = app(InvoicePayloadBuilder::class)->build($record);

        $existing = $bc->findProcessInvoiceByTadaReference($record->invoice_reference);
        if ($existing) {
            return $bc->patchProcessRecord('ProcessInvoice', (int) $existing['Entry_No'], $payload);
        }

        return $bc->processInvoice($payload);
    }

    protected function label(): string
    {
        return 'Invoice';
    }
}
