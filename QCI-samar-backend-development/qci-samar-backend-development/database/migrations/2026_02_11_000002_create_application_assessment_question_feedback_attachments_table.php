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
        Schema::create('application_assessment_question_feedback_attachments', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('feedback_id');
            $table->string('file_name', 255);
            $table->string('file_path', 255);
            $table->string('disk', 255)->default('private');
            $table->unsignedBigInteger('file_size');
            $table->string('mime_type', 100)->nullable();
            $table->unsignedBigInteger('uploaded_by')->nullable();
            $table->timestamps();

            // Foreign keys
            $table->foreign('feedback_id', 'aaqfa_feedback_fk')
                ->references('id')
                ->on('application_assessment_question_feedbacks')
                ->cascadeOnDelete();
            $table->foreign('uploaded_by', 'aaqfa_uploader_fk')
                ->references('id')
                ->on('users')
                ->nullOnDelete();

            // Indexes
            $table->index('feedback_id', 'aaqfa_feedback_idx');
            $table->index('uploaded_by', 'aaqfa_uploader_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('application_assessment_question_feedback_attachments');
    }
};
