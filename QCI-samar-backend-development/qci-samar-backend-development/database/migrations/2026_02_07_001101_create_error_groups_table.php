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
        Schema::create('error_groups', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('fingerprint', 64)->unique();
            $table->string('signature', 500);
            $table->string('exception_class', 255);
            $table->text('exception_message');
            $table->string('file', 500);
            $table->unsignedInteger('line');
            $table->string('request_endpoint', 255)->nullable();
            $table->unsignedBigInteger('occurrences_count')->default(1);
            $table->unsignedBigInteger('affected_users_count')->default(0);
            $table->timestamp('first_seen_at');
            $table->timestamp('last_seen_at');
            $table->enum('severity', ['emergency', 'critical', 'error', 'warning', 'notice'])->default('error');
            $table->enum('status', ['active', 'resolved', 'ignored', 'archived'])->default('active');
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            // Indexes
            $table->index('exception_class');
            $table->index('request_endpoint');
            $table->index('first_seen_at');
            $table->index('last_seen_at');
            $table->index('severity');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('error_groups');
    }
};
