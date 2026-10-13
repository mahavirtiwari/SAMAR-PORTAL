<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Hard-lock parameter allocation on save.
 *
 * Previously allocation only locked once the Opening Meeting was completed.
 * The lead now finalises allocation with an explicit "Complete" save on the
 * mobile app, after which it must be read-only on every surface (web portal
 * included). A nullable timestamp records when that save happened; a NULL
 * value means allocation is still open (and the Opening Meeting backstop
 * still applies for any pre-existing assessment).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('application_assessments', function (Blueprint $table) {
            $table->timestamp('allocation_locked_at')->nullable()->after('step_progress');
        });
    }

    public function down(): void
    {
        Schema::table('application_assessments', function (Blueprint $table) {
            $table->dropColumn('allocation_locked_at');
        });
    }
};
