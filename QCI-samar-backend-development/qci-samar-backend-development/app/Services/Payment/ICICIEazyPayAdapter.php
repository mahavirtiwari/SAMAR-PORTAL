<?php

namespace App\Services\Payment;

use App\Contracts\PaymentGatewayInterface;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * ICICI EazyPay Payment Gateway Adapter
 *
 * Implements ICICI Bank EazyPay payment gateway integration supporting:
 * - Net Banking (ICICI & Other Banks)
 * - Credit Card
 * - Debit Card
 * - UPI
 *
 * @see EazyPay_and_PG_Merchant_Integration_v4.3.pdf
 */
class ICICIEazyPayAdapter implements PaymentGatewayInterface
{
    /**
     * EazyPay Merchant ID (6 digit ICID)
     */
    protected string $merchantId;

    /**
     * AES Encryption Key (16 characters)
     */
    protected string $encryptionKey;

    /**
     * Return URL after payment completion
     */
    protected string $returnUrl;

    /**
     * Sub Merchant ID (for internal differentiation)
     */
    protected string $subMerchantId;

    /**
     * EazyPay Base URL
     */
    protected string $baseUrl;

    /**
     * EazyPay Verify URL
     */
    protected string $verifyUrl;

    /**
     * Payment mode constants
     */
    public const PAYMODE_CASH = '0';

    public const PAYMODE_CHEQUE = '1';

    public const PAYMODE_NEFT_RTGS = '2';

    public const PAYMODE_NET_BANKING = '3';

    public const PAYMODE_DEBIT_CARD = '4';

    public const PAYMODE_CREDIT_CARD = '5';

    public const PAYMODE_UPI = '6';

    public const PAYMODE_NON_ICICI_DEBIT = '8';

    public const PAYMODE_ALL = '9';

    /**
     * Response code for success
     */
    public const RESPONSE_SUCCESS = 'E000';

    public function __construct()
    {
        $this->merchantId = config('services.icici_eazypay.merchant_id');
        $this->encryptionKey = config('services.icici_eazypay.encryption_key');
        $this->returnUrl = config('services.icici_eazypay.return_url');
        $this->subMerchantId = config('services.icici_eazypay.sub_merchant_id', '1');

        // URLs from environment config
        $this->baseUrl = config('services.icici_eazypay.base_url');
        $this->verifyUrl = config('services.icici_eazypay.verify_url');
    }

