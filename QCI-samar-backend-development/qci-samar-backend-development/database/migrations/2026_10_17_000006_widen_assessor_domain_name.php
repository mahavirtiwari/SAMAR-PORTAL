<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Assessor domain names can be long lists of specialisations, so allow up to
 * 1000 characters. A 1000-character utf8mb4 column is over InnoDB's index-key
 * limit, so the plain index goes; the table is a small master list.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assessor_domains', function (Blueprint $table) {
            $table->dropIndex(['domain_name']);
        });

        Schema::table('assessor_domains', function (Blueprint $table) {
            $table->string('domain_name', 1000)->change();
        });
    }

    public function down(): void
    {
        Schema::table('assessor_domains', function (Blueprint $table) {
            $table->string('domain_name', 255)->change();
            $table->index('domain_name');
        });
    }
};
