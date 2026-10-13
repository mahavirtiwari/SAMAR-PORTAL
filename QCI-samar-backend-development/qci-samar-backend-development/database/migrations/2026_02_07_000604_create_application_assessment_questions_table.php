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
        Schema::create('application_assessment_questions', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('assessment_id')->constrained('application_assessments')->cascadeOnDelete();
            $table->foreignId('parameter_id')->constrained('application_assessment_parameters')->cascadeOnDelete();
            $table->string('code', 50);
            $table->string('question_text', 500);
            $table->enum('category', ['planning', 'deployment', 'monitoring'])->nullable();
            $table->tinyInteger('weightage')->unsigned()->default(0);
            $table->string('option_1_text', 500);
            $table->decimal('option_1_score', 5, 2)->default(1.00);
            $table->string('option_2_text', 500);
            $table->decimal('option_2_score', 5, 2)->default(2.00);
            $table->string('option_3_text', 500);
            $table->decimal('option_3_score', 5, 2)->default(3.00);
            $table->string('option_4_text', 500);
            $table->decimal('option_4_score', 5, 2)->default(4.00);
            $table->string('option_5_text', 500);
            $table->decimal('option_5_score', 5, 2)->default(5.00);
            $table->enum('review_status', ['pending', 'approved', 'flagged', 'clarified'])->default('pending');
            $table->enum('review_type', ['qc', 'committee'])->nullable();
            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            // Foreign key
            $table->foreign('reviewed_by')->references('id')->on('users')->nullOnDelete();

            // Indexes
            $table->index(['assessment_id', 'parameter_id'], 'idx_app_questions_assessment_param');
            $table->index(['assessment_id', 'code'], 'idx_app_questions_assessment_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('application_assessment_questions');
    }
};
