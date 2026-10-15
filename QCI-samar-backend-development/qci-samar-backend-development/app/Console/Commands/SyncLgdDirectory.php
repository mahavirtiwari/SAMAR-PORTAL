<?php

namespace App\Console\Commands;

use App\Services\Lgd\LgdDirectorySync;
use Illuminate\Console\Command;

class SyncLgdDirectory extends Command
{
    protected $signature = 'lgd:sync {--snapshot= : Date part of database/data/lgd/{states,districts}.<snapshot>.csv (default: the shipped snapshot)}';

    protected $description = 'Sync states/districts with an LGD download and refresh LGD codes on stored addresses';

    public function handle(LgdDirectorySync $sync): int
    {
        $stats = $sync->run($this->option('snapshot') ?: null);

        if ($stats === []) {
            $this->info('Already in line with LGD; nothing changed.');
        } else {
            $this->table(['Change', 'Count'], collect($stats)->map(fn ($n, $k) => [$k, $n])->values()->all());
        }

        return self::SUCCESS;
    }
}
