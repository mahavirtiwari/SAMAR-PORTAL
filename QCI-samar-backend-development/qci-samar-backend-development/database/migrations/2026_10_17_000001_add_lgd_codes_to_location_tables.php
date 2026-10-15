<?php

use App\Services\Lgd\LgdDirectorySync;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Local Government Directory (LGD) codes on the state/district masters and on every
 * table that stores an address, then a sync to the LGD download of 14 Oct 2026
 * (database/data/lgd/). On a fresh database the masters are empty here and the sync
 * runs from DatabaseSeeder (LgdDirectorySeeder) instead.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('states', function (Blueprint $table) {
            $table->unsignedSmallInteger('lgd_code')->nullable()->unique()->after('code');
        });

        Schema::table('districts', function (Blueprint $table) {
            $table->unsignedInteger('lgd_code')->nullable()->unique()->after('code');
            $table->boolean('is_active')->default(true)->after('lgd_code');
        });

        foreach (LgdDirectorySync::ADDRESS_COLUMNS as $tableName => $groups) {
            Schema::table($tableName, function (Blueprint $table) use ($groups) {
                foreach ($groups as [$stateCol, $districtCol, $stateCodeCol, $districtCodeCol]) {
                    $table->unsignedSmallInteger($stateCodeCol)->nullable()->after($districtCol ?? $stateCol);
                    $table->unsignedInteger($districtCodeCol)->nullable()->after($stateCodeCol);
                    $table->index($districtCodeCol);
                }
            });
        }

        if (DB::table('states')->exists()) {
            app(LgdDirectorySync::class)->run();
        }
    }

    public function down(): void
    {
        foreach (LgdDirectorySync::ADDRESS_COLUMNS as $tableName => $groups) {
            Schema::table($tableName, function (Blueprint $table) use ($groups) {
                foreach ($groups as [, , $stateCodeCol, $districtCodeCol]) {
                    $table->dropIndex([$districtCodeCol]);
                    $table->dropColumn([$stateCodeCol, $districtCodeCol]);
                }
            });
        }

        Schema::table('districts', function (Blueprint $table) {
            $table->dropUnique(['lgd_code']);
            $table->dropColumn(['lgd_code', 'is_active']);
        });

        Schema::table('states', function (Blueprint $table) {
            $table->dropUnique(['lgd_code']);
            $table->dropColumn('lgd_code');
        });
    }
};
