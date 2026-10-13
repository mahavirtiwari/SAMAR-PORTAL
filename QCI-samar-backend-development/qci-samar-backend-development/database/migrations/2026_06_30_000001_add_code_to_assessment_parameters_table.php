<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assessment_parameters', function (Blueprint $table) {
            $table->string('code', 20)->nullable()->after('id');
        });

        // Backfill existing rows with a per-sector sequential code so the column can be
        // made unique. Order by id within each sector; soft-deleted rows are included so a
        // sequence number is never reused.
        $this->backfillCodes('manufacturing', 'MFG-');
        $this->backfillCodes('service', 'SVC-');

        Schema::table('assessment_parameters', function (Blueprint $table) {
            $table->unique('code', 'uniq_assessment_parameters_code');
        });
    }

    public function down(): void
    {
        Schema::table('assessment_parameters', function (Blueprint $table) {
            $table->dropUnique('uniq_assessment_parameters_code');
            $table->dropColumn('code');
        });
    }

    private function backfillCodes(string $sector, string $prefix): void
    {
        $ids = DB::table('assessment_parameters')
            ->where('sector', $sector)
            ->orderBy('id')
            ->pluck('id');

        $sequence = 1;
        foreach ($ids as $id) {
            DB::table('assessment_parameters')
                ->where('id', $id)
                ->update(['code' => $prefix.str_pad((string) $sequence, 3, '0', STR_PAD_LEFT)]);
            $sequence++;
        }
    }
};
