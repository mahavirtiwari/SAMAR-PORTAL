<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Source of the numeric part of SAMAR-{n}-{MMYY}. Numbers used to come from
 * "latest application id + 1" under a lock on the applications table, which
 * serialised every concurrent registration (the lock was held across the
 * welcome email and file uploads) and reissued the number of a deleted latest
 * draft. An auto-increment never hands out the same value twice.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('application_number_sequence', function (Blueprint $table) {
            $table->id();
            $table->timestamp('created_at')->useCurrent();
        });

        // Continue above every number already issued (including deleted drafts).
        $maxId = (int) DB::table('applications')->max('id');
        $maxIssued = (int) DB::table('applications')
            ->where('application_number', 'like', 'SAMAR-%')
            ->selectRaw("MAX(CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(application_number, '-', 2), '-', -1) AS UNSIGNED)) AS n")
            ->value('n');
        $next = max($maxId, $maxIssued) + 1;
        DB::statement('ALTER TABLE application_number_sequence AUTO_INCREMENT = '.$next);
    }

    public function down(): void
    {
        Schema::dropIfExists('application_number_sequence');
    }
};
