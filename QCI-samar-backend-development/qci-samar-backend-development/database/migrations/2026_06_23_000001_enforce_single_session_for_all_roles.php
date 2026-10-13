<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('roles')->update(['enforce_single_session' => true]);
    }

    public function down(): void
    {
        // Restore the original seeder mix (roles that did not enforce single session).
        DB::table('roles')
            ->whereIn('slug', ['drdo_lab', 'operations_admin', 'assessor', 'enterprise_admin', 'unit_admin'])
            ->update(['enforce_single_session' => false]);
    }
};
