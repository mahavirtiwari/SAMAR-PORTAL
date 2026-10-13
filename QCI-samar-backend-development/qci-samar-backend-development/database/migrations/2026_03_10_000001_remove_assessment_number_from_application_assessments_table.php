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
        // Drop the indexes first, in their own statement: on sqlite a dropColumn
        // rebuilds the table and re-reads the current schema, so a unique index
        // dropped in the same batch is still seen and the rebuild fails.
        Schema::table('application_assessments', function (Blueprint $table) {
            $table->dropUnique(['assessment_number']);
            $table->dropIndex('idx_app_assessments_number');
        });

        Schema::table('application_assessments', function (Blueprint $table) {
            $table->dropColumn('assessment_number');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('application_assessments', function (Blueprint $table) {
            $table->string('assessment_number', 255)->unique()->after('unit_id');
            $table->index('assessment_number', 'idx_app_assessments_number');
        });
    }
};
