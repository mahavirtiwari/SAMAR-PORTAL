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
        Schema::create('application_assessment_meeting_comments', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('meeting_id')->constrained('application_assessment_meetings')->cascadeOnDelete();
            $table->foreignId('team_member_id')->constrained('application_assessment_team_members')->cascadeOnDelete();
            $table->text('comment');
            $table->timestamps();

            // Indexes
            $table->index('meeting_id', 'idx_meeting_comments_meeting');

            // Unique constraints
            $table->unique(['meeting_id', 'team_member_id'], 'unique_meeting_member_comment');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('application_assessment_meeting_comments');
    }
};
