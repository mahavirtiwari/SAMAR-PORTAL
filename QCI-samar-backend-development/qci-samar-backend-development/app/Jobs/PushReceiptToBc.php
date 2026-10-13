<?php

namespace App\Jobs;

use App\Contracts\BusinessCentralClientInterface;
use App\Models\Receipt;
use App\Services\BusinessCentral\Payloads\ReceiptPayloadBuilder;

class PushReceiptToBc extends AbstractBcPushJob
{
    protected function record(): ?object
    {
        return Receipt::find($this->recordId);
    }

    protected function push(BusinessCentralClientInterface $bc, object $record): array
    {
        $payload = app(ReceiptPayloadBuilder::class)->build($record);

        // De-duplicate on Order_ID (unique per payment), not UTR — UTR is the
        // gateway reference and may be blank or shared across records. Match the
        // 20-char value actually stored: BC's Order_ID is Code 20, so a longer
        // filter literal is rejected as an invalid filter (HTTP 400).
        $existing = $bc->findProcessReceiptByOrderId(mb_substr((string) $record->payment->order_id, 0, 20));
        if ($existing) {
            return $bc->patchProcessRecord('ProcessReceipt', (int) $existing['Entry_No'], $payload);
        }

        return $bc->processReceipt($payload);
    }

    protected function label(): string
    {
        return 'Receipt';
    }
}