    /**
     * Initialize a payment transaction.
     *
     * ICICI EazyPay Bill Desk Format (SAMAR Portal):
     * Mandatory Fields (20 fields, pipe-separated):
     * 1. REFERENCE NO - Unique payment reference
     * 2. SUB MERCHANT ID - Sub-merchant identifier
     * 3. PG AMOUNT - Transaction amount
     * 4. UTR Number - Unique Transaction Reference
     * 5. Organisation Email ID - Email address
     * 6. Organisation Mobile Number - Mobile number
     * 7. PAN - PAN card number
     * 8. TAN - TAN number
     * 9. GSTIN - GST identification number
     * 10. Unit Address - Address line
     * 11. District - District name
     * 12. Unit Pin Code - PIN code
     * 13. Unit State - State name
     * 14. Country - Country name
     * 15. SAMAR Certification Fee - Fee description
     * 16. Unit Contact Person Name - Contact person
     * 17. Payment Date - Date in dd/MMM/yyyy format
     *
     * Optional Fields (1 field):
     * 1. Address 1 - Additional address line
     */
    public function initiatePayment(array $data): array
    {
        $referenceNo = $data['order_id'] ?? 'REF'.time().rand(1000, 9999);
        $amount = number_format((float) $data['amount'], 2, '.', '');
        $paymode = $data['paymode'] ?? self::PAYMODE_ALL;

        // Sanitize mobile number - ICICI requires exactly 10 digits
        $mobileNumber = preg_replace('/[^0-9]/', '', $data['customer_mobile'] ?? '');
        // Remove country code if present (e.g., 91)
        if (strlen($mobileNumber) > 10 && substr($mobileNumber, 0, 2) === '91') {
            $mobileNumber = substr($mobileNumber, 2);
        }
        // Ensure exactly 10 digits
        $mobileNumber = substr($mobileNumber, -10);

        // Build mandatory fields (pipe separated as per ICICI SAMAR bill desk format).
        // Every user-supplied segment is run through sanitizeField() — embedded newlines,
        // tabs, or literal pipes inside a value break ICICI's parser and produce E00314
        // "Mandatory value String in wrong format".
        // Format: RefNo|SubMerchantId|Amount|UTR|Email|Mobile|PAN|TAN|GSTIN|Address|District|PinCode|State|Country|FeeDesc|ContactName|PaymentDate
        $mandatoryFields = implode('|', [
            $referenceNo,                                                              // 1. REFERENCE NO
            $this->subMerchantId,                                                      // 2. SUB MERCHANT ID
            $amount,                                                                   // 3. PG AMOUNT
            $data['utr_number'] ?? $referenceNo,                                       // 4. UTR Number
            self::sanitizeField($data['customer_email'] ?? '', 100),                   // 5. Organisation Email ID
            $mobileNumber,                                                             // 6. Organisation Mobile Number (10 digits)
            self::sanitizeField($data['pan'] ?? '', 10),                               // 7. PAN
            self::sanitizeField($data['tan'] ?? '', 10),                               // 8. TAN
            self::sanitizeField($data['gstin'] ?? '', 15),                             // 9. GSTIN
            self::sanitizeField($data['unit_address'] ?? '', 80),                      // 10. Unit Address
            self::sanitizeField($data['district'] ?? '', 50),                          // 11. District
            self::sanitizeField($data['pin_code'] ?? '', 10),                          // 12. Unit Pin Code
            self::sanitizeField($data['state'] ?? '', 50),                             // 13. Unit State
            self::sanitizeField($data['country'] ?? 'India', 50),                      // 14. Country
            self::sanitizeField($data['fee_description'] ?? 'SAMAR Certification Fee', 80), // 15. SAMAR Certification Fee
            self::sanitizeField($data['contact_person_name'] ?? '', 50),               // 16. Unit Contact Person Name
            $data['payment_date'] ?? date('d/M/Y'),                                    // 17. Payment Date (dd/MMM/yyyy)
        ]);

        // Optional fields (Address 1) — same sanitization rules apply.
        $optionalFields = self::sanitizeField($data['address_line_2'] ?? '', 100);

        // Determine return URL
        $returnUrl = $data['return_url'] ?? $this->returnUrl;

        // Build parameters to encrypt
        $params = [
            'mandatory fields' => $mandatoryFields,
            'optional fields' => $optionalFields ?: ' ',
            'returnurl' => $returnUrl,
            'Reference No' => $referenceNo,
            'submerchantid' => $this->subMerchantId,
            'transaction amount' => $amount,
            'paymode' => $paymode,
        ];

        // Encrypt parameters
        $encryptedParams = [];
        foreach ($params as $key => $value) {
            $encryptedParams[$key] = $this->encrypt($value);
        }

        // Build payment URL
        $paymentUrl = $this->baseUrl.'?'.http_build_query([
            'merchantid' => $this->merchantId,
            'mandatory fields' => $encryptedParams['mandatory fields'],
            'optional fields' => $encryptedParams['optional fields'],
            'returnurl' => $encryptedParams['returnurl'],
            'Reference No' => $encryptedParams['Reference No'],
            'submerchantid' => $encryptedParams['submerchantid'],
            'transaction amount' => $encryptedParams['transaction amount'],
            'paymode' => $encryptedParams['paymode'],
        ]);

        // Metadata only — mandatory_fields_plain and mobile_number leak customer email,
        // PAN, TAN, GSTIN, address; payment_url_encrypted and key metadata aid forgery.
        Log::info('ICICI EazyPay payment URL generated', [
            'base_url' => $this->baseUrl,
            'merchant_id' => $this->merchantId,
            'sub_merchant_id' => $this->subMerchantId,
            'reference_no' => $referenceNo,
            'amount' => $amount,
            'payment_url_length' => strlen($paymentUrl),
        ]);

        return [
            'success' => true,
            'gateway' => 'icici_eazypay',
            'gateway_order_id' => $referenceNo,
            'amount' => $data['amount'],
            'currency' => $data['currency'] ?? 'INR',
            'payment_url' => $paymentUrl,
            'reference_no' => $referenceNo,
            'redirect_method' => 'GET', // Simple redirect - React frontend just uses window.location.href
        ];
    }

