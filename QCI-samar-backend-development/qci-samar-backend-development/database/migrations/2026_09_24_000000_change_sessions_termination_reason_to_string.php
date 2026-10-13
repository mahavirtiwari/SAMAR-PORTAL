<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE sessions MODIFY COLUMN termination_reason VARCHAR(32) NULL');
    }

    public function down(): void
    {
        $enumValues = ['logout', 'timeout', 'forced', 'new_session', 'expired', 'password_reset', 'organization_inactive', 'idle_timeout', 'spoc_changed'];

        // A reason added after this migration has no enum slot to fall back into.
        DB::table('sessions')
            ->whereNotNull('termination_reason')
            ->whereNotIn('termination_reason', $enumValues)
            ->update(['termination_reason' => 'forced']);

        $list = implode(', ', array_map(fn ($v) => "'{$v}'", $enumValues));
        DB::statement("ALTER TABLE sessions MODIFY COLUMN termination_reason ENUM({$list}) NULL");
    }
};
