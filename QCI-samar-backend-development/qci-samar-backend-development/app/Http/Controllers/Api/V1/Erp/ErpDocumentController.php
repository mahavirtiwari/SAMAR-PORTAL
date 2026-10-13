<?php

namespace App\Http\Controllers\Api\V1\Erp;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Erp\ErpDocumentUploadRequest;
use App\Models\Invoice;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ErpDocumentController extends Controller
{
    /**
     * Receive an invoice or receipt PDF pushed by Business Central.
     *
     * The PDF is owned by the invoice (invoice_pdf_path / receipt_pdf_path) and
     * stored at a deterministic per-invoice path, so re-uploading the same type
     * replaces the file in place (idempotent on invstr + pdffor). It is served
     * only through InvoiceController's organisation-scoped endpoints, never the
     * generic documents list.
     *
     * @OA\Post(
     *     path="/api/v1/erp/documents/upload",
     *     summary="Receive an invoice or receipt PDF from the ERP (Business Central)",
     *     tags={"ERP Integration"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *             required={"invstr","pdfstr","pdffor"},
     *
     *             @OA\Property(property="invstr", type="string", maxLength=20, example="SAMAR/2026-27/00001", description="Portal invoice reference"),
     *             @OA\Property(property="erp_invstr", type="string", maxLength=20, nullable=true, description="ERP-side invoice number"),
     *             @OA\Property(property="pdfstr", type="string", description="Base64-encoded PDF"),
     *             @OA\Property(property="pdffor", type="string", enum={"i","r"}, description="i = invoice PDF, r = receipt PDF")
     *         )
     *     ),
     *
     *     @OA\Response(response=201, description="PDF attached"),
     *     @OA\Response(response=200, description="PDF replaced"),
     *     @OA\Response(response=422, description="Validation failed"),
     *     @OA\Response(response=401, description="Unauthenticated"),
     *     @OA\Response(response=403, description="Not the ERP service account")
     * )
     */
    public function upload(ErpDocumentUploadRequest $request): JsonResponse
    {
        $data = $request->validated();

        $bytes = base64_decode($data['pdfstr'], true);
        if ($bytes === false || ! str_starts_with($bytes, '%PDF-')) {
            return response()->json([
                'success' => false,
                'message' => 'pdfstr is not a valid base64-encoded PDF.',
            ], 422);
        }

        $maxSize = config('documents.max_file_size', 52428800);
        if (strlen($bytes) > $maxSize) {
            return response()->json([
                'success' => false,
                'message' => 'PDF exceeds the maximum allowed size of '.($maxSize / 1048576).'MB.',
            ], 422);
        }

        $invoice = Invoice::where('invoice_reference', $data['invstr'])->firstOrFail();

        $isInvoicePdf = $data['pdffor'] === 'i';
        $label = $isInvoicePdf ? 'invoice' : 'receipt';
        $pathColumn = $isInvoicePdf ? 'invoice_pdf_path' : 'receipt_pdf_path';
        $diskColumn = $isInvoicePdf ? 'invoice_pdf_disk' : 'receipt_pdf_disk';

        $disk = config('documents.storage_disk', 'documents');
        $reference = str_replace('/', '-', $invoice->invoice_reference);
        $path = "invoices/{$reference}/{$label}.pdf";

        try {
            $replaced = (bool) $invoice->{$pathColumn};

            if (! Storage::disk($disk)->put($path, $bytes)) {
                throw new \RuntimeException('Failed to store PDF.');
            }

            $invoice->{$pathColumn} = $path;
            $invoice->{$diskColumn} = $disk;
            if (! empty($data['erp_invstr'])) {
                $invoice->bc_invoice_no = $data['erp_invstr'];
            }
            $invoice->save();

            Log::info('ERP document received', [
                'invoice_reference' => $invoice->invoice_reference,
                'type' => $label,
                'path' => $path,
                'replaced' => $replaced,
            ]);

            return response()->json([
                'success' => true,
                'message' => ucfirst($label).' PDF '.($replaced ? 'replaced' : 'attached').'.',
                'data' => [
                    'invoice_reference' => $invoice->invoice_reference,
                    'replaced' => $replaced,
                ],
            ], $replaced ? 200 : 201);
        } catch (\Exception $e) {
            Log::error('ERP document upload failed', [
                'invoice_reference' => $data['invstr'],
                'type' => $label,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to store document.',
            ], 500);
        }
    }
}
