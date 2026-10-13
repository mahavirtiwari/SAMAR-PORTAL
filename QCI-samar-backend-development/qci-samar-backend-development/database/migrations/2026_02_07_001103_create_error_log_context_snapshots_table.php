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
        Schema::create('error_log_context_snapshots', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('error_log_id')->constrained('error_logs')->cascadeOnDelete();
            $table->json('server_variables')->nullable();
            $table->json('config_snapshot')->nullable();
            $table->json('session_data')->nullable();
            $table->json('route_parameters')->nullable();
            $table->json('database_queries')->nullable();
            $table->unsignedInteger('query_count')->nullable();
            $table->unsignedInteger('query_time_ms')->nullable();
            $table->unsignedBigInteger('memory_usage_bytes')->nullable();
            $table->unsignedBigInteger('memory_peak_bytes')->nullable();
            $table->unsignedInteger('execution_time_ms')->nullable();
            $table->json('previous_exceptions')->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('error_log_context_snapshots');
    }
};
