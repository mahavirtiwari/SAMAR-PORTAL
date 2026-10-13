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
        Schema::create('payments', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('application_id')->constrained('applications')->cascadeOnDelete();
            $table->enum('payment_type', ['application_fee', 'assessment_fee', 'certification_fee', 'surveillance_fee', 'other'])->nullable();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('payment_id', 255)->unique();
            $table->string('transaction_id', 255)->nullable();
            $table->string('order_id', 255)->unique();
            $table->string('gateway', 255)->nullable();
            $table->string('gateway_payment_id', 255)->nullable()->unique();
            $table->string('gateway_order_id', 255)->nullable();
            $table->string('gateway_signature', 255)->nullable();
            $table->decimal('amount', 10, 2);
            $table->string('currency', 3)->default('INR');
            $table->decimal('gateway_fee', 10, 2)->default(0);
            $table->decimal('tax_amount', 10, 2)->default(0);
            $table->decimal('net_amount', 10, 2);
            $table->enum('payment_method', ['card', 'netbanking', 'upi', 'wallet', 'emi', 'other'])->nullable();
            $table->string('payment_method_details', 255)->nullable();
            $table->enum('status', ['initiated', 'pending', 'processing', 'success', 'failed', 'cancelled', 'refund_initiated', 'refunded', 'partially_refunded'])->default('initiated');
            $table->timestamp('initiated_at')->useCurrent();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('failure_reason', 255)->nullable();
            $table->text('failure_message')->nullable();
            $table->string('error_code', 255)->nullable();
            $table->decimal('refund_amount', 10, 2)->nullable();
            $table->string('refund_id', 255)->nullable();
            $table->timestamp('refund_initiated_at')->nullable();
            $table->timestamp('refunded_at')->nullable();
            $table->text('refund_reason')->nullable();
            $table->boolean('is_verified')->default(false);
            $table->timestamp('verified_at')->nullable();
            $table->unsignedBigInteger('verified_by')->nullable();
            $table->boolean('is_reconciled')->default(false);
            $table->timestamp('reconciled_at')->nullable();
            $table->json('webhook_payload')->nullable();
            $table->timestamp('webhook_received_at')->nullable();
            $table->string('customer_name', 255)->nullable();
            $table->string('customer_email', 255)->nullable();
            $table->string('customer_phone', 15)->nullable();
            $table->string('gstin', 15)->nullable();
            $table->string('tan', 10)->nullable();
            $table->string('receipt_number', 255)->nullable();
            $table->foreignId('receipt_document_id')->nullable()->constrained('documents')->nullOnDelete();
            $table->text('description')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->softDeletes();

            // Indexes
            $table->index('payment_id');
            $table->index('transaction_id');
            $table->index('order_id');
            $table->index('gateway_payment_id');
            $table->index('status');
            $table->index('is_verified');
            $table->index('is_reconciled');
            $table->index('created_at');
            $table->index('payment_type');
            $table->index(['status', 'completed_at'], 'idx_payments_status_completed');
            $table->index(['gateway', 'status'], 'idx_payments_gateway_status');
            $table->index(['organization_id', 'status'], 'idx_payments_org_status');
            $table->index(['is_reconciled', 'completed_at'], 'idx_payments_reconciled');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
