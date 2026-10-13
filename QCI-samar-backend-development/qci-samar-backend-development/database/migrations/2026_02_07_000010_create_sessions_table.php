<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sessions', function (Blueprint $table) {
            $table->id();
            $table->string('session_id')->unique();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->text('token')->nullable();
            $table->enum('token_type', ['access', 'refresh'])->default('access');
            $table->timestamp('expires_at');
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->string('device_type')->nullable();
            $table->string('device_name')->nullable();
            $table->timestamp('last_activity_at')->nullable();
            $table->timestamp('started_at')->useCurrent();
            $table->timestamp('ended_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->enum('termination_reason', ['logout', 'timeout', 'forced', 'new_session', 'expired', 'password_reset'])->nullable();
            $table->timestamps();
            $table->index('session_id');
            $table->index(['user_id', 'is_active']);
            $table->index('expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sessions');
    }
};
