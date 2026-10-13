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
        Schema::create('application_assessment_meetings', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('assessment_id')->constrained('application_assessments')->cascadeOnDelete();
            $table->enum('type', ['opening', 'closing']);
            $table->string('image_path', 255)->nullable();
            $table->string('disk', 255)->default('private');
            $table->decimal('latitude', 10, 8)->nullable();
            $table->decimal('longitude', 11, 8)->nullable();
            $table->timestamp('conducted_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            // Indexes
            $table->index('assessment_id', 'idx_meetings_assessment');

            // Unique constraints
            $table->unique(['assessment_id', 'type'], 'unique_assessment_meeting_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('application_assessment_meetings');
    }
};
