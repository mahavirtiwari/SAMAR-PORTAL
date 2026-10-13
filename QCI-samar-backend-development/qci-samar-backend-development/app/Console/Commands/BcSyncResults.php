<?php

namespace App\Console\Commands;

use App\Contracts\BusinessCentralClientInterface;
use App\Exceptions\ErrorReporter;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Receipt;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class BcSyncResults extends Command
{
    /**
     * @var string
     */
    protected $signature = 'bc:sync-results';

    /**
     * @var string
     */
    protected $description = 'Read back Business Central processing results (Error_Text / Customer_Exist) for sent records';

    public function handle(BusinessCentralClientInterface $bc): int
    {
        if (! $bc->isEnabled()) {
            $this->warn('Business Central integration is disabled.');

            return self::SUCCESS;
        }

        $targets = [
            [Customer::class, 'ProcessCustomer'],
            [Invoice::class, 'ProcessInvoice'],
            [Receipt::class, 'ProcessReceipt'],
        ];

        $updated = 0;

        foreach ($targets as [$model, $entity]) {
            $model::where('bc_sync_status', 'sent')
                ->whereNotNull('bc_entry_no')
                ->chunkById(50, function ($rows) use ($bc, $entity, &$updated) {
                    foreach ($rows as $row) {
                        try {
                            $remote = $bc->getProcessRecord($entity, $row->bc_entry_no);
                        } catch (\Throwable $e) {
                            Log::warning('BC result sweep read failed', [
                                'entity' => $entity,
                                'entry_no' => $row->bc_entry_no,
                                'error' => $e->getMessage(),
                            ]);

                            continue;
                        }

                        $row->bc_synced_at = now();

                        if ($remote === null) {
                            // Staging row consumed by the ERP after processing.
                            $row->bc_sync_status = 'processed';
                            $row->save();
                            $updated++;

                            continue;
                        }

                        $error = trim((string) ($remote['Error_Text'] ?? ''));
                        if ($error !== '') {
                            $row->bc_sync_status = 'failed';
                            $row->bc_error_text = mb_substr($error, 0, 250);
                            $row->save();
                            $updated++;

                            // BC reported a processing error on the staged record —
                            // otherwise silent, so surface it for the System Admin.
                            app(ErrorReporter::class)->captureException(
                                new \RuntimeException("Business Central {$entity} processing error: ".mb_substr($error, 0, 250)),
                                'business_central',
                                ['entity' => $entity, 'entry_no' => $row->bc_entry_no, 'record_id' => $row->id],
                            );

                            continue;
                        }

                        if (($remote['Customer_Exist'] ?? false) === true) {
                            $row->bc_sync_status = 'processed';
                            if (isset($row->bc_customer_exists)) {
                                $row->bc_customer_exists = true;
                            }
                            $row->save();
                            $updated++;

                            continue;
                        }

                        // No error and not confirmed processed: still awaiting
                        // QCI's (currently manual) processing pass. Stays 'sent'.
                        $row->save();
                    }
                });
        }

        $this->info("BC result sweep complete. Records updated: {$updated}.");

        return self::SUCCESS;
    }
}
