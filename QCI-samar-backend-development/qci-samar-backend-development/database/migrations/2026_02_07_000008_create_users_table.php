<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('samar_id', 25)->nullable()->unique();
            $table->foreignId('organization_id')->nullable()->constrained()->onDelete('cascade');
            $table->string('first_name');
            $table->string('last_name');
            $table->string('email');
            $table->string('mobile_number', 15);
            $table->string('designation', 100)->nullable();
            $table->string('external_organization')->nullable()
                ->comment('Organization name for external committee members');
            $table->string('district', 100)->nullable();
            $table->string('state', 100)->nullable();
            $table->text('address')->nullable();
            $table->string('city', 100)->nullable();
            $table->string('pincode', 6)->nullable();
            $table->string('password');
            $table->timestamp('password_changed_at')->nullable();
            $table->boolean('is_two_factor_enabled')->default(false)->comment('Whether two-factor authentication is enabled for this user');
            $table->timestamp('email_verified_at')->nullable();
            $table->string('email_verification_token')->nullable();
            $table->string('otp_code')->nullable();
            $table->timestamp('otp_expires_at')->nullable();
            $table->integer('otp_attempts')->default(0);
            $table->timestamp('otp_locked_until')->nullable();
            $table->integer('failed_login_attempts')->default(0);
            $table->timestamp('locked_until')->nullable();
            $table->timestamp('last_login_at')->nullable();
            $table->string('last_login_ip')->nullable();
            $table->enum('status', ['invited', 'pending_verification', 'active', 'suspended', 'inactive'])->default('pending_verification');
            $table->boolean('is_profile_completed')->default(false);
            $table->timestamp('profile_completed_at')->nullable();
            $table->string('current_session_id')->nullable();
            $table->timestamp('session_started_at')->nullable();
            $table->timestamps();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->index('status');
            $table->index('email');
            $table->index('mobile_number');
            $table->index('last_login_at');
            $table->index(['first_name', 'last_name'], 'idx_users_name');
            $table->index('created_at', 'idx_users_created');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
