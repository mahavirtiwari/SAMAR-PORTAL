<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Cleanup after invoice/receipt PDFs moved onto the invoices table.
     *
     * - `payments.receipt_document_id` and `certificates.certificate_document_id`
     *   are FKs into the generic `documents` table that no code ever wrote
     *   (certificates use certificate_pdf_path; payments never populated theirs).
     *   Drop them — they were dead weight pointing at the wrong owner.
     * - The prior migration hard-deleted the *active* invoice/receipt document
     *   rows; earlier ERP "replace" operations left soft-deleted invoice/receipt
     *   rows behind (their files were already removed at replace time). Purge
     *   those orphans so the `documents` table holds only genuine documents.
     */
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('receipt_document_id');
        });

        Schema::table('certificates', function (Blueprint $table) {
            $table->dropConstrainedForeignId('certificate_document_id');
        });

        DB::table('documents')
            ->whereNotNull('deleted_at')
            ->where(function ($q) {
                $q->where('title', 'like', 'invoice-%')
                    ->orWhere('title', 'like', 'receipt-%');
            })
            ->delete();
    }

    /**
     * Restores the dropped columns only. The purged orphan rows were already
     * soft-deleted with their files gone, so they are not restorable.
     */
    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->foreignId('receipt_document_id')->nullable()->constrained('documents')->nullOnDelete();
        });

        Schema::table('certificates', function (Blueprint $table) {
            $table->foreignId('certificate_document_id')->nullable()->constrained('documents')->nullOnDelete();
        });
    }
};
