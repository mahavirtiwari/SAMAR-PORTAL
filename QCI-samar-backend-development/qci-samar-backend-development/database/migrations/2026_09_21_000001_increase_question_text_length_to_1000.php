<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assessment_questions', function (Blueprint $table) {
            $table->string('question_text', 1000)->change();
        });

        Schema::table('application_assessment_questions', function (Blueprint $table) {
            $table->string('question_text', 1000)->change();
        });
    }

    public function down(): void
    {
        Schema::table('assessment_questions', function (Blueprint $table) {
            $table->string('question_text', 500)->change();
        });

        Schema::table('application_assessment_questions', function (Blueprint $table) {
            $table->string('question_text', 500)->change();
        });
    }
};
