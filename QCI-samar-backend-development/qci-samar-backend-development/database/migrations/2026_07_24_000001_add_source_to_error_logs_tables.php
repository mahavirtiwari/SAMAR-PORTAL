<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-05773 — extend the error-log subsystem beyond HTTP requests.
 *
 * Adds a `source` discriminator (queue, scheduler, business_central, payment,
 * email, storage, pdf, database, http) and relaxes the request-bound columns to
 * nullable so failures with no HTTP request (queue jobs, scheduled commands,
 * integration callbacks) can be persisted the same way HTTP 500s already are.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('error_logs', function (Blueprint $table) {
            $table->string('source', 50)->nullable()->after('severity');

            // Request context is absent for non-HTTP failures — relax NOT NULL.
            $table->unsignedSmallInteger('http_status_code')->nullable()->change();
            $table->string('request_method', 10)->nullable()->change();
            $table->text('request_url')->nullable()->change();
            $table->string('request_endpoint', 255)->nullable()->change();
            $table->string('ip_address', 45)->nullable()->change();
        });

        Schema::table('error_logs', function (Blueprint $table) {
            $table->index('source');
            $table->index(['source', 'occurred_at']);
        });

        Schema::table('error_groups', function (Blueprint $table) {
            $table->string('source', 50)->nullable()->after('severity');
            $table->index('source');
        });

        // Existing rows all came from the HTTP exception path.
        DB::table('error_logs')->whereNull('source')->update(['source' => 'http']);
        DB::table('error_groups')->whereNull('source')->update(['source' => 'http']);
    }

    public function down(): void
    {
        Schema::table('error_logs', function (Blueprint $table) {
            $table->dropIndex(['source', 'occurred_at']);
            $table->dropIndex(['source']);
            $table->dropColumn('source');
        });

        Schema::table('error_groups', function (Blueprint $table) {
            $table->dropIndex(['source']);
            $table->dropColumn('source');
        });

        // Re-applying NOT NULL fails on rows left behind by non-HTTP captures;
        // backfill placeholders first so the rollback is clean.
        DB::table('error_logs')->whereNull('http_status_code')->update(['http_status_code' => 0]);
        DB::table('error_logs')->whereNull('request_method')->update(['request_method' => '']);
        DB::table('error_logs')->whereNull('request_url')->update(['request_url' => '']);
        DB::table('error_logs')->whereNull('request_endpoint')->update(['request_endpoint' => '']);
        DB::table('error_logs')->whereNull('ip_address')->update(['ip_address' => '']);

        Schema::table('error_logs', function (Blueprint $table) {
            $table->unsignedSmallInteger('http_status_code')->nullable(false)->change();
            $table->string('request_method', 10)->nullable(false)->change();
            $table->text('request_url')->nullable(false)->change();
            $table->string('request_endpoint', 255)->nullable(false)->change();
            $table->string('ip_address', 45)->nullable(false)->change();
        });
    }
};
