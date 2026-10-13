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
        Schema::create('committee_meetings', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('committee_id')->nullable()->constrained('committees')->nullOnDelete();
            $table->string('meeting_number', 255)->unique();
            $table->string('title', 255);
            $table->dateTime('scheduled_at');
            $table->dateTime('started_at')->nullable();
            $table->dateTime('ended_at')->nullable();
            $table->enum('meeting_type', ['physical', 'virtual', 'hybrid'])->default('physical');
            $table->text('venue')->nullable();
            $table->string('meeting_link', 255)->nullable();
            $table->foreignId('chair_id')->nullable()->constrained('committee_members')->nullOnDelete();
            $table->foreignId('convenor_id')->nullable()->constrained('committee_members')->nullOnDelete();
            $table->text('remarks')->nullable();
            $table->enum('status', ['scheduled', 'in_progress', 'completed', 'cancelled', 'postponed'])->default('scheduled');
            $table->text('minutes')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->unsignedBigInteger('deleted_by')->nullable();

            // Indexes
            $table->index('committee_id');
            $table->index('meeting_number');
            $table->index('scheduled_at');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('committee_meetings');
    }
};
