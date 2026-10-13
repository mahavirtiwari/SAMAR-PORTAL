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
        Schema::create('application_assessment_question_feedbacks', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('application_assessment_question_id');
            $table->unsignedBigInteger('user_id');
            $table->enum('feedback_type', ['qc_feedback', 'committee_feedback', 'send_back', 'assessor_clarification']);
            $table->decimal('rc_score', 5, 2)->nullable();
            $table->text('comment')->nullable();
            $table->unsignedBigInteger('parent_feedback_id')->nullable();
            $table->timestamps();

            // Foreign keys
            $table->foreign('application_assessment_question_id', 'aaq_feedbacks_question_fk')
                ->references('id')
                ->on('application_assessment_questions')
                ->cascadeOnDelete();
            $table->foreign('user_id', 'aaq_feedbacks_user_fk')
                ->references('id')
                ->on('users')
                ->cascadeOnDelete();
            $table->foreign('parent_feedback_id', 'aaq_feedbacks_parent_fk')
                ->references('id')
                ->on('application_assessment_question_feedbacks')
                ->nullOnDelete();

            // Indexes
            $table->index(['application_assessment_question_id', 'feedback_type'], 'aaq_feedbacks_question_type_idx');
            $table->index('user_id', 'aaq_feedbacks_user_idx');
            $table->index('parent_feedback_id', 'aaq_feedbacks_parent_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('application_assessment_question_feedbacks');
    }
};
