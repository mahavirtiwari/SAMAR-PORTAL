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
        Schema::create('meeting_members', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('committee_meeting_id')->constrained('committee_meetings')->cascadeOnDelete();
            $table->foreignId('committee_member_id')->constrained('committee_members')->cascadeOnDelete();
            $table->enum('role', ['chair', 'convenor', 'member'])->default('member');
            $table->timestamps();

            // Unique constraint
            $table->unique(['committee_meeting_id', 'committee_member_id'], 'meeting_members_meeting_member_unique');

            // Index
            $table->index('role');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('meeting_members');
    }
};
