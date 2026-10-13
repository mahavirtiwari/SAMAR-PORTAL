<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ErrorReporter;
use App\Http\Controllers\Controller;
use App\Models\ErrorLog;
use App\Models\Payment;
use App\Services\Payment\ICICIEazyPayAdapter;
use App\Services\Payment\PaymentGatewayFactory;
use App\Services\Payment\PaymentSettlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * @OA\Tag(
 *     name="Payment Webhooks",
 *     description="Payment gateway webhook endpoints for handling payment notifications"
 * )
 */
class PaymentWebhookController extends Controller
{
    public function __construct(
        private PaymentSettlementService $settlement
    ) {}

    /**
     * Handle ICICI EazyPay push notification webhook.
     *
     * @OA\Post(
     *     path="/api/v1/webhooks/payments/icici-eazypay",
     *     summary="Handle ICICI EazyPay webhook",
     *     description="Receives and processes real-time push notifications from ICICI EazyPay. This endpoint receives encrypted XML data which is decrypted and processed to update payment status. No authentication required as this is called by the payment gateway.",
     *     tags={"Payment Webhooks"},
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\MediaType(
     *             mediaType="text/plain",
     *
     *             @OA\Schema(type="string", description="Encrypted XML data from ICICI EazyPay")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Webhook processed successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Webhook processed successfully")
     *         )
     *     )
     * )
     */
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

            Log::info('ICICI EazyPay webhook parsed', [
                'event' => $parsedData['event'] ?? 'unknown',
                'payment_id' => $parsedData['payment_id'] ?? null,
                'status' => $parsedData['status'] ?? null,
                'response_code' => $parsedData['response_code'] ?? null,
                'amount' => $parsedData['amount'] ?? null,
                'parsed_data' => $parsedData,
            ]);

            // Verify signature if HashVal is present
            $hashVal = $parsedData['hash_value'] ?? '';
            $rawPayload = $parsedData['raw_payload'] ?? [];

            if ($hashVal && ! $gateway->verifyWebhookSignature($rawPayload, $hashVal)) {
                Log::warning('ICICI EazyPay invalid webhook signature', [
                    'hash_val' => $hashVal,
                ]);

                // Still return 200 to acknowledge receipt
                return $this->successResponse(null, 'Invalid webhook signature');
            }

            // Find payment by gateway_payment_id (TrnId) or gateway_order_id
            $payment = Payment::where('gateway_payment_id', $parsedData['payment_id'])
                ->orWhere('gateway_order_id', $parsedData['payment_id'])
                ->first();

            if (! $payment) {
                Log::warning('ICICI EazyPay payment not found for webhook', [
                    'payment_id' => $parsedData['payment_id'],
                ]);

                return $this->successResponse(null, 'Payment not found, webhook acknowledged');
            }

            // Process the webhook event
            $this->processICICIWebhookEvent($payment, $parsedData);

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
     *
     * @OA\Get(
     *     path="/api/v1/payments/icici-eazypay/callback",
     *     summary="Handle ICICI EazyPay return callback",
     *     description="Handles the return URL callback from ICICI EazyPay after payment completion. This endpoint validates the response signature and updates payment status.",
     *     tags={"Payment Webhooks"},
     *
     *     @OA\Parameter(name="Response Code", in="query", required=true, @OA\Schema(type="string"), description="E000 for success"),
     *     @OA\Parameter(name="Unique Ref Number", in="query", required=true, @OA\Schema(type="string"), description="EazyPay Transaction ID"),
     *     @OA\Parameter(name="Transaction Amount", in="query", required=true, @OA\Schema(type="string")),
     *     @OA\Parameter(name="Total Amount", in="query", required=true, @OA\Schema(type="string")),
     *     @OA\Parameter(name="Service Tax Amount", in="query", required=true, @OA\Schema(type="string")),
     *     @OA\Parameter(name="Processing Fee Amount", in="query", required=true, @OA\Schema(type="string")),
     *     @OA\Parameter(name="Payment Mode", in="query", required=true, @OA\Schema(type="string")),
     *     @OA\Parameter(name="ReferenceNo", in="query", required=true, @OA\Schema(type="string")),
     *     @OA\Parameter(name="SubMerchantId", in="query", required=true, @OA\Schema(type="string")),
     *     @OA\Parameter(name="ID", in="query", required=true, @OA\Schema(type="string"), description="Merchant EazyPay ID"),
     *     @OA\Parameter(name="RS", in="query", required=true, @OA\Schema(type="string"), description="SHA512 Signature"),
     *
     *     @OA\Response(
     *         response=302,
     *         description="Redirects to frontend with payment status"
     *     )
     * )
     */
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

