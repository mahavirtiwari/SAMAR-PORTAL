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
        Schema::create('application_assessment_response_evidences', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('response_id')->constrained('application_assessment_responses')->cascadeOnDelete();
            $table->string('file_name', 255);
            $table->string('file_path', 255);
            $table->string('disk', 255)->default('private');
            $table->unsignedBigInteger('file_size');
            $table->string('mime_type', 100)->nullable();
            $table->string('description', 255)->nullable();
            $table->decimal('latitude', 10, 8)->nullable();
            $table->decimal('longitude', 11, 8)->nullable();
            $table->dateTime('captured_at')->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            // Indexes
            $table->index('response_id', 'idx_evidence_response');
            $table->index('uploaded_by', 'idx_evidence_uploader');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('application_assessment_response_evidences');
    }
};
