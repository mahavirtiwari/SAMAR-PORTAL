<?php

namespace Database\Seeders;

use App\Services\Lgd\LgdDirectorySync;
use Illuminate\Database\Seeder;

/**
 * Brings the seeded states/districts/pincodes in line with the shipped LGD download
 * (database/data/lgd/). Runs after StatesSeeder, DistrictsSeeder and PincodeSeeder.
 */
class LgdDirectorySeeder extends Seeder
{
    public function run(LgdDirectorySync $sync): void
    {
        $stats = $sync->run();
        $this->command?->info('LGD directory synced: '.json_encode($stats));
    }
}
