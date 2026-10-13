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
        Schema::create('committee_decisions', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('committee_meeting_id')->constrained('committee_meetings')->cascadeOnDelete();
            $table->foreignId('application_id')->constrained('applications')->cascadeOnDelete();
            $table->foreignId('assessment_id')->nullable()->constrained('application_assessments')->nullOnDelete();
            $table->enum('decision', ['approved', 'conditionally_approved', 'rejected', 'deferred', 'more_information_required']);
            $table->json('conditions')->nullable();
            $table->date('conditions_deadline')->nullable();
            $table->integer('votes_for')->default(0);
            $table->integer('votes_against')->default(0);
            $table->integer('votes_abstain')->default(0);
            $table->json('voting_details')->nullable();
            $table->text('remarks')->nullable();
            $table->text('justification')->nullable();
            $table->text('recommendations')->nullable();
            $table->json('improvement_areas')->nullable();
            $table->date('valid_from')->nullable();
            $table->date('valid_until')->nullable();
            $table->integer('validity_months')->nullable();
            $table->boolean('requires_followup')->default(false);
            $table->date('followup_date')->nullable();
            $table->text('followup_remarks')->nullable();
            $table->enum('status', ['pending', 'communicated', 'acknowledged'])->default('pending');
            $table->timestamp('communicated_at')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            // Indexes
            $table->index('decision');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('committee_decisions');
    }
};
