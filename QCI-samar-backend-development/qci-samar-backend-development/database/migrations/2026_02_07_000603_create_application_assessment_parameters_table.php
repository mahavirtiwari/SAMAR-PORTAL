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
        Schema::create('application_assessment_parameters', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('assessment_id')->constrained('application_assessments')->cascadeOnDelete();
            $table->string('discipline_name', 255)->nullable();
            $table->string('code', 50);
            $table->string('name', 255);
            $table->boolean('is_mandatory')->default(false);
            $table->unsignedBigInteger('assigned_to_team_member_id')->nullable();
            $table->timestamps();

            // Foreign key
            $table->foreign('assigned_to_team_member_id', 'fk_params_team_member')
                ->references('id')
                ->on('application_assessment_team_members')
                ->nullOnDelete();

            // Indexes
            $table->index(['assessment_id', 'code'], 'idx_app_params_assessment_code');
            $table->index('assigned_to_team_member_id', 'idx_params_assigned_team_member');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('application_assessment_parameters');
    }
};
