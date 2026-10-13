<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Service-sector site pictures / site tour are an applicant-supplied pool. Both
 * applicant uploads and assessor-captured (manufacturing) rows are selected by
 * default (`is_selected` defaults true), which is what satisfies the step's
 * completion check today — there is no assessor curation step, so uploads are the
 * official set as soon as they land.
 *
 * `selected_by_team_member_id` / `selected_at` are reserved for a future
 * assessor-curation UI and are intentionally left unpopulated by the current
 * flow; keep them in sync with behavior (or drop them) if that UI never ships.
 *
 * Short constraint/index names are used because the full table names push
 * auto-generated identifiers past MySQL's 64-char limit.
 */
return new class extends Migration
{
    private array $tables = [
        'application_assessment_site_pictures' => 'sap',
        'application_assessment_site_tour_pictures' => 'satp',
    ];

    public function up(): void
    {
        foreach ($this->tables as $table => $prefix) {
            Schema::table($table, function (Blueprint $t) use ($prefix) {
                $t->boolean('is_selected')->default(true)->after('uploader_type');
                $t->unsignedBigInteger('selected_by_team_member_id')->nullable()->after('is_selected');
                $t->timestamp('selected_at')->nullable()->after('selected_by_team_member_id');

                $t->foreign('selected_by_team_member_id', "fk_{$prefix}_selected_by")
                    ->references('id')->on('application_assessment_team_members')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        foreach ($this->tables as $table => $prefix) {
            Schema::table($table, function (Blueprint $t) use ($prefix) {
                $t->dropForeign("fk_{$prefix}_selected_by");
                $t->dropColumn(['is_selected', 'selected_by_team_member_id', 'selected_at']);
            });
        }
    }
};
