<?php

namespace App\Console\Commands;

use App\Jobs\PushCustomerToBc;
use App\Jobs\PushInvoiceToBc;
use App\Jobs\PushReceiptToBc;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Receipt;
use Illuminate\Console\Command;

class BcRetryFailed extends Command
{
    /**
     * @var string
     */
    protected $signature = 'bc:retry-failed {--max= : Attempt ceiling per record (defaults to services.business_central.max_attempts)}';

    /**
     * @var string
     */
    protected $description = 'Re-dispatch failed Business Central pushes (safe: jobs adopt/patch existing staging rows, never duplicate)';

    public function handle(): int
    {
        $max = (int) ($this->option('max') ?: config('services.business_central.max_attempts', 5));

        $targets = [
            [Customer::class, PushCustomerToBc::class],
            [Invoice::class, PushInvoiceToBc::class],
            [Receipt::class, PushReceiptToBc::class],
        ];

        $dispatched = 0;

        // Only rows below the ceiling are re-dispatched. A row that has hit the
        // ceiling is terminal and was already surfaced as CRITICAL once, by the
        // push job at the moment it exhausted — the sweep does not re-alert it.
        foreach ($targets as [$model, $job]) {
            $model::where('bc_sync_status', 'failed')
                ->where('bc_attempts', '<', $max)
                ->pluck('id')
                ->each(function ($id) use ($job, &$dispatched) {
                    $job::dispatch($id);
                    $dispatched++;
                });
        }

        $this->info("BC retry sweep complete. Jobs dispatched: {$dispatched}.");

        return self::SUCCESS;
    }
}
