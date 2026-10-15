<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Status changes of enterprises (organizations) and user accounts — activation,
 * deactivation with the reason given, suspension, lockout — kept permanently for
 * the enterprise journey. Same shape as application_status_histories; unlike
 * audit_logs it is not pruned by the retention job.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('account_status_histories', function (Blueprint $table) {
            $table->id();
            $table->morphs('subject');
            $table->string('from_status')->nullable();
            $table->string('to_status');
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('changed_by_role')->nullable();
            $table->text('remarks')->nullable();
            $table->json('metadata')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('changed_at')->useCurrent();

            $table->index('changed_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('account_status_histories');
    }
};
