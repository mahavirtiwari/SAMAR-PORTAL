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
        Schema::create('application_assessments', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('application_id')->constrained('applications')->cascadeOnDelete();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->foreignId('unit_id')->constrained('units')->cascadeOnDelete();
            $table->string('assessment_number', 255)->unique();
            $table->enum('status', [
                'allocation_pending',
                'scheduled',
                'in_progress',
                'submitted_for_qc',
                'qc_feedback',
                'ready_for_committee',
                'committee_review',
                'committee_feedback',
                'certified',
            ])->default('allocation_pending');
            $table->json('step_progress')->nullable();
            $table->date('scheduled_start_date')->nullable();
            $table->date('scheduled_end_date')->nullable();
            $table->date('actual_start_date')->nullable();
            $table->date('actual_end_date')->nullable();
            $table->decimal('total_score', 10, 2)->nullable();
            $table->json('qc_feedback')->nullable();
            $table->unsignedBigInteger('qc_reviewed_by')->nullable();
            $table->timestamp('qc_reviewed_at')->nullable();
            $table->text('committee_remarks')->nullable();
            $table->json('committee_feedback')->nullable();
            $table->unsignedBigInteger('committee_reviewed_by')->nullable();
            $table->timestamp('committee_reviewed_at')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->unsignedBigInteger('cancelled_by')->nullable();
            $table->timestamp('allocated_at')->nullable();
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->unsignedBigInteger('deleted_by')->nullable();

            // Foreign keys
            $table->foreign('qc_reviewed_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('committee_reviewed_by')->references('id')->on('users')->nullOnDelete();

            // Indexes
            $table->index('assessment_number', 'idx_app_assessments_number');
            $table->index('status', 'idx_app_assessments_status');
            $table->index('scheduled_start_date');
            $table->index('created_at', 'idx_app_assessments_created');
            $table->index(['status', 'started_at'], 'idx_app_assessments_status_started');
            $table->index(['status', 'completed_at'], 'idx_app_assessments_status_completed');
            $table->index(['started_at', 'completed_at'], 'idx_app_assessments_duration');
            $table->index(['status', 'submitted_at'], 'idx_app_assessments_status_submitted');
            $table->index('qc_reviewed_by');
            $table->index('qc_reviewed_at');
            $table->index('committee_reviewed_by');
            $table->index('committee_reviewed_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('application_assessments');
    }
};
