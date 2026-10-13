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
        Schema::create('committee_meeting_assessments', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('committee_meeting_id')->constrained('committee_meetings')->cascadeOnDelete();
            $table->foreignId('assessment_id')->constrained('application_assessments')->cascadeOnDelete();
            $table->enum('decision', ['pending', 'certified', 'feedback'])->default('pending');
            $table->text('remarks')->nullable();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();

            // Unique constraint
            $table->unique(['committee_meeting_id', 'assessment_id'], 'meeting_assessment_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('committee_meeting_assessments');
    }
};
