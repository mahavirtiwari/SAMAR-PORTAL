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
        Schema::create('application_assessment_meeting_participants', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('meeting_id');
            $table->unsignedBigInteger('team_member_id')->nullable();
            $table->string('name', 255)->nullable();
            $table->string('designation', 255)->nullable();
            $table->boolean('is_default')->default(false);
            $table->timestamps();

            // Foreign keys
            $table->foreign('meeting_id', 'fk_meeting_participants_meeting')
                ->references('id')
                ->on('application_assessment_meetings')
                ->cascadeOnDelete();
            $table->foreign('team_member_id', 'fk_meeting_participants_team')
                ->references('id')
                ->on('application_assessment_team_members')
                ->nullOnDelete();

            // Indexes
            $table->index('meeting_id', 'idx_meeting_participants_meeting');

            // Unique constraints
            $table->unique(['meeting_id', 'team_member_id'], 'unique_meeting_team_member');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('application_assessment_meeting_participants');
    }
};
