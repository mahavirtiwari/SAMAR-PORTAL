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
        Schema::create('application_assessment_attendances', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('assessment_id')->constrained('application_assessments')->cascadeOnDelete();
            $table->foreignId('team_member_id')->constrained('application_assessment_team_members')->cascadeOnDelete();
            $table->enum('type', ['punch_in', 'punch_out']);
            $table->string('selfie_path', 255);
            $table->string('disk', 255)->default('private');
            $table->decimal('latitude', 10, 8)->nullable();
            $table->decimal('longitude', 11, 8)->nullable();
            $table->timestamp('recorded_at');
            $table->json('device_metadata')->nullable();
            $table->timestamps();

            // Indexes
            $table->index(['assessment_id', 'team_member_id'], 'idx_attendance_assessment_member');
            $table->index(['assessment_id', 'type'], 'idx_attendance_assessment_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('application_assessment_attendances');
    }
};
