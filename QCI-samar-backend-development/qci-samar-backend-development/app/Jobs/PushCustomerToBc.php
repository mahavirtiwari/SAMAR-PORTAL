<?php

namespace App\Jobs;

use App\Contracts\BusinessCentralClientInterface;
use App\Models\Customer;
use App\Services\BusinessCentral\Payloads\CustomerPayloadBuilder;

class PushCustomerToBc extends AbstractBcPushJob
{
    protected function record(): ?object
    {
        return Customer::find($this->recordId);
    }

    protected function push(BusinessCentralClientInterface $bc, object $record): array
    {
        $payload = app(CustomerPayloadBuilder::class)->build($record);

        $existing = $bc->findProcessCustomerByReference($record->reference_no);
        if ($existing) {
            return $bc->patchProcessRecord('ProcessCustomer', (int) $existing['Entry_No'], $payload);
        }

        return $bc->processCustomer($payload);
    }

    protected function label(): string
    {
        return 'Customer';
    }
}
