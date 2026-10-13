<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assessment_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parameter_id')->constrained('assessment_parameters')->onDelete('cascade');
            $table->string('question_text', 500);
            $table->enum('category', ['planning', 'deployment', 'monitoring'])->nullable();
            $table->unsignedTinyInteger('weightage')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->index('is_active');
            $table->index('category', 'idx_questions_category');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assessment_questions');
    }
};
