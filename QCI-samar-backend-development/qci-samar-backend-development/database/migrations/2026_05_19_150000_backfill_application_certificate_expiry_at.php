<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // MySQL-specific multi-table UPDATE; a no-op data backfill on a fresh
        // database (e.g. SQLite in tests), so skip on non-MySQL drivers.
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        DB::statement('
            UPDATE applications a
            INNER JOIN (
                SELECT application_id, MAX(valid_until) AS valid_until
                FROM certificates
                WHERE valid_until IS NOT NULL
                GROUP BY application_id
            ) c ON c.application_id = a.id
            SET a.certificate_expiry_at = c.valid_until
            WHERE a.certificate_expiry_at IS NULL
        ');
    }

    public function down(): void
    {
        // No-op. Reversal would require resetting touched rows to NULL without
        // a record of which rows the up() migration actually modified.
    }
};
