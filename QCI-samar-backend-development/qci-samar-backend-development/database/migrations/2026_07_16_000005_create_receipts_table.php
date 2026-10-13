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
        // ERP-receipt projection of a successful Payment, pushed to Business
        // Central's ProcessReceipt. One row per payment.
        Schema::create('receipts', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('payment_id')->constrained('payments')->cascadeOnDelete();
            $table->foreignId('invoice_id')->nullable()->constrained('invoices')->nullOnDelete();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();

            $table->date('posting_date');
            $table->date('payment_date');
            $table->decimal('amount_received', 10, 2);
            $table->decimal('invoice_amount', 10, 2);
            $table->boolean('tds_deducted')->default(false);
            $table->decimal('tds_amount', 10, 2)->default(0);
            $table->string('tan', 10)->nullable();
            $table->string('payment_mode', 100);
            $table->string('utr_no', 20);

            $table->enum('bc_sync_status', ['pending', 'sending', 'sent', 'processed', 'failed'])->default('pending');
            $table->unsignedBigInteger('bc_entry_no')->nullable();
            $table->string('bc_error_text', 250)->nullable();
            $table->unsignedInteger('bc_attempts')->default(0);
            $table->timestamp('bc_sent_at')->nullable();
            $table->timestamp('bc_synced_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->unique('payment_id');
            $table->index('bc_sync_status');
            $table->index('bc_entry_no');
            $table->index(['bc_sync_status', 'bc_attempts'], 'idx_receipts_sync_retry');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('receipts');
    }
};
