<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organizations', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email');
            $table->string('alternate_email')->nullable();
            $table->string('mobile_number', 15)->nullable();
            $table->string('landline_number', 15)->nullable();
            $table->string('pan', 10)->unique()->nullable();
            $table->text('registered_address')->nullable();
            $table->string('registered_state')->nullable();
            $table->string('registered_district')->nullable();
            $table->string('registered_pincode', 6)->nullable();
            $table->string('owner_name')->nullable();
            $table->string('owner_designation')->nullable();
            $table->string('owner_email')->nullable();
            $table->string('owner_mobile_number', 15)->nullable();
            $table->enum('status', ['pending_details', 'active', 'inactive'])->default('pending_details');
            $table->boolean('is_verified')->default(false);
            $table->timestamp('verified_at')->nullable();
            $table->unsignedBigInteger('verified_by')->nullable();
            $table->boolean('is_profile_completed')->default(false);
            $table->timestamp('profile_completed_at')->nullable();
            $table->timestamps();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->index('status');
            $table->index('is_verified');
            $table->index('created_at');
            $table->index('name', 'idx_organizations_name');
            $table->index('email', 'idx_organizations_email');
            $table->index('mobile_number', 'idx_organizations_mobile_number');
            $table->index('pan', 'idx_organizations_pan');
            $table->index('registered_state', 'idx_organizations_state');
            $table->index(['status', 'is_verified'], 'idx_organizations_status_verified');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('organizations');
    }
};
