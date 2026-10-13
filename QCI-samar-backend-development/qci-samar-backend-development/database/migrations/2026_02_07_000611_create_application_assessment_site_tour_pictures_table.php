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
        Schema::create('application_assessment_site_tour_pictures', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('assessment_id')->constrained('application_assessments')->cascadeOnDelete();
            $table->foreignId('team_member_id')->constrained('application_assessment_team_members')->cascadeOnDelete();
            $table->string('title', 255)->nullable();
            $table->string('file_path', 255);
            $table->string('disk', 255)->default('private');
            $table->string('file_name', 255)->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->decimal('latitude', 10, 8)->nullable();
            $table->decimal('longitude', 11, 8)->nullable();
            $table->timestamp('captured_at')->nullable();
            $table->timestamps();

            // Indexes
            $table->index('assessment_id', 'idx_site_tour_pictures_assessment');
            $table->index(['assessment_id', 'team_member_id'], 'idx_site_tour_pictures_assessment_member');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('application_assessment_site_tour_pictures');
    }
};
