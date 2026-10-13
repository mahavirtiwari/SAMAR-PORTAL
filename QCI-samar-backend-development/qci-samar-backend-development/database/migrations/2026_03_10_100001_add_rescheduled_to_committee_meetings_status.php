<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // ENUM redefinition is MySQL-only; on other drivers (e.g. SQLite in tests)
        // the column is plain text and needs no change.
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("ALTER TABLE committee_meetings MODIFY COLUMN status ENUM('scheduled', 'rescheduled', 'in_progress', 'completed', 'cancelled', 'postponed') NOT NULL DEFAULT 'scheduled'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        // First update any 'rescheduled' records back to 'scheduled' before removing the enum value
        DB::statement("UPDATE committee_meetings SET status = 'scheduled' WHERE status = 'rescheduled'");
        DB::statement("ALTER TABLE committee_meetings MODIFY COLUMN status ENUM('scheduled', 'in_progress', 'completed', 'cancelled', 'postponed') NOT NULL DEFAULT 'scheduled'");
    }
};