            // Validate signature
            if (! $parsedResponse['valid']) {
                // error-level: a signature mismatch on an E000 callback means ICICI
                // collected money from the customer but our integration cannot prove
                // it. Needs immediate ops attention.
                Log::error('ICICI EazyPay callback - invalid signature', [
                    'payment_id' => $payment->id,
                    'reference_no' => $parsedResponse['reference_no'] ?? null,
                    'response_code' => $parsedResponse['response_code'] ?? null,
                    'eazypay_tran_id' => $parsedResponse['eazypay_tran_id'] ?? null,
                    'success_flag' => $parsedResponse['success'] ?? null,
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

                // Never downgrade an already-settled payment. If a prior push
                // notification already settled this row, the service records the
                // payload and leaves the status alone.
                $this->settlement->settleFailure($payment, [
                    'error_code' => 'INVALID_SIGNATURE',
                    'failure_reason' => 'Invalid response signature',
                    'payload' => ['callback' => $responseData, 'parsed' => $parsedResponse],
                ], 'callback');

                return $this->redirectToFrontend([
                    'status' => 'error',
                    'message' => 'Invalid payment signature',
                    'payment_id' => $payment->id,
                ]);
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
     * Generic webhook handler.
     */
    protected function handleWebhook(Request $request, string $gateway): JsonResponse
    {
        try {
            $payload = $request->all();
            $signature = $request->header('X-Webhook-Signature') ?? '';

            Log::info('Payment webhook received', [
                'gateway' => $gateway,
                'payload' => $payload,
            ]);

            // Get gateway adapter
            $gatewayAdapter = PaymentGatewayFactory::create($gateway);

            // Verify webhook signature
            if (! $gatewayAdapter->verifyWebhookSignature($payload, $signature)) {
                Log::warning('Invalid webhook signature', [
                    'gateway' => $gateway,
                    'signature' => $signature,
                ]);

                return $this->errorResponse('Invalid webhook signature', 401);
            }

            // Parse webhook payload
            $parsedData = $gatewayAdapter->parseWebhookPayload($payload);

            Log::info('Webhook parsed successfully', [
                'gateway' => $gateway,
                'event' => $parsedData['event'] ?? 'unknown',
                'payment_id' => $parsedData['payment_id'] ?? null,
            ]);

            // Find payment by gateway_payment_id or gateway_order_id
            $payment = Payment::where('gateway_payment_id', $parsedData['payment_id'])
                ->orWhere('gateway_order_id', $parsedData['order_id'])
                ->first();

            if (! $payment) {
                Log::warning('Payment not found for webhook', [
                    'gateway' => $gateway,
                    'payment_id' => $parsedData['payment_id'],
                    'order_id' => $parsedData['order_id'],
                ]);

                return $this->successResponse(null, 'Payment not found, webhook acknowledged');
            }

            // Update payment based on event
            $this->processWebhookEvent($payment, $parsedData);

            return $this->successResponse(null, 'Webhook processed successfully');
        } catch (\Exception $e) {
            Log::error('Webhook processing error', [
                'gateway' => $gateway,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return $this->serverErrorResponse($e, 'Webhook processing failed', 200);
        }
    }

    /**
     * Process ICICI EazyPay webhook event and update payment.
     */
    protected function processICICIWebhookEvent(Payment $payment, array $data): void
    {
        $event = $data['event'] ?? '';
        $status = $data['status'] ?? '';

        Log::info('Processing ICICI EazyPay webhook event', [
            'payment_id' => $payment->id,
            'event' => $event,
            'status' => $status,
        ]);

        switch ($event) {
            case 'payment.success':
                $this->settlement->settleSuccess($payment, [
                    'gateway_payment_id' => $data['payment_id'],
                    'payment_method' => $data['payment_mode'],
                    'gateway_fee' => $data['processing_fee'],
                    'tax_amount' => $data['tax'],
                    'collected_amount' => $data['amount'] ?? null,
                    'payload' => $data,
                ], 'push_notification');
                break;

            case 'challan.generated':
                // Offline payment challan generated, keep as pending
                $this->settlement->recordPayload($payment, [
                    'gateway_payment_id' => $data['payment_id'],
                    'payload' => $data,
                ], 'challan_notification');

                Log::info('ICICI challan generated notification received', [
                    'payment_id' => $payment->id,
                ]);
                break;

            case 'payment.failed':
                $this->settlement->settleFailure($payment, [
                    'failure_reason' => $data['remarks'] ?? 'Payment failed',
                    'payload' => $data,
                ], 'push_notification');
                break;

            default:
                Log::info('Unhandled ICICI webhook event', [
                    'payment_id' => $payment->id,
                    'event' => $event,
                ]);
        }
    }

    /**
     * Process generic webhook event and update payment.
     */
    protected function processWebhookEvent(Payment $payment, array $data): void
    {
        $event = $data['event'] ?? '';

        Log::info('Processing webhook event', [
            'payment_id' => $payment->id,
            'event' => $event,
            'status' => $data['status'] ?? 'unknown',
        ]);

        switch ($event) {
            case 'payment.success':
            case 'payment.captured':
                if ($data['status'] === 'success') {
                    $this->settlement->settleSuccess($payment, [
                        'gateway_payment_id' => $data['payment_id'],
                        'collected_amount' => $data['amount'] ?? null,
                        'payload' => $data,
                    ], 'webhook');
                } else {
                    $this->settlement->recordPayload($payment, [
                        'gateway_payment_id' => $data['payment_id'],
                        'payload' => $data,
                    ], 'webhook');
                }
                break;

            case 'payment.failed':
                $this->settlement->settleFailure($payment, [
                    'failure_reason' => $data['raw_payload']['error_description'] ?? 'Payment failed',
                    'payload' => $data,
                ], 'webhook');
                break;

            default:
                Log::info('Unhandled webhook event', [
                    'payment_id' => $payment->id,
                    'event' => $event,
                ]);
        }
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
