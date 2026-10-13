<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Invoice and receipt PDFs are 1:1-owned by an invoice, yet were stored in
     * the generic `documents` table and served through the unscoped generic
     * documents endpoint — leaking one organisation's financial documents to
     * every authenticated user. Move them onto the invoice itself (mirroring
     * certificates.certificate_pdf_path), so access is always org-scoped through
     * InvoiceController. Physical files are left in place and re-pointed; only
     * the now-orphaned `documents` rows are removed.
     */
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->string('invoice_pdf_path')->nullable()->after('bc_invoice_no');
            $table->string('invoice_pdf_disk', 50)->nullable()->after('invoice_pdf_path');
            $table->string('receipt_pdf_path')->nullable()->after('invoice_pdf_disk');
            $table->string('receipt_pdf_disk', 50)->nullable()->after('receipt_pdf_path');
        });

        // Re-point existing invoices at their stored PDF (path + disk copied from
        // the linked document; the physical file stays where it is).
        DB::statement('UPDATE invoices i JOIN documents d ON i.invoice_document_id = d.id '
            .'SET i.invoice_pdf_path = d.file_path, i.invoice_pdf_disk = d.disk '
            .'WHERE i.invoice_document_id IS NOT NULL');
        DB::statement('UPDATE invoices i JOIN documents d ON i.receipt_document_id = d.id '
            .'SET i.receipt_pdf_path = d.file_path, i.receipt_pdf_disk = d.disk '
            .'WHERE i.receipt_document_id IS NOT NULL');

        $orphanedDocumentIds = DB::table('invoices')->whereNotNull('invoice_document_id')->pluck('invoice_document_id')
            ->merge(DB::table('invoices')->whereNotNull('receipt_document_id')->pluck('receipt_document_id'))
            ->unique()
            ->values()
            ->all();

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropConstrainedForeignId('invoice_document_id');
            $table->dropConstrainedForeignId('receipt_document_id');
        });

        // Remove the DB rows only — the files remain, now owned by the invoice.
        if (! empty($orphanedDocumentIds)) {
            DB::table('documents')->whereIn('id', $orphanedDocumentIds)->delete();
        }
    }

    /**
     * Restores the schema shape. The removed `documents` rows and their FK
     * values are not recoverable — invoices keep their PDFs via the path
     * columns until this down() drops them, so this is a schema-only reversal.
     */
    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->foreignId('invoice_document_id')->nullable()->after('bc_synced_at')->constrained('documents')->nullOnDelete();
            $table->foreignId('receipt_document_id')->nullable()->after('invoice_document_id')->constrained('documents')->nullOnDelete();
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['invoice_pdf_path', 'invoice_pdf_disk', 'receipt_pdf_path', 'receipt_pdf_disk']);
        });
    }
};
