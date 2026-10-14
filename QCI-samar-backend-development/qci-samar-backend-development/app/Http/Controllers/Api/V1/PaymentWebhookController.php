<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ErrorReporter;
use App\Http\Controllers\Controller;
use App\Models\ErrorLog;
use App\Models\Payment;
use App\Services\Payment\ICICIEazyPayAdapter;
use App\Services\Payment\PaymentSettlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use OpenApi\Attributes as OA;

#[OA\Tag(
    name: 'Payment Webhooks',
    description: 'Payment gateway webhook endpoints for handling payment notifications',
)]
class PaymentWebhookController extends Controller
{
    public function __construct(
        private PaymentSettlementService $settlement
    ) {}

    /**
     * Handle ICICI EazyPay push notification webhook.
     */
    #[OA\Post(
        path: '/api/v1/webhooks/payments/icici-eazypay',
        summary: 'Handle ICICI EazyPay webhook',
        description: 'Receives and processes real-time push notifications from ICICI EazyPay. This endpoint receives encrypted XML data which is decrypted and processed to update payment status. No authentication required as this is called by the payment gateway.',
        tags: ['Payment Webhooks'],
        requestBody: new OA\RequestBody(
            required: true,
            content: [
                new OA\MediaType(
                    mediaType: 'text/plain',
                    schema: new OA\Schema(type: 'string', description: 'Encrypted XML data from ICICI EazyPay'),
                ),
            ],
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Webhook processed successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Webhook processed successfully',
                        ),
                    ],
                ),
            ),
        ],
    )]
    public function iciciEazyPay(Request $request): JsonResponse
    {
        try {
            // Get raw content (encrypted data)
            $encryptedData = $request->getContent();

            Log::info('ICICI EazyPay webhook received', [
                'full_url' => $request->fullUrl(),
                'method' => $request->method(),
                'content_length' => strlen($encryptedData),
                'content_type' => $request->header('Content-Type'),
            ]);

            // Get gateway adapter
            $gateway = new ICICIEazyPayAdapter;

            // Prepare payload for parsing (adapter will decrypt)
            $payload = [
                'encrypted_data' => $encryptedData,
            ];

            // Parse webhook payload (decrypts and parses XML)
            $parsedData = $gateway->parseWebhookPayload($payload);

            // Metadata only: the raw payload carries customer details (PII).
            Log::info('ICICI EazyPay webhook parsed', [
                'event' => $parsedData['event'] ?? 'unknown',
                'payment_id' => $parsedData['payment_id'] ?? null,
                'status' => $parsedData['status'] ?? null,
                'response_code' => $parsedData['response_code'] ?? null,
                'amount' => $parsedData['amount'] ?? null,
            ]);

            // HashVal is checked for diagnostics only. The push is never trusted
            // to settle a payment by itself — processICICIWebhookEvent re-verifies
            // every verdict with the gateway — so a missing or bad hash cannot
            // move money.
            $hashVal = $parsedData['hash_value'] ?? '';
            if (! $hashVal || ! $gateway->verifyWebhookSignature($parsedData['raw_payload'] ?? [], $hashVal)) {
                Log::warning('ICICI EazyPay webhook signature missing or invalid; verdict will be re-verified', [
                    'hash_present' => (bool) $hashVal,
                ]);
            }

            // Without a transaction id there is nothing to match. Guard it: a
            // where() against null becomes IS NULL and would match an unrelated
            // payment that has no gateway id yet.
            $transactionId = (string) ($parsedData['payment_id'] ?? '');
            if ($transactionId === '') {
                Log::warning('ICICI EazyPay webhook without a transaction id ignored');

                return $this->successResponse(null, 'Webhook acknowledged');
            }

            // Find payment by gateway_payment_id (TrnId) or gateway_order_id
            $payment = Payment::where('gateway_payment_id', $transactionId)
                ->orWhere('gateway_order_id', $transactionId)
                ->first();

            if (! $payment) {
                Log::warning('ICICI EazyPay payment not found for webhook', [
                    'payment_id' => $parsedData['payment_id'],
                ]);

                return $this->successResponse(null, 'Payment not found, webhook acknowledged');
            }

            // Process the webhook event
            $this->processICICIWebhookEvent($payment, $parsedData, $gateway);

            return $this->successResponse(null, 'Webhook processed successfully');
        } catch (\Exception $e) {
            Log::error('ICICI EazyPay webhook processing error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            app(ErrorReporter::class)->captureException($e, 'payment', ['stage' => 'webhook']);

            // Return 200 to prevent webhook retries
            return $this->serverErrorResponse($e, 'Webhook processing failed', 200);
        }
    }

    /**
     * Handle ICICI EazyPay return URL callback.
     */
    #[OA\Get(
        path: '/api/v1/payments/icici-eazypay/callback',
        summary: 'Handle ICICI EazyPay return callback',
        description: 'Handles the return URL callback from ICICI EazyPay after payment completion. This endpoint validates the response signature and updates payment status.',
        tags: ['Payment Webhooks'],
        parameters: [
            new OA\Parameter(
                name: 'Response Code',
                in: 'query',
                required: true,
                description: 'E000 for success',
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'Unique Ref Number',
                in: 'query',
                required: true,
                description: 'EazyPay Transaction ID',
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'Transaction Amount',
                in: 'query',
                required: true,
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'Total Amount',
                in: 'query',
                required: true,
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'Service Tax Amount',
                in: 'query',
                required: true,
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'Processing Fee Amount',
                in: 'query',
                required: true,
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'Payment Mode',
                in: 'query',
                required: true,
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'ReferenceNo',
                in: 'query',
                required: true,
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'SubMerchantId',
                in: 'query',
                required: true,
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'ID',
                in: 'query',
                required: true,
                description: 'Merchant EazyPay ID',
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'RS',
                in: 'query',
                required: true,
                description: 'SHA512 Signature',
                schema: new OA\Schema(type: 'string'),
            ),
        ],
        responses: [
            new OA\Response(response: 302, description: 'Redirects to frontend with payment status'),
        ],
    )]
    public function iciciEazyPayCallback(Request $request): RedirectResponse|JsonResponse
    {
        try {
            $responseData = $request->all();

            // Log non-sensitive metadata only; raw responseData contains customer PII
            Log::info('ICICI EazyPay callback received', [
                'response_keys' => array_keys($responseData),
                'response_code' => $responseData['Response Code'] ?? $responseData['Response_Code'] ?? null,
                'reference_no' => $responseData['ReferenceNo'] ?? null,
                'eazypay_tran_id' => $responseData['Unique Ref Number'] ?? $responseData['Unique_Ref_Number'] ?? null,
                'rs_present' => isset($responseData['RS']),
            ]);

            // Get gateway adapter and parse response
            $gateway = new ICICIEazyPayAdapter;
            $parsedResponse = $gateway->parseReturnResponse($responseData);

            Log::info('ICICI EazyPay callback parsed', [
                'valid' => $parsedResponse['valid'],
                'success' => $parsedResponse['success'],
                'response_code' => $parsedResponse['response_code'],
                'eazypay_tran_id' => $parsedResponse['eazypay_tran_id'] ?? null,
                'reference_no' => $parsedResponse['reference_no'] ?? null,
                'transaction_amount' => $parsedResponse['transaction_amount'] ?? null,
                'payment_mode' => $parsedResponse['payment_mode'] ?? null,
                'message' => $parsedResponse['message'] ?? null,
            ]);

            // Find payment by reference number (gateway_order_id)
            $referenceNo = $parsedResponse['reference_no'];
            $payment = Payment::where('gateway_order_id', $referenceNo)->first();

            if (! $payment) {
                Log::warning('ICICI EazyPay callback - payment not found', [
                    'reference_no' => $referenceNo,
                ]);

                return $this->redirectToFrontend([
                    'status' => 'error',
                    'message' => 'Payment not found',
                ]);
            }

            // The return URL is public, so only a signed callback is a verdict. An
            // unsigned or mis-signed one — success or failure — is recorded and
            // then checked with the gateway directly; it never changes the
            // payment on its own. (Settling a forged failure used to strand a
            // payment the customer then made.)
            if (! $parsedResponse['valid']) {
                if ($parsedResponse['success']) {
                    // error-level: an E000 we cannot verify may mean ICICI collected
                    // money that our integration cannot prove. Needs ops attention
                    // unless the gateway check below confirms it.
                    Log::error('ICICI EazyPay callback - invalid signature on a success response', [
                        'payment_id' => $payment->id,
                        'reference_no' => $parsedResponse['reference_no'] ?? null,
                        'response_code' => $parsedResponse['response_code'] ?? null,
                        'eazypay_tran_id' => $parsedResponse['eazypay_tran_id'] ?? null,
                    ]);

                    app(ErrorReporter::class)->captureException(
                        new \RuntimeException('ICICI EazyPay callback: invalid response signature'),
                        'payment',
                        [
                            'payment_id' => $payment->id,
                            'reference_no' => $parsedResponse['reference_no'] ?? null,
                            'response_code' => $parsedResponse['response_code'] ?? null,
                        ],
                        ErrorLog::SEVERITY_CRITICAL,
                    );
                }

                $this->settlement->recordPayload($payment, [
                    'payload' => ['callback' => $responseData, 'parsed' => $parsedResponse],
                ], 'unverified_callback');

                ['verdict' => $verdict] = $this->settlement->verifyAndSettle($payment, $gateway, 'callback_verification');

                return $this->redirectToFrontend(match ($verdict) {
                    'success' => [
                        'status' => 'success',
                        'message' => 'Payment completed successfully',
                        'payment_id' => $payment->id,
                        'application_id' => $payment->application_id,
                        'transaction_id' => $payment->fresh()?->gateway_payment_id,
                    ],
                    'failed' => [
                        'status' => 'failed',
                        'message' => 'Payment failed',
                        'payment_id' => $payment->id,
                    ],
                    default => [
                        'status' => 'pending',
                        'message' => 'We are confirming your payment with the bank. This page will show the final status shortly.',
                        'payment_id' => $payment->id,
                    ],
                });
            }

            // Update payment based on response
            if ($parsedResponse['success']) {
                $this->settlement->settleSuccess($payment, [
                    'gateway_payment_id' => $parsedResponse['eazypay_tran_id'],
                    'payment_method' => $parsedResponse['payment_mode'],
                    'gateway_fee' => $parsedResponse['processing_fee'],
                    'tax_amount' => $parsedResponse['service_tax'],
                    'collected_amount' => $parsedResponse['transaction_amount'] ?? null,
                    'payload' => ['callback' => $responseData, 'parsed' => $parsedResponse],
                ], 'callback');

                return $this->redirectToFrontend([
                    'status' => 'success',
                    'message' => 'Payment completed successfully',
                    'payment_id' => $payment->id,
                    'application_id' => $payment->application_id,
                    'transaction_id' => $parsedResponse['eazypay_tran_id'],
                ]);
            } else {
                // Payment failed
                $this->settlement->settleFailure($payment, [
                    'error_code' => $parsedResponse['response_code'] ?? null,
                    'failure_reason' => $parsedResponse['message'],
                    'payload' => ['callback' => $responseData, 'parsed' => $parsedResponse],
                ], 'callback');

                return $this->redirectToFrontend([
                    'status' => 'failed',
                    'message' => $parsedResponse['message'],
                    'payment_id' => $payment->id,
                    'response_code' => $parsedResponse['response_code'],
                ]);
            }
        } catch (\Exception $e) {
            Log::error('ICICI EazyPay callback error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            app(ErrorReporter::class)->captureException($e, 'payment', ['stage' => 'callback']);

            return $this->redirectToFrontend([
                'status' => 'error',
                'message' => 'Payment processing error',
            ]);
        }
    }

    /**
     * Process an ICICI EazyPay push notification.
     *
     * The push payload is decrypted but its HashVal is not keyed with a merchant
     * secret, so it cannot prove the verdict came from ICICI. A success or
     * failure push therefore only triggers a server-to-server status check, and
     * the payment is settled on what the gateway itself reports.
     */
    protected function processICICIWebhookEvent(Payment $payment, array $data, ICICIEazyPayAdapter $gateway): void
    {
        $event = $data['event'] ?? '';

        Log::info('Processing ICICI EazyPay webhook event', [
            'payment_id' => $payment->id,
            'event' => $event,
            'status' => $data['status'] ?? '',
        ]);

        // Keep the push on the row for reconciliation, whatever it claims.
        $this->settlement->recordPayload($payment, [
            'payload' => $data,
        ], $event === 'challan.generated' ? 'challan_notification' : 'push_notification');

        if (! in_array($event, ['payment.success', 'payment.failed'], true)) {
            Log::info('ICICI webhook event recorded without a verdict', [
                'payment_id' => $payment->id,
                'event' => $event,
            ]);

            return;
        }

        ['verdict' => $verdict] = $this->settlement->verifyAndSettle($payment, $gateway, 'push_verification');

        Log::info('ICICI webhook verdict re-verified with the gateway', [
            'payment_id' => $payment->id,
            'push_event' => $event,
            'gateway_verdict' => $verdict,
        ]);
    }

    /**
     * Redirect to frontend with query parameters.
     * Converts snake_case keys to camelCase for frontend consistency.
     */
    protected function redirectToFrontend(array $params): RedirectResponse
    {
        $frontendUrl = config('app.frontend_url', 'http://localhost:3000');
        $paymentCallbackPath = '/payment-callback';

        // Convert keys to camelCase for frontend consistency
        $camelCaseParams = [];
        foreach ($params as $key => $value) {
            $camelCaseParams[Str::camel($key)] = $value;
        }

        $redirectUrl = $frontendUrl.$paymentCallbackPath.'?'.http_build_query($camelCaseParams);

        return redirect()->away($redirectUrl);
    }
}
