<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Idempotency support for offline-replayed captures.
 *
 * The assessor mobile app queues captures offline and replays them when it
 * reconnects. If a POST's response is lost after the server already committed,
 * the app re-sends the same request, which previously created duplicate rows
 * (and duplicate stored files) on these create-only endpoints. A nullable,
 * unique client_uuid lets the controllers turn a replay into an idempotent
 * no-op. NULL is allowed for any pre-existing / web-originated row (MySQL
 * permits multiple NULLs in a unique index).
 */
return new class extends Migration
{
    private array $tables = [
        'application_assessment_site_pictures',
        'application_assessment_site_tour_pictures',
        'application_assessment_response_evidences',
        'application_assessment_attendances',
    ];

    public function up(): void
    {
        foreach ($this->tables as $table) {
            Schema::table($table, function (Blueprint $blueprint) use ($table) {
                $blueprint->string('client_uuid', 64)->nullable()->after('id');
                $blueprint->unique('client_uuid', "uq_{$table}_client_uuid");
            });
        }
    }

    public function down(): void
    {
        foreach ($this->tables as $table) {
            Schema::table($table, function (Blueprint $blueprint) use ($table) {
                $blueprint->dropUnique("uq_{$table}_client_uuid");
                $blueprint->dropColumn('client_uuid');
            });
        }
    }
};
