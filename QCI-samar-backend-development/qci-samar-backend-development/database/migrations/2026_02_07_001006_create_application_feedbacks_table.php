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
        Schema::create('application_feedbacks', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('application_id')->constrained('applications')->cascadeOnDelete();
            $table->unsignedBigInteger('feedback_question_id')->nullable();
            $table->string('question_text', 500);
            $table->enum('question_type', ['rating', 'yes_no']);
            $table->tinyInteger('rating')->unsigned()->nullable();
            $table->boolean('yes_no_answer')->nullable();
            $table->text('remarks')->nullable();
            $table->timestamps();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();

            // Unique constraint
            $table->unique(['application_id', 'feedback_question_id'], 'app_feedback_unique');

            // Indexes
            $table->index('application_id');
            $table->index('feedback_question_id');
            $table->index('question_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('application_feedbacks');
    }
};
