<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Link a renewal application to the certified application it was cloned from.
 *
 * A renewal is a fresh application prefilled from the previous approved one;
 * this column records that lineage so the index/detail surfaces can show the
 * "Renewed from" link and the certificate issuance can chain validity.
 * NULL for ordinary (new) applications.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->foreignId('previous_application_id')
                ->nullable()
                ->after('application_type')
                ->constrained('applications')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropForeign(['previous_application_id']);
            $table->dropColumn('previous_application_id');
        });
    }
};
