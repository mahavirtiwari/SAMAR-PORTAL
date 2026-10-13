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
        Schema::create('invoices', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('application_id')->constrained('applications')->cascadeOnDelete();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();

            // Portal-generated reference. QCI confirmed Business Central leaves
            // Invoice_No blank and reads this value from its 'TADA Invoice No.'
            // field, which is Code 20 — hence the 20-char cap.
            $table->string('invoice_reference', 20)->unique();

            $table->enum('invoice_type', ['application_fee', 'assessment_fee', 'certification_fee', 'surveillance_fee', 'other'])->nullable();
            $table->date('posting_date');
            $table->date('voucher_date');
            $table->string('line_comments', 500)->nullable();
            $table->decimal('quantity', 10, 2)->default(1);

            // Business Central 'Other Amount' — invoice base amount, excluding GST.
            $table->decimal('base_amount', 10, 2);
            $table->string('assessment_type', 30)->nullable();
            $table->string('sub_discipline_name', 50)->nullable();
            $table->boolean('honorarium')->default(false);

            // Business Central sync state. Entry_No and Error_Text are owned by
            // BC: Entry_No comes back on the create response, Error_Text is
            // written later by BC's asynchronous processing job.
            $table->enum('bc_sync_status', ['pending', 'sending', 'sent', 'processed', 'failed'])->default('pending');
            $table->unsignedBigInteger('bc_entry_no')->nullable();
            $table->string('bc_error_text', 250)->nullable();
            $table->unsignedInteger('bc_attempts')->default(0);
            $table->timestamp('bc_sent_at')->nullable();
            $table->timestamp('bc_synced_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index('invoice_reference');
            $table->index('bc_sync_status');
            $table->index('bc_entry_no');
            $table->index('posting_date');
            $table->index(['bc_sync_status', 'bc_attempts'], 'idx_invoices_sync_retry');
            $table->index(['organization_id', 'bc_sync_status'], 'idx_invoices_org_sync');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('invoices');
    }
};
