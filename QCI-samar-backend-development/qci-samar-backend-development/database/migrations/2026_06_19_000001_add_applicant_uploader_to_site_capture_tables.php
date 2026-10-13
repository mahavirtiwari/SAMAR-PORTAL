<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Service-sector assessments have the applicant (unit/enterprise admin) capture
 * the site pictures and site tour instead of an assessor. Those rows previously
 * had to belong to an assessor team member; allow them to belong to an applicant
 * user instead by making team_member_id nullable and recording the uploader.
 *
 * Short, explicit constraint/index names are used because the full table names
 * push auto-generated identifiers past MySQL's 64-char limit.
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
            Schema::table($table, function (Blueprint $t) {
                $t->dropForeign(['team_member_id']);
            });

            Schema::table($table, function (Blueprint $t) use ($prefix) {
                $t->unsignedBigInteger('team_member_id')->nullable()->change();
                $t->foreign('team_member_id')
                    ->references('id')->on('application_assessment_team_members')
                    ->cascadeOnDelete();

                $t->unsignedBigInteger('uploaded_by_user_id')->nullable()->after('team_member_id');
                $t->string('uploader_type', 20)->default('assessor')->after('uploaded_by_user_id');

                $t->foreign('uploaded_by_user_id', "fk_{$prefix}_uploaded_by")
                    ->references('id')->on('users')->nullOnDelete();
                $t->index('uploaded_by_user_id', "idx_{$prefix}_uploaded_by");
            });
        }
    }

    public function down(): void
    {
        foreach ($this->tables as $table => $prefix) {
            Schema::table($table, function (Blueprint $t) use ($prefix) {
                $t->dropForeign("fk_{$prefix}_uploaded_by");
                $t->dropIndex("idx_{$prefix}_uploaded_by");
                $t->dropColumn(['uploaded_by_user_id', 'uploader_type']);
            });

            Schema::table($table, function (Blueprint $t) {
                $t->dropForeign(['team_member_id']);
                $t->unsignedBigInteger('team_member_id')->nullable(false)->change();
                $t->foreign('team_member_id')
                    ->references('id')->on('application_assessment_team_members')
                    ->cascadeOnDelete();
            });
        }
    }
};
