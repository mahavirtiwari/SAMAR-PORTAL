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
        Schema::table('invoices', function (Blueprint $table) {
            // BC's own invoice number (erp_invstr on the inbound upload).
            $table->string('bc_invoice_no', 20)->nullable()->after('bc_error_text');

            // PDFs pushed by Business Central: pdffor "i" and "r" respectively.
            $table->foreignId('invoice_document_id')->nullable()->after('bc_synced_at')->constrained('documents')->nullOnDelete();
            $table->foreignId('receipt_document_id')->nullable()->after('invoice_document_id')->constrained('documents')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropConstrainedForeignId('invoice_document_id');
            $table->dropConstrainedForeignId('receipt_document_id');
            $table->dropColumn('bc_invoice_no');
        });
    }
};
