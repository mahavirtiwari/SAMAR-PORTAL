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
        Schema::create('application_assessment_responses', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('assessment_id')->constrained('application_assessments')->cascadeOnDelete();
            $table->foreignId('question_id')->constrained('application_assessment_questions')->cascadeOnDelete();
            $table->tinyInteger('selected_option')->unsigned()->nullable();
            $table->decimal('selected_score', 5, 2)->nullable();
            $table->decimal('rc_score', 5, 2)->nullable()->comment('Committee approved score (1-5)');
            $table->decimal('weighted_score', 10, 2)->nullable();
            $table->text('assessor_remarks')->nullable();
            $table->foreignId('assessed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('assessed_at')->nullable();
            $table->timestamps();

            // Indexes
            $table->index('assessment_id', 'idx_app_responses_assessment');

            // Unique constraints
            $table->unique(['assessment_id', 'question_id'], 'unique_assessment_question');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('application_assessment_responses');
    }
};
