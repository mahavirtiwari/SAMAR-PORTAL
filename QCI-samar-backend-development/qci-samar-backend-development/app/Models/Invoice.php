<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A portal-raised invoice, pushed to Business Central.
 *
 * Business Central owns Entry_No and Error_Text; the portal owns
 * invoice_reference (see InvoiceReferenceGenerator).
 */
class Invoice extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * Refuse to hard-delete an invoice that holds ERP-supplied PDFs: doing so
     * drops the only reference to the invoice/receipt PDFs Business Central
     * pushed back, and the applicant can then never see or download them.
     * Soft-delete is still allowed (the row and its PDF paths survive).
     */
    protected static function booted(): void
    {
        static::deleting(function (Invoice $invoice) {
            if ($invoice->isForceDeleting() && ($invoice->invoice_pdf_path || $invoice->receipt_pdf_path)) {
                throw new \RuntimeException(
                    "Invoice {$invoice->invoice_reference} holds ERP-supplied PDF(s); refusing to force-delete (it would orphan the PDFs)."
                );
            }
        });
    }

    public const SYNC_PENDING = 'pending';

    public const SYNC_SENDING = 'sending';

    public const SYNC_SENT = 'sent';

    public const SYNC_PROCESSED = 'processed';

    public const SYNC_FAILED = 'failed';

    protected $fillable = [
        'application_id',
        'organization_id',
        'invoice_reference',
        'invoice_type',
        'posting_date',
        'voucher_date',
        'line_comments',
        'quantity',
        'base_amount',
        'assessment_type',
        'sub_discipline_name',
        'honorarium',
        'bc_sync_status',
        'bc_entry_no',
        'bc_error_text',
        'bc_invoice_no',
        'bc_attempts',
        'bc_sent_at',
        'bc_synced_at',
        'invoice_pdf_path',
        'invoice_pdf_disk',
        'receipt_pdf_path',
        'receipt_pdf_disk',
    ];

    protected function casts(): array
    {
        return [
            'posting_date' => 'date',
            'voucher_date' => 'date',
            'quantity' => 'decimal:2',
            'base_amount' => 'decimal:2',
            'honorarium' => 'boolean',
            'bc_entry_no' => 'integer',
            'bc_attempts' => 'integer',
            'bc_sent_at' => 'datetime',
            'bc_synced_at' => 'datetime',
        ];
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * Business Central rejected the row during its processing pass.
     */
    public function hasErpError(): bool
    {
        return filled($this->bc_error_text);
    }

    /**
     * Accepted by Business Central and processed without an error.
     */
    public function isProcessedByErp(): bool
    {
        return $this->bc_sync_status === self::SYNC_PROCESSED && ! $this->hasErpError();
    }

    /**
     * Rows that have been handed to Business Central but whose asynchronous
     * processing result has not been read back yet.
     */
    public function scopeAwaitingErpResult($query)
    {
        return $query->where('bc_sync_status', self::SYNC_SENT)->whereNotNull('bc_entry_no');
    }
}
