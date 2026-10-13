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
        Schema::create('error_logs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('error_id', 16)->unique();
            $table->foreignId('error_group_id')->nullable()->constrained('error_groups')->nullOnDelete();
            $table->string('exception_class', 255);
            $table->text('exception_message');
            $table->string('exception_code', 255)->nullable();
            $table->string('file', 500);
            $table->unsignedInteger('line');
            $table->enum('severity', ['emergency', 'critical', 'error', 'warning', 'notice'])->default('error');
            $table->unsignedSmallInteger('http_status_code');
            $table->string('request_method', 10);
            $table->text('request_url');
            $table->string('request_endpoint', 255);
            $table->string('ip_address', 45);
            $table->text('user_agent')->nullable();
            $table->string('request_id', 36)->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('user_email', 255)->nullable();
            $table->json('user_roles')->nullable();
            $table->longText('stack_trace');
            $table->json('request_headers')->nullable();
            $table->json('request_body')->nullable();
            $table->json('request_query')->nullable();
            $table->json('context')->nullable();
            $table->string('environment', 20);
            $table->string('server_hostname', 255)->nullable();
            $table->string('app_version', 20)->nullable();
            $table->string('fingerprint', 64);
            $table->enum('status', ['new', 'investigating', 'resolved', 'ignored', 'archived'])->default('new');
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->text('resolution_notes')->nullable();
            $table->boolean('notified')->default(false);
            $table->json('tags')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamp('created_at')->nullable();

            // Indexes
            $table->index('http_status_code');
            $table->index('request_endpoint');
            $table->index('ip_address');
            $table->index('request_id');
            $table->index('environment');
            $table->index('fingerprint');
            $table->index('status');
            $table->index('occurred_at');
            $table->index(['exception_class', 'occurred_at']);
            $table->index(['status', 'severity', 'occurred_at']);
            $table->index(['fingerprint', 'occurred_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('error_logs');
    }
};