    /**
     * Verify payment status using EazyPay Verify URL.
     *
     * @param  string  $paymentId  EazyPay Transaction ID or Reference No
     * @param  array  $data  Additional verification data
     */
    public function verifyPayment(string $paymentId, array $data = []): array
    {
        try {
            // Build verify URL parameters
            $params = [
                'ezpaytranid' => $data['eazypay_tran_id'] ?? '',
                'amount' => $data['amount'] ?? '',
                'paymentmode' => $data['payment_mode'] ?? '',
                'merchantid' => $this->merchantId,
                'trandate' => $data['tran_date'] ?? '',
                'pgreferenceno' => $data['reference_no'] ?? $paymentId,
            ];

            // Option to get simplified success status (PDF Page 47)
            // When dstatus=Y, RIP/SIP statuses are shown as "Success" (subject to realization)
            if (! empty($data['skip_settlement_status'])) {
                $params['dstatus'] = 'Y';
            }

            // Log verification request
            Log::info('ICICI EazyPay verification request', [
                'verify_url' => $this->verifyUrl,
                'payment_id' => $paymentId,
                'request_params' => $params,
            ]);

            $response = Http::timeout(30)->get($this->verifyUrl, $params);

            // Log raw response
            Log::info('ICICI EazyPay verification response', [
                'payment_id' => $paymentId,
                'http_status' => $response->status(),
                'response_body_raw' => $response->body(),
            ]);

            if (! $response->successful()) {
                Log::warning('ICICI EazyPay verification failed - HTTP error', [
                    'payment_id' => $paymentId,
                    'http_status' => $response->status(),
                ]);

                return [
                    'success' => false,
                    'verified' => false,
                    'message' => 'Failed to verify payment with gateway',
                ];
            }

            // Parse response (format: key=value&key=value)
            $responseBody = $response->body();
            parse_str($responseBody, $parsedResponse);

            $status = $parsedResponse['status'] ?? '';
            $isSuccess = in_array($status, ['Success', 'RIP', 'SIP']);

            $result = [
                'success' => true,
                'verified' => $isSuccess,
                'payment_id' => $paymentId,
                'eazypay_tran_id' => $parsedResponse['ezpaytranid'] ?? null,
                'amount' => $parsedResponse['amount'] ?? null,
                'base_amount' => $parsedResponse['BA'] ?? null,
                'processing_fee' => $parsedResponse['PF'] ?? null,
                'tax' => $parsedResponse['TAX'] ?? null,
                'status' => $this->mapStatus($status),
                'raw_status' => $status,
                'transaction_date' => $parsedResponse['trandate'] ?? null,
                'settlement_date' => $parsedResponse['sdt'] ?? null,
                // Mapped to our payment_method enum, exactly as the return callback
                // does. Handing back ICICI's own code here would mean a caller that
                // stores it writes a value the column cannot hold.
                'payment_mode' => $this->mapPaymentMode($parsedResponse['PaymentMode'] ?? null),
                'raw_payment_mode' => $parsedResponse['PaymentMode'] ?? null,
                'reference_no' => $parsedResponse['pgreferenceno'] ?? null,
                'message' => $this->getStatusMessage($status),
            ];

            // Log parsed verification result
            Log::info('ICICI EazyPay verification completed', [
                'payment_id' => $paymentId,
                'verified' => $isSuccess,
                'status' => $status,
                'parsed_response' => $parsedResponse,
                'result' => $result,
            ]);

            return $result;
        } catch (\Exception $e) {
            Log::error('ICICI EazyPay verification error', [
                'payment_id' => $paymentId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'verified' => false,
                'message' => 'Payment verification failed: '.$e->getMessage(),
            ];
        }
    }

    /**
     * Verify webhook signature using SHA512.
     *
     * Note: as implemented, the hash input is payload fields plus a date with no
     * merchant secret, so a match does not prove the push came from ICICI.
     * PaymentWebhookController therefore treats this as a diagnostic only and
     * re-verifies every push verdict with the gateway before settling.
     */
    public function verifyWebhookSignature(array $payload, string $signature, ?string $secret = null): bool
    {
        // ICICI sends HashVal in the XML payload for push notifications
        if (empty($signature)) {
            return false;
        }

        // Build the signature string as per ICICI spec
        // IcId|TrnId|PayMode|TrnDate|SettleDT|Status|InitiateDT|TranAmt|BaseAmt|ProcFees|STax|
        // M_SGST|M_CGST|M_UTGST|M_STCESS|M_CTCESS|M_IGST|GSTState|BillingState|yyyyddmm
        $signatureString = implode('|', [
            $payload['IcId'] ?? '',
            $payload['TrnId'] ?? '',
            $payload['PayMode'] ?? '',
            $payload['TrnDate'] ?? '',
            $payload['SettleDT'] ?? '',
            $payload['Status'] ?? '',
            $payload['InitiateDT'] ?? '',
            $payload['TranAmt'] ?? '',
            $payload['BaseAmt'] ?? '',
            $payload['ProcFees'] ?? '',
            $payload['STax'] ?? '',
            $payload['M_SGST'] ?? '',
            $payload['M_CGST'] ?? '',
            $payload['M_UTGST'] ?? '',
            $payload['M_STCESS'] ?? '',
            $payload['M_CTCESS'] ?? '',
            $payload['M_IGST'] ?? '',
            $payload['GSTState'] ?? '',
            $payload['BillingState'] ?? '',
            $this->extractWebhookSignatureDate($payload),
        ]);

        $expectedSignature = hash('sha512', $signatureString);

        return hash_equals($expectedSignature, $signature);
    }

    /**
     * Parse webhook payload from ICICI EazyPay push notification.
     */
    public function parseWebhookPayload(array $payload): array
    {
        // ICICI sends encrypted XML which needs to be decrypted first
        // Check if payload is encrypted
        if (isset($payload['encrypted_data'])) {
            $decryptedXml = $this->decrypt($payload['encrypted_data']);
            $payload = $this->parseXmlToArray($decryptedXml);
        }

        $status = $payload['Status'] ?? '';
        $responseCode = $payload['ResponseCode'] ?? '';

        return [
            'event' => $this->mapResponseCodeToEvent($responseCode),
            'payment_id' => $payload['TrnId'] ?? null,
            'order_id' => $payload['TrnId'] ?? null,
            'reference_no' => null, // Not directly available in push
            'merchant_id' => $payload['IcId'] ?? null,
            'amount' => isset($payload['TranAmt']) ? (float) $payload['TranAmt'] : null,
            'base_amount' => isset($payload['BaseAmt']) ? (float) $payload['BaseAmt'] : null,
            'processing_fee' => isset($payload['ProcFees']) ? (float) $payload['ProcFees'] : null,
            'tax' => isset($payload['STax']) ? (float) $payload['STax'] : null,
            'currency' => 'INR',
            'status' => $this->mapStatus($status),
            'raw_status' => $status,
            'response_code' => $responseCode,
            'payment_mode' => $payload['PayMode'] ?? null,
            'transaction_date' => $payload['TrnDate'] ?? null,
            'settlement_date' => $payload['SettleDT'] ?? null,
            'initiated_date' => $payload['InitiateDT'] ?? null,
            'remarks' => $payload['Remarks'] ?? null,
            'hash_value' => $payload['HashVal'] ?? null,
            'raw_payload' => $payload,
        ];
    }

    /**
     * Get payment status from gateway using Verify URL.
     */
    public function getPaymentStatus(string $paymentId): string
    {
        $result = $this->verifyPayment($paymentId, ['reference_no' => $paymentId]);

        return $result['status'] ?? 'pending';
    }

    /**
     * Get gateway name.
     */
    public function getGatewayName(): string
    {
        return 'icici_eazypay';
    }

    /**
     * Parse response from return URL callback.
     *
     * @param  array  $response  Response parameters from return URL
     * @return array Parsed and validated response
     */
    public function parseReturnResponse(array $response): array
    {
        // Keys only: the callback echoes customer details (PII) back to us.
        \Log::info('ICICI parseReturnResponse raw', ['keys' => array_keys($response)]);

        // Normalize response keys: ICICI sends keys with spaces like "Response Code"
        // but PHP/Laravel may convert spaces to underscores or other formats
        $normalizedResponse = $this->normalizeResponseKeys($response);

        \Log::info('ICICI parseReturnResponse normalized', ['keys' => array_keys($normalizedResponse)]);

        // Helper to get value with fallback for different key formats
        $getValue = function ($key, $default = null) use ($normalizedResponse) {
            // Try space-separated (ICICI standard), underscore, and camelCase
            $variations = [
                $key,
                str_replace(' ', '_', $key),
                lcfirst(str_replace(' ', '', $key)),
            ];
            foreach ($variations as $k) {
                if (isset($normalizedResponse[$k])) {
                    return $normalizedResponse[$k];
                }
            }

            return $default;
        };

        $responseCode = $getValue('Response Code', '') ?: ($normalizedResponse['ResponseCode'] ?? '');
        $isSuccess = $responseCode === self::RESPONSE_SUCCESS;

        // Validate RS (SHA512 signature, keyed with the merchant AES key). Only a
        // valid signature proves the verdict came from ICICI. The return URL is
        // public, so an unsigned or mis-signed callback — success or failure —
        // is never acted on directly; the caller re-verifies it with the gateway.
        $signatureValid = $this->validateResponseSignature($normalizedResponse);

        if (! $signatureValid) {
            \Log::info('ICICI return callback signature did not verify', [
                'response_code' => $responseCode,
                'message' => $this->getErrorMessage($responseCode),
            ]);
        }

        return [
            'valid' => $signatureValid,
            'success' => $isSuccess,
            'response_code' => $responseCode,
            'eazypay_tran_id' => $getValue('Unique Ref Number'),
            'merchant_id' => $getValue('ID'),
            'reference_no' => $getValue('ReferenceNo'),
            'sub_merchant_id' => $getValue('SubMerchantId'),
            'transaction_amount' => $getValue('Transaction Amount'),
            'total_amount' => $getValue('Total Amount'),
            'service_tax' => $getValue('Service Tax Amount'),
            'processing_fee' => $getValue('Processing Fee Amount'),
            'payment_mode' => $this->mapPaymentMode($getValue('Payment Mode')),
            'transaction_date' => $getValue('Transaction Date'),
            'interchange_value' => $getValue('Interchange Value'),
            'tdr' => $getValue('TDR'),
            'tps' => $getValue('TPS'), // Third Party Status
            'message' => $this->getErrorMessage($responseCode),
        ];
    }

    /**
     * Normalize response keys to handle ICICI's space-separated key format.
     *
     * ICICI EazyPay sends parameters with spaces like "Response Code", "Unique Ref Number".
     * However, PHP/web servers may transform these keys:
     * - Some convert spaces to underscores
     * - Some URL-decode %20 to spaces
     * - Some preserve the original format
     *
     * This method creates a normalized array where keys with underscores
     * are also accessible via space-separated versions, and vice versa.
     *
     * @param  array  $response  Raw response from ICICI callback
     * @return array Normalized response with both key formats
     */
    protected function normalizeResponseKeys(array $response): array
    {
        $normalized = [];

        foreach ($response as $key => $value) {
            // Keep original key
            $normalized[$key] = $value;

            // If key contains underscore, also add space version
            if (str_contains($key, '_')) {
                $spaceKey = str_replace('_', ' ', $key);
                if (! isset($normalized[$spaceKey])) {
                    $normalized[$spaceKey] = $value;
                }
            }

            // If key contains space, also add underscore version
            if (str_contains($key, ' ')) {
                $underscoreKey = str_replace(' ', '_', $key);
                if (! isset($normalized[$underscoreKey])) {
                    $normalized[$underscoreKey] = $value;
                }
            }
        }

        return $normalized;
    }

    /**
     * Validate response signature (RS parameter).
     */
    protected function validateResponseSignature(array $response): bool
    {
        $rs = $response['RS'] ?? '';
        if (empty($rs)) {
            \Log::warning('ICICI signature validation: RS is empty', ['response_keys' => array_keys($response)]);

            return false;
        }

        // Helper to get value with fallback for different key formats
        $getValue = function ($key) use ($response) {
            // Try space-separated (ICICI standard), underscore, and camelCase
            $variations = [
                $key,
                str_replace(' ', '_', $key),
                lcfirst(str_replace(' ', '', $key)),
            ];
            foreach ($variations as $k) {
                // Use array_key_exists to also catch null values
                if (array_key_exists($k, $response)) {
                    $value = $response[$k];
                    // Only coerce real PHP null to empty. The literal string "null"
                    // (which ICICI sends for fields like TPS on UPI) is a hash-input
                    // token and must be preserved verbatim, otherwise the recomputed
                    // RS diverges and every UPI E000 callback fails verification.
                    if ($value === null) {
                        return '';
                    }

                    return (string) $value;
                }
            }

            return '';
        };

        // Build signature string as per ICICI spec
        // ID|Response Code|Unique Ref Number|Service Tax Amount|Processing Fee Amount|
        // Total Amount|Transaction Amount|Transaction Date|Interchange Value|TDR|
        // Payment Mode|SubMerchantId|ReferenceNo|TPS|aes_key
        $signatureFields = [
            'ID' => $getValue('ID'),
            'Response Code' => $getValue('Response Code'),
            'Unique Ref Number' => $getValue('Unique Ref Number'),
            'Service Tax Amount' => $getValue('Service Tax Amount'),
            'Processing Fee Amount' => $getValue('Processing Fee Amount'),
            'Total Amount' => $getValue('Total Amount'),
            'Transaction Amount' => $getValue('Transaction Amount'),
            'Transaction Date' => $getValue('Transaction Date'),
            'Interchange Value' => $getValue('Interchange Value'),
            'TDR' => $getValue('TDR'),
            'Payment Mode' => $getValue('Payment Mode'),
            'SubMerchantId' => $getValue('SubMerchantId'),
            'ReferenceNo' => $getValue('ReferenceNo'),
            'TPS' => $getValue('TPS'),
        ];

        $signatureString = implode('|', array_values($signatureFields)).'|'.$this->encryptionKey;

        $expectedSignature = hash('sha512', $signatureString);

        $match = hash_equals($expectedSignature, $rs);

        // Never log the raw signature_string — its trailing segment is the AES merchant secret.
        \Log::info('ICICI signature validation', [
            'fields' => $signatureFields,
            'expected_prefix' => substr($expectedSignature, 0, 12),
            'received_prefix' => substr($rs, 0, 12),
            'match' => $match,
            'rsv_present' => ! empty($response['RSV']),
            'encryption_key_length' => strlen($this->encryptionKey),
        ]);

        return $match;
    }

    /**
     * Map ICICI payment mode to our standard payment method enum.
     *
     * ICICI EazyPay online payment modes (from documentation v4.3, Section 5.4):
     * - NET_BANKING_ICICI (ICICI Bank netbanking)
     * - NET_BANKING (Other banks netbanking)
     * - DEBIT_CARD
     * - CREDIT_CARD
     * - UPI_ICICI
     *
     * Note: Offline modes (CASH, CHEQUE, NEFT_RTGS) don't come via callback -
     * they generate challans and are notified via Push Service (Section 6).
     *
     * @param  string|null  $iciciMode  ICICI payment mode
     * @return string|null Mapped payment method (card, netbanking, upi, wallet, emi, other)
     */
    protected function mapPaymentMode(?string $iciciMode): ?string
    {
        if (empty($iciciMode)) {
            return null;
        }

        // Map ICICI payment modes to our database enum values
        // DB enum: 'card', 'netbanking', 'upi', 'wallet', 'emi', 'other'
        $mapping = [
            // Netbanking modes (Section 5.4)
            'NET_BANKING' => 'netbanking',       // Other banks
            'NET_BANKING_ICICI' => 'netbanking', // ICICI Bank

            // Card modes (Section 5.4)
            'DEBIT_CARD' => 'card',
            'CREDIT_CARD' => 'card',

            // UPI mode (Section 5.4)
            'UPI_ICICI' => 'upi',
        ];

        $normalized = strtoupper(trim($iciciMode));

        return $mapping[$normalized] ?? 'other';
    }

    /**
     * Sanitize a value for inclusion in the pipe-delimited mandatoryFields string.
     *
     * ICICI EazyPay rejects the payload with E00314 ("Mandatory value String in
     * wrong format") when a field contains its own pipe delimiter or any control
     * character (newline, CR, tab, NUL). Real users have pasted multi-line
     * addresses from PDFs into unit_address, embedding \r\n and breaking the
     * payload. We strip those characters here at the gateway boundary; the DB
     * value stays untouched so emails/certificates still show the user's text.
     *
     * Also collapses internal whitespace, trims, and enforces a per-field byte
     * cap to keep the encrypted URL within ICICI's accepted length.
     */
    public static function sanitizeField(?string $value, int $maxLen): string
    {
        if ($value === null || $value === '') {
            return '';
        }
        $clean = preg_replace('/[\x00-\x1F\x7F|]/u', ' ', $value);
        $clean = preg_replace('/\s+/u', ' ', $clean);
        $clean = trim($clean);
        if (mb_strlen($clean) > $maxLen) {
            $clean = mb_substr($clean, 0, $maxLen);
            // When the cut lands inside a word, snap back to the last whitespace so
            // we don't send "...Gautam Buddha" or "...Uttar Pradesh -" — incomplete
            // tokens have been observed to trip ICICI's String-format validation.
            $snapped = preg_replace('/\s\S*$/u', '', $clean);
            if ($snapped !== null && $snapped !== '') {
                $clean = $snapped;
            }
            $clean = rtrim($clean, ' ,.-/');
        }

        return $clean;
    }

    /**
     * AES-128-ECB Encryption with PKCS5 padding.
     *
     * @return string Base64 encoded encrypted string
     */
    protected function encrypt(string $data): string
    {
        $cipher = 'AES-128-ECB';
        $encrypted = openssl_encrypt($data, $cipher, $this->encryptionKey, OPENSSL_RAW_DATA);

        return base64_encode($encrypted);
    }

    /**
     * AES-128-ECB Decryption.
     *
     * @param  string  $encryptedData  Base64 encoded encrypted string
     * @return string Decrypted string
     */
    protected function decrypt(string $encryptedData): string
    {
        $cipher = 'AES-128-ECB';
        $decoded = base64_decode($encryptedData);

        return openssl_decrypt($decoded, $cipher, $this->encryptionKey, OPENSSL_RAW_DATA);
    }

    /**
     * Parse XML string to array.
     */
    protected function parseXmlToArray(string $xml): array
    {
        // Remove XML tags and parse
        $xml = preg_replace('/^<XML>|<\/XML>$/i', '', trim($xml));
        $parsed = [];

        preg_match_all('/<(\w+)>([^<]*)<\/\1>/', $xml, $matches, PREG_SET_ORDER);

        foreach ($matches as $match) {
            $parsed[$match[1]] = $match[2];
        }

        return $parsed;
    }

    /**
     * Map ICICI status to normalized status.
     */
    protected function mapStatus(string $status): string
    {
        return match (strtoupper($status)) {
            'SUCCESS', 'RIP', 'SIP' => 'success',
            'CHALLAN GENERATED', 'CHEQUE CHALLAN GENERATED', 'NEFT CHALLAN GENERATED', 'WIRE CHALLAN GENERATED' => 'pending',
            'TRANSACTION INITIATED' => 'initiated',
            'CHEQUE/DD IN CLEARANCE' => 'processing',
            'FAILED', 'TIMEOUT', 'TRANSACTION EXPIRED', 'CHEQUE/DD RETURNED' => 'failed',
            default => 'pending',
        };
    }

    /**
     * Map response code to event type.
     */
    protected function mapResponseCodeToEvent(string $responseCode): string
    {
        return match ($responseCode) {
            'E000' => 'payment.success',
            'E00327', 'E00328', 'E00329', 'E00336' => 'challan.generated',
            'E00331' => 'upi.initiated',
            'E007', 'E008' => 'payment.failed',
            default => 'payment.unknown',
        };
    }

    /**
     * Get status message.
     */
    protected function getStatusMessage(string $status): string
    {
        return match (strtoupper($status)) {
            'SUCCESS' => 'Payment completed successfully',
            'RIP' => 'Reconciliation in Progress',
            'SIP' => 'Settlement in Progress',
            'CHALLAN GENERATED' => 'Challan generated, awaiting payment',
            'TRANSACTION INITIATED' => 'Transaction initiated, awaiting completion',
            'CHEQUE/DD IN CLEARANCE' => 'Cheque/DD in clearance, awaiting confirmation',
            'CHEQUE/DD RETURNED' => 'Cheque/DD returned by bank',
            'FAILED' => 'Transaction failed',
            'TIMEOUT' => 'Transaction timed out',
            'TRANSACTION EXPIRED' => 'Transaction expired',
            default => 'Unknown status: '.$status,
        };
    }

    /**
     * Get error message for response code.
     */
    protected function getErrorMessage(string $code): string
    {
        $messages = [
            'E000' => 'Transaction successful',
            'E001' => 'Unauthorized Payment Mode',
            'E002' => 'Unauthorized Key',
            'E003' => 'Unauthorized Packet',
            'E004' => 'Unauthorized Merchant',
            'E005' => 'Unauthorized Return URL',
            'E006' => 'Transaction is already paid',
            'E007' => 'Transaction Failed',
            'E008' => 'Failure from Third Party due to Technical Error',
            'E009' => 'Bill Already Expired',
            'E0031' => 'Mandatory fields coming from merchant are empty',
            'E0032' => 'Mandatory fields coming from database are empty',
            'E0033' => 'Payment mode coming from merchant is empty',
            'E0034' => 'PG Reference number coming from merchant is empty',
            'E0035' => 'Sub merchant id coming from merchant is empty',
            'E0036' => 'Transaction amount coming from merchant is empty',
            'E0037' => 'Payment mode coming from merchant is other than 0 to 9',
            'E0038' => 'Transaction amount coming from merchant is more than 9 digit length',
            'E0039' => 'Mandatory value Email in wrong format',
            'E00310' => 'Mandatory value mobile number in wrong format',
            'E00311' => 'Mandatory value amount in wrong format',
            'E00312' => 'Mandatory value Pan card in wrong format',
            'E00313' => 'Mandatory value Date in wrong format',
            'E00314' => 'Mandatory value String in wrong format',
            'E00315' => 'Optional value Email in wrong format',
            'E00316' => 'Optional value mobile number in wrong format',
            'E00317' => 'Optional value amount in wrong format',
            'E00318' => 'Optional value pan card number in wrong format',
            'E00319' => 'Optional value date in wrong format',
            'E00320' => 'Optional value string in wrong format',
            'E00321' => 'Request packet mandatory/optional columns mismatch',
            'E00322' => 'Reference Number Blank',
            'E00323' => 'Mandatory Columns are Blank',
            'E00324' => 'Merchant Reference Number and Mandatory Columns are Blank',
            'E00325' => 'Merchant Reference Number Duplicate',
            'E00326' => 'Sub merchant id coming from merchant is non numeric',
            'E00327' => 'Cash Challan Generated',
            'E00328' => 'Cheque Challan Generated',
            'E00329' => 'NEFT Challan Generated',
            'E00331' => 'UPI Transaction Initiated - Please Accept or Reject',
            'E00332' => 'Challan Already Generated',
            'E00333' => 'Invalid Referer',
            'E00335' => 'Transaction Cancelled By User',
            'E00336' => 'WIRE Challan Generated',
            'E00337' => 'Net Banking ICICI Transaction Pending for Checker Approval',
            // Card/UPI specific error codes (E08xx series from PDF Page 16-19)
            'E0801' => 'FAIL',
            'E0802' => 'User Dropped',
            'E0803' => 'Canceled by user',
            'E0804' => 'Card brand not supported',
            'E0805' => 'Card function not supported',
            'E0806' => 'Exceeds withdrawal amount limit',
            'E0807' => 'Issuer Authentication Server failure',
            'E0808' => 'Session expiry / Card BIN not present',
            'E0809' => 'Reversed / Expired Card',
            'E0810' => 'Unable to Authorize',
            'E0811' => 'Invalid Response Code from Issuer',
            'E0812' => 'Do not honor',
            'E0813' => 'Invalid transaction',
            'E0814' => 'Amount mismatch',
            'E0815' => 'Not sufficient funds',
            'E0816' => 'Card number mismatch',
            'E0817' => 'General Error',
            'E0818' => 'Suspected fraud',
            'E0819' => 'User Inactive',
            'E0820' => 'ECI 1/6 Error for Cards',
            'E0821' => 'ECI 7 for Cards',
            'E0822' => 'System error - Could not process transaction',
            'E0825' => 'Transaction not permitted to cardholder',
            'E0826' => 'Rupay timeout from issuing bank',
            'E0828' => 'E-commerce decline',
            'E0830' => 'Issuer or switch is inoperative',
            'E0831' => 'Exceeds withdrawal frequency limit',
            'E0832' => 'Restricted card',
            'E0833' => 'Lost card',
            'E0849' => 'Stolen card',
            'E0850' => 'Transaction timed out, please retry',
            'E0857' => 'Allowable number of PIN tries exceeded',
            'E0858' => 'No such issuer',
            'E0861' => 'Cardholder did not return from ACS',
        ];

        return $messages[$code] ?? "Unknown error code: {$code}";
    }

    /**
     * Generate SHA512 signature.
     */
    public function generateSignature(string $data): string
    {
        return hash('sha512', $data);
    }

    /**
     * Resolve the date component used in ICICI EazyPay webhook signature verification.
     *
     * ICICI signs the HashVal on their server using the day the transaction was initiated.
     * Verifying with `date('Ymd')` on our side breaks across midnight boundaries: a webhook
     * signed at 23:55 IST and processed at 00:05 IST rejects valid notifications. Prefer the
     * date carried in the payload (TrnDate or InitiateDT) and fall back to the current date
     * only when neither is parseable.
     *
     * @param  array  $payload  Decrypted webhook payload as parsed by parseWebhookPayload().
     * @return string Date formatted as Ymd.
     */
    protected function extractWebhookSignatureDate(array $payload): string
    {
        $candidates = [
            $payload['TrnDate'] ?? null,
            $payload['InitiateDT'] ?? null,
        ];

        foreach ($candidates as $candidate) {
            if (! $candidate) {
                continue;
            }
            try {
                return Carbon::parse($candidate)->format('Ymd');
            } catch (\Throwable $e) {
                continue;
            }
        }

        return date('Ymd');
    }
}
