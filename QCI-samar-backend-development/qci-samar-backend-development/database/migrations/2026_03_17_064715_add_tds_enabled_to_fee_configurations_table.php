<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('fee_configurations', function (Blueprint $table) {
            $table->boolean('tds_enabled')->default(false)->after('gst_percentage');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('fee_configurations', function (Blueprint $table) {
            $table->dropColumn('tds_enabled');
        });
    }
};
