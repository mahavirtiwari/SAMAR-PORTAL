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
        Schema::create('payment_reconciliations', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('payment_id')->constrained('payments')->cascadeOnDelete();
            $table->string('reconciliation_reference', 255)->unique();
            $table->date('settlement_date')->nullable();
            $table->decimal('settlement_amount', 10, 2);
            $table->decimal('gateway_fee_actual', 10, 2)->nullable();
            $table->decimal('tax_actual', 10, 2)->nullable();
            $table->decimal('net_settlement', 10, 2);
            $table->decimal('amount_variance', 10, 2)->default(0);
            $table->boolean('has_variance')->default(false);
            $table->text('variance_remarks')->nullable();
            $table->enum('status', ['pending', 'matched', 'mismatched', 'resolved'])->default('pending');
            $table->string('bank_reference', 255)->nullable();
            $table->string('utr_number', 255)->nullable();
            $table->json('gateway_settlement_data')->nullable();
            $table->json('bank_statement_data')->nullable();
            $table->unsignedBigInteger('reconciled_by')->nullable();
            $table->timestamp('reconciled_at')->nullable();
            $table->timestamps();

            // Indexes
            $table->index('reconciliation_reference');
            $table->index('settlement_date');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payment_reconciliations');
    }
};
