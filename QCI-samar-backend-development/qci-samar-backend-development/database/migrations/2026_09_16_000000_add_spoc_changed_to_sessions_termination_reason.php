<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE sessions MODIFY COLUMN termination_reason ENUM('logout', 'timeout', 'forced', 'new_session', 'expired', 'password_reset', 'organization_inactive', 'idle_timeout', 'spoc_changed') NULL");
    }

    public function down(): void
    {
        DB::statement("UPDATE sessions SET termination_reason = 'forced' WHERE termination_reason = 'spoc_changed'");
        DB::statement("ALTER TABLE sessions MODIFY COLUMN termination_reason ENUM('logout', 'timeout', 'forced', 'new_session', 'expired', 'password_reset', 'organization_inactive', 'idle_timeout') NULL");
    }
};
