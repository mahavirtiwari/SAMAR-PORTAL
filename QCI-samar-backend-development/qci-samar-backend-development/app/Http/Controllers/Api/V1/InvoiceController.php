<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Role;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use OpenApi\Attributes as OA;

/**
 * Applicant- and ops-facing view of portal invoices, including the invoice and
 * receipt PDFs that Business Central pushes back after processing.
 *
 * PDF access is authorised through the invoice (organisation scoping), never by
 * bare document id, so one organisation cannot read another's financial
 * documents.
 */
class InvoiceController extends Controller
{
    /** Roles that may see every organisation's invoices. */
    private const ADMIN_ROLES = [
        Role::SYSTEM_ADMIN,
        Role::DRDO_ADMIN,
        Role::OPERATIONS_MANAGER,
        Role::OPERATIONS_ADMIN,
    ];

    #[OA\Get(
        path: '/api/v1/invoices',
        summary: 'List invoices for the caller\'s organisation',
        tags: ['Invoices'],
        security: [['bearerAuth' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Invoices retrieved'),
            new OA\Response(response: 403, description: 'Not authorised to view invoices'),
        ],
    )]
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->hasAnyRole([Role::ASSESSOR, Role::DRDO_LAB])) {
            return $this->errorResponse('You are not authorized to view invoices.', 403);
        }

        $query = Invoice::with(['application:id,application_number', 'organization:id,name']);

        if (! $user->hasAnyRole(self::ADMIN_ROLES)) {
            $query->where('organization_id', $user->organization_id);
        }

        if ($request->filled('application_id')) {
            $query->where('application_id', $request->input('application_id'));
        }

        if ($request->filled('search')) {
            $search = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], trim($request->input('search')));
            $query->where(function ($q) use ($search) {
                $q->where('invoice_reference', 'LIKE', "%{$search}%")
                    ->orWhere('bc_invoice_no', 'LIKE', "%{$search}%")
                    ->orWhereHas('application', fn ($a) => $a->where('application_number', 'LIKE', "%{$search}%"));
            });
        }

        $perPage = $this->resolvePerPage($request, 15);
        $invoices = $query->latest()->paginate($perPage);

        $invoices->getCollection()->transform(fn ($invoice) => $this->formatInvoice($invoice));

        return $this->paginatedResponse($invoices, 'Invoices retrieved successfully');
    }

    #[OA\Get(
        path: '/api/v1/invoices/{id}',
        summary: 'Get a single invoice',
        tags: ['Invoices'],
        security: [['bearerAuth' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Invoice retrieved'),
            new OA\Response(response: 403, description: 'Not authorised'),
            new OA\Response(response: 404, description: 'Invoice not found'),
        ],
    )]
    public function show(Request $request, int $id): JsonResponse
    {
        $invoice = Invoice::with(['application:id,application_number', 'organization:id,name'])->find($id);

        if (! $invoice) {
            return $this->errorResponse('Invoice not found', 404);
        }

        if (! $this->canAccess($request, $invoice)) {
            return $this->errorResponse('You are not authorized to view this invoice.', 403);
        }

        return $this->successResponse($this->formatInvoice($invoice), 'Invoice retrieved successfully');
    }

    #[OA\Get(
        path: '/api/v1/invoices/{id}/invoice-pdf',
        summary: 'Download the ERP-issued invoice PDF',
        tags: ['Invoices'],
        security: [['bearerAuth' => []]],
        responses: [
            new OA\Response(response: 200, description: 'PDF stream'),
            new OA\Response(response: 404, description: 'PDF not received from the ERP yet'),
        ],
    )]
    public function downloadInvoicePdf(Request $request, int $id)
    {
        return $this->streamDocument($request, $id, 'invoice');
    }

    #[OA\Get(
        path: '/api/v1/invoices/{id}/receipt-pdf',
        summary: 'Download the ERP-issued receipt PDF',
        tags: ['Invoices'],
        security: [['bearerAuth' => []]],
        responses: [
            new OA\Response(response: 200, description: 'PDF stream'),
            new OA\Response(response: 404, description: 'PDF not received from the ERP yet'),
        ],
    )]
    public function downloadReceiptPdf(Request $request, int $id)
    {
        return $this->streamDocument($request, $id, 'receipt');
    }

    /**
     * Serve one of the invoice's ERP documents, authorised via the invoice.
     */
    private function streamDocument(Request $request, int $id, string $type)
    {
        $invoice = Invoice::find($id);

        if (! $invoice) {
            return $this->errorResponse('Invoice not found', 404);
        }

        if (! $this->canAccess($request, $invoice)) {
            return $this->errorResponse('You are not authorized to access this invoice.', 403);
        }

        $path = $type === 'invoice' ? $invoice->invoice_pdf_path : $invoice->receipt_pdf_path;
        $disk = $type === 'invoice' ? $invoice->invoice_pdf_disk : $invoice->receipt_pdf_disk;

        if (! $path) {
            return $this->errorResponse(
                ucfirst($type).' PDF has not been received from the ERP for this invoice yet.',
                404
            );
        }

        $disk = $disk ?: config('documents.storage_disk', 'documents');

        if (! Storage::disk($disk)->exists($path)) {
            return $this->errorResponse(ucfirst($type).' PDF is missing from storage.', 404);
        }

        Log::info('ERP document downloaded', [
            'invoice_reference' => $invoice->invoice_reference,
            'type' => $type,
            'user_id' => $request->user()->id,
        ]);

        $downloadName = $type.'-'.str_replace('/', '-', $invoice->invoice_reference).'.pdf';

        return Storage::disk($disk)->download($path, $downloadName);
    }

    /**
     * Admin roles see everything; everyone else only their own organisation.
     */
    private function canAccess(Request $request, Invoice $invoice): bool
    {
        $user = $request->user();

        if ($user->hasAnyRole([Role::ASSESSOR, Role::DRDO_LAB])) {
            return false;
        }

        if ($user->hasAnyRole(self::ADMIN_ROLES)) {
            return true;
        }

        return $user->organization_id !== null
            && (int) $user->organization_id === (int) $invoice->organization_id;
    }

    /**
     * @return array<string, mixed>
     */
    private function formatInvoice(Invoice $invoice): array
    {
        return [
            'id' => $invoice->id,
            'invoice_reference' => $invoice->invoice_reference,
            'erp_invoice_no' => $invoice->bc_invoice_no,
            'invoice_type' => $invoice->invoice_type,
            'posting_date' => $invoice->posting_date?->toDateString(),
            'base_amount' => (float) $invoice->base_amount,
            'line_comments' => $invoice->line_comments,
            'application_id' => $invoice->application_id,
            'application_number' => $invoice->application?->application_number,
            'organization_name' => $invoice->organization?->name,
            'erp_status' => $invoice->bc_sync_status,
            'erp_error' => $invoice->bc_error_text,
            'invoice_pdf_available' => $invoice->invoice_pdf_path !== null,
            'receipt_pdf_available' => $invoice->receipt_pdf_path !== null,
        ];
    }
}
