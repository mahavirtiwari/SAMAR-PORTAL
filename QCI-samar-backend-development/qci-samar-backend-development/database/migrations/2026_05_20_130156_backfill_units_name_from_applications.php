<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Backfill units.name from applications.unit_name for any unit row whose
     * name is null. Earlier versions of UnitService::createUnitFromApplication
     * forgot to copy unit_name into the units table, so every existing unit
     * has name = NULL. The verify-certificate page now surfaces this field,
     * so we need historical rows populated.
     */
    public function up(): void
    {
        // MySQL-specific multi-table UPDATE; a no-op data backfill on a fresh
        // database (e.g. SQLite in tests), so skip on non-MySQL drivers.
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        DB::statement('
            UPDATE units u
            JOIN applications a ON a.unit_id = u.id
            SET u.name = a.unit_name
            WHERE u.name IS NULL
              AND a.unit_name IS NOT NULL
              AND a.unit_name != ""
        ');
    }

    public function down(): void
    {
        // Intentionally no-op: we cannot reliably know which units.name values
        // were set by this backfill vs. set later by other writes. Reverting
        // would risk clobbering legitimate updates.
    }
};
