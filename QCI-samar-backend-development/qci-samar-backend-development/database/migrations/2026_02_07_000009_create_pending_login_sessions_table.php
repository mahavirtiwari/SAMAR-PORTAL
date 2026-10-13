<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pending_login_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('session_token', 64)->unique();
            $table->string('otp_code');
            $table->timestamp('otp_expires_at');
            $table->integer('otp_attempts')->default(0);
            $table->timestamp('otp_locked_until')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->string('device_type', 50)->default('web');
            $table->string('device_name')->nullable();
            $table->integer('resend_count')->default(0);
            $table->timestamp('expires_at');
            $table->timestamps();
            $table->index('session_token');
            $table->index(['user_id', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pending_login_sessions');
    }
};
