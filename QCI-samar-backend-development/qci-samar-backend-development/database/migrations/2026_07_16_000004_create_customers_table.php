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
        // ERP-customer projection of an Organization: one row per organization
        // pushed to Business Central. Payload is assembled from the live
        // Organization/Application at push time; this row owns the ERP identity
        // (reference_no = the enterprise admin's SAMAR ID, per QCI 16-Jul-2026)
        // and the sync state.
        Schema::create('customers', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('reference_no', 20)->unique();

            $table->enum('bc_sync_status', ['pending', 'sending', 'sent', 'processed', 'failed'])->default('pending');
            $table->unsignedBigInteger('bc_entry_no')->nullable();
            $table->string('bc_error_text', 250)->nullable();
            $table->boolean('bc_customer_exists')->default(false);
            $table->unsignedInteger('bc_attempts')->default(0);
            $table->timestamp('bc_sent_at')->nullable();
            $table->timestamp('bc_synced_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->unique('organization_id');
            $table->index('bc_sync_status');
            $table->index('bc_entry_no');
            $table->index(['bc_sync_status', 'bc_attempts'], 'idx_customers_sync_retry');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
