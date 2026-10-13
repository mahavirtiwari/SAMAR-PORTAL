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
        Schema::table('assessment_question_options', function (Blueprint $table) {
            $table->string('option_text', 1000)->change();
        });

        Schema::table('application_assessment_questions', function (Blueprint $table) {
            $table->string('option_1_text', 1000)->change();
            $table->string('option_2_text', 1000)->change();
            $table->string('option_3_text', 1000)->change();
            $table->string('option_4_text', 1000)->change();
            $table->string('option_5_text', 1000)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('assessment_question_options', function (Blueprint $table) {
            $table->string('option_text', 500)->change();
        });

        Schema::table('application_assessment_questions', function (Blueprint $table) {
            $table->string('option_1_text', 500)->change();
            $table->string('option_2_text', 500)->change();
            $table->string('option_3_text', 500)->change();
            $table->string('option_4_text', 500)->change();
            $table->string('option_5_text', 500)->change();
        });
    }
};
