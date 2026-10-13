---
title: "Payment Processing"
category: "features"
tags: ["payment", "icici-eazypay", "webhooks", "encryption"]
related:
  - 23-application-workflow.md
  - ../30-api/36-payment-api.md
code_files:
  - app/Models/Payment.php
  - app/Http/Controllers/Api/V1/PaymentController.php
  - app/Services/Payment/ICICIEazyPayAdapter.php
  - app/Services/Payment/PaymentSettlementService.php
  - app/Http/Controllers/Api/V1/PaymentWebhookController.php
  - app/Console/Commands/VerifyPendingPayments.php
last_updated: "2026-09-03"
version: "2.2"
---

# Payment Processing

**Location**: `docs/20-features/26-payment-processing.md`
**Related**: [Application Workflow](23-application-workflow.md) | [Payment API](../30-api/36-payment-api.md)

## Overview

The QCI SAMAR system integrates with **ICICI EazyPay** payment gateway to process application fees, assessment charges, and certificate fees securely.

### Supported Payment Gateways

1. **ICICI EazyPay** - Primary gateway (Implemented)

### Payment Types

- **Application Fee** - Initial application submission
- **Assessment Fee** - Assessment services
- **Certificate Fee** - Certificate issuance
- **Renewal Fee** - Certificate renewal
- **Surveillance Fee** - Periodic surveillance audits

---

## Payment Flow

```
1. Enterprise Admin Creates Application
   ↓
2. System Calculates Fees
   ↓
3. Admin Initiates Payment (POST /api/v1/payments/initiate)
   ↓
4. System Fetches Organization Details
   ↓
5. System Builds 17 Mandatory Fields
   ↓
6. System Encrypts Fields (AES-128-ECB)
   ↓
7. Returns Payment URL with Encrypted Parameters
   ↓
8. Frontend Redirects User to ICICI EazyPay Portal
   ↓
9. User Completes Payment on ICICI Portal
   ↓
10. ICICI Redirects Back to Return URL (/api/v1/payments/icici-eazypay/callback)
   ↓
11. System Validates SHA512 Signature
   ↓
12. System Updates Payment Status
   ↓
13. (Optional) ICICI Sends Push Notification to Webhook
   ↓
14. Application Becomes Ready for Allocation
```

---

## Payment Structure

### Payment Model

**Code Reference**: [`Payment` model](../../app/Models/Payment.php)

```php
class Payment extends Model
{
    protected $fillable = [
        // Identification
        'payment_id',           // Unique reference: TXN1705312345678A3F9
        'order_id',             // Same as payment_id (for gateway reference)
        'transaction_id',       // Bank transaction ID (optional)

        // Relations
        'application_id',       // Application this payment is for
        'organization_id',      // Organization making payment
        'user_id',              // User who initiated payment
        'payment_type',         // application_fee, assessment_fee, certification_fee, etc.

        // Gateway Details
        'gateway',              // 'icici_eazypay'
        'gateway_order_id',     // Gateway's order reference
        'gateway_payment_id',   // Gateway's transaction ID
        'gateway_signature',    // SHA512 signature from gateway

        // Amount Details
        'amount',               // Total payment amount
        'currency',             // INR (default)
        'gateway_fee',          // Processing fee charged by gateway
        'tax_amount',           // Service tax amount
        'net_amount',           // Net amount (amount - gateway_fee)

        // Payment Method
        'payment_method',       // netbanking, card, upi, wallet, etc.
        'payment_method_details', // Bank name, card type, etc.

        // Status & Workflow
        'status',               // initiated, pending, processing, success, failed, cancelled

        // Timestamps
        'initiated_at',         // When payment was initiated
        'completed_at',         // When payment was completed (not paid_at)
        'failed_at',            // When payment failed
        'cancelled_at',         // When payment was cancelled

        // Failure Details
        'failure_reason',       // Short reason for failure
        'failure_message',      // Detailed failure message
        'error_code',           // Gateway error code

        // Verification & Reconciliation
        'is_verified',          // Payment verified by admin
        'verified_at',          // Verification timestamp
        'verified_by',          // Admin who verified
        'is_reconciled',        // Payment reconciled with bank statement
        'reconciled_at',        // Reconciliation timestamp
        'verification_attempts', // Times the scheduled sweep has re-checked this payment
        'last_verified_at',     // When the sweep last asked the gateway

        // Webhook Data
        'webhook_payload',      // JSON: Webhook data from gateway
        'webhook_received_at',  // When webhook was received

        // Customer Details (captured at payment time)
        'customer_name',        // Customer name
        'customer_email',       // Customer email
        'customer_phone',       // Customer phone

        // Tax Identification (captured at initiate time)
        'gstin',                // GST identification number
        'tan',                  // TAN

        // Receipt
        'receipt_number',       // Receipt number
        'receipt_document_id',  // Receipt document ID

        // Additional Data
        'description',          // Fee description
        'metadata',             // JSON: Gateway response and other metadata
    ];
}
```

**There are no refund columns and no refund statuses.** They were dropped by
`database/migrations/2026_07_21_000001_drop_refund_support_from_payments_table.php` — the
applicant's payment declaration states the amount is *non-refundable, non-adjustable and
non-transferable irrespective of the outcome of the Certification process*, so the columns were
never reachable.

### Payment Statuses

| Status | Description |
|--------|-------------|
| `initiated` | Payment record created, not yet sent to gateway |
| `pending` | Payment sent to gateway, awaiting user action |
| `processing` | Payment being processed by gateway |
| `success` | Payment completed successfully |
| `failed` | Payment failed |
| `cancelled` | Payment cancelled by user |

The `payments.status` enum holds exactly these six values. There are no refund statuses.

---

## Fee Calculation

### Get the Application Fee Quote

**Code Reference**: [`PaymentController::fee`](../../app/Http/Controllers/Api/V1/PaymentController.php)

```http
GET /api/v1/applications/101/fee?tdsDeductible=true&tdsPercentage=2
Authorization: Bearer {token}
```

**Query Parameters** (camelCase — the request middleware rejects snake_case keys):
- `tdsDeductible` - Optional boolean; whether TDS is to be deducted
- `tdsPercentage` - Optional, `2` or `10`; required when `tdsDeductible` is true

The fee has only these components: **base certification fee**, **food and accommodation**, **GST** and **TDS**. There is no per-scheme / per-organization-size / per-unit-count fee input, and no separate application, assessment or certificate fee.

**Response** (camelCase after the response middleware):
```json
{
  "success": true,
  "message": "Fee retrieved successfully.",
  "data": {
    "baseCertificationFee": 30000.00,
    "foodAccommodation": 3000.00,
    "amountPayable": 33000.00,
    "gstPercentage": 18,
    "gstAmount": 5940.00,
    "tdsAvailable": true,
    "tdsDeductible": true,
    "tdsPercentage": 2,
    "tdsAmount": 660.00,
    "totalAmount": 38280.00
  }
}
```

---

## ICICI EazyPay Integration

### 17 Mandatory Fields

ICICI EazyPay requires the following fields to be submitted (pipe-separated, then encrypted):

1. **Reference No** - Payment ID (TXN1705312345678A3F9)
2. **Sub Merchant ID** - Sub-merchant identifier (configured in env)
3. **PG Amount** - Transaction amount
4. **UTR Number** - Unique Transaction Reference (same as payment ID)
5. **Organisation Email ID** - Organization email
6. **Organisation Mobile Number** - Organization phone
7. **PAN** - Organization PAN number
8. **TAN** - Organization TAN number
9. **GSTIN** - GST identification number
10. **Unit Address** - Organization address
11. **District** - District name
12. **Unit Pin Code** - PIN code
13. **Unit State** - State name
14. **Country** - Country (default: India)
15. **Fee Description** - Description of fee (e.g., "SAMAR Application Fee")
16. **Contact Person Name** - Contact person name
17. **Payment Date** - Payment date in dd/MMM/yyyy format

**Optional Fields**:
- Address Line 2 - Additional address line

### Encryption

All parameters are encrypted using **AES-128-ECB** with PKCS5 padding:

```php
$cipher = 'AES-128-ECB';
$encrypted = openssl_encrypt($data, $cipher, $encryptionKey, OPENSSL_RAW_DATA);
$base64Encoded = base64_encode($encrypted);
```

**Decryption** (for responses):
```php
$decoded = base64_decode($encryptedData);
$decrypted = openssl_decrypt($decoded, $cipher, $encryptionKey, OPENSSL_RAW_DATA);
```

### Signature Verification

Responses from ICICI include a **SHA512 signature** (RS parameter) for verification:

```php
$signatureString = implode('|', [
    $merchantId,
    $responseCode,
    $uniqueRefNumber,
    $serviceTaxAmount,
    $processingFeeAmount,
    $totalAmount,
    $transactionAmount,
    $transactionDate,
    $interchangeValue,
    $tdr,
    $paymentMode,
    $subMerchantId,
    $referenceNo,
    $tps,
    $encryptionKey
]);

$expectedSignature = hash('sha512', $signatureString);
```

---

## Creating Payment Order

### Initiate Payment (ICICI EazyPay)

**Code Reference**: [`PaymentController::initiate`](../../app/Http/Controllers/Api/V1/PaymentController.php#L367)

```http
POST /api/v1/payments/initiate
Authorization: Bearer {token}
Content-Type: application/json

{
  "application_id": 101,
  "payment_type": "application_fee",
  "amount": 5000.00,
  "gateway": "icici_eazypay",
  "notes": "Application fee payment",
  "contact_person_name": "John Doe",
  "fee_description": "SAMAR Application Fee"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Payment initiated successfully.",
  "data": {
    "payment": {
      "id": 1,
      "payment_number": "TXN1705312345678A3F9",
      "application_id": 101,
      "payment_type": "application_fee",
      "amount": 5000.00,
      "currency": "INR",
      "status": "pending",
      "gateway": "icici_eazypay",
      "gateway_payment_id": null,
      "paid_at": null,
      "created_at": "2025-01-15T10:25:00+05:30"
    },
    "gateway_data": {
      "success": true,
      "gateway": "icici_eazypay",
      "gateway_order_id": "TXN1705312345678A3F9",
      "amount": 5000.00,
      "currency": "INR",
      "payment_url": "https://eazypayuat.icici.bank.in/EazyPG?merchantid=<merchant_id>&...",
      "reference_no": "TXN1705312345678A3F9",
      "redirect_method": "GET"
    }
  }
}
```

**System automatically fetches**:
- Organization email, phone, PAN, TAN, GSTIN
- Organization address, district, pin code, state, country
- Contact person name (defaults to logged-in user)
- Fee description (defaults to payment type)

---

## Frontend Integration

### ICICI EazyPay Integration

The frontend should redirect the user to the ICICI EazyPay payment URL returned by the initiate payment API.

#### Option 1: Direct Redirect (Recommended)

```javascript
async function initiatePayment() {
  try {
    const response = await fetch('/api/v1/payments/initiate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        application_id: 101,
        payment_type: 'application_fee',
        amount: 5000.00,
        gateway: 'icici_eazypay',
        notes: 'Application fee payment'
      })
    });

    const data = await response.json();

    if (data.success) {
      // Redirect to ICICI EazyPay payment portal
      window.location.href = data.data.gateway_data.payment_url;
    } else {
      alert('Failed to initiate payment');
    }
  } catch (error) {
    console.error('Payment initiation error:', error);
  }
}
```

#### Option 2: Form POST Method

```html
<form id="paymentForm" method="POST" action="">
  <input type="hidden" name="merchantid" value="">
  <input type="hidden" name="mandatory fields" value="">
  <input type="hidden" name="optional fields" value="">
  <input type="hidden" name="returnurl" value="">
  <input type="hidden" name="Reference No" value="">
  <input type="hidden" name="submerchantid" value="">
  <input type="hidden" name="transaction amount" value="">
  <input type="hidden" name="paymode" value="">
</form>

<script>
async function initiatePayment() {
  const response = await fetch('/api/v1/payments/initiate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      application_id: 101,
      payment_type: 'application_fee',
      amount: 5000.00
    })
  });

  const data = await response.json();

  if (data.success) {
    const form = document.getElementById('paymentForm');
    const formData = data.data.gateway_data.form_data;

    // Set form action to ICICI base URL
    form.action = 'https://eazypayuat.icici.bank.in/EazyPG';

    // Populate form fields
    form.querySelector('[name="merchantid"]').value = formData.merchantid;
    form.querySelector('[name="mandatory fields"]').value = formData.mandatory_fields;
    form.querySelector('[name="optional fields"]').value = formData.optional_fields;
    form.querySelector('[name="returnurl"]').value = formData.returnurl;
    form.querySelector('[name="Reference No"]').value = formData.reference_no;
    form.querySelector('[name="submerchantid"]').value = formData.submerchantid;
    form.querySelector('[name="transaction amount"]').value = formData.transaction_amount;
    form.querySelector('[name="paymode"]').value = formData.paymode;

    // Submit form
    form.submit();
  }
}
</script>
```

### Return URL Callback

After payment completion, ICICI redirects the user back to the configured return URL with payment details.

**Return URL**: `https://domain/api/v1/payments/icici-eazypay/callback`

The system automatically processes the callback, validates the signature, and updates the payment status. The user is then redirected to the frontend with payment status:

**Frontend Callback URL**: `http://localhost:3000/payment-callback?status=success&payment_id=1&application_id=101`

**Possible Status Values**:
- `success` - Payment completed successfully
- `failed` - Payment failed
- `error` - Processing error

---

## Webhook Handling

### ICICI EazyPay Push Notifications

**Code Reference**: [`PaymentWebhookController::iciciEazyPay`](../../app/Http/Controllers/Api/V1/PaymentWebhookController.php#L51)

**Webhook URL**: `https://domain/api/v1/webhooks/payments/icici-eazypay`

ICICI EazyPay sends real-time push notifications (encrypted XML) when payment status changes.

**Webhook Events** — [`ICICIEazyPayAdapter::mapResponseCodeToEvent()`](../../app/Services/Payment/ICICIEazyPayAdapter.php) maps the ICICI response code to one of five events, of which `processICICIWebhookEvent()` handles three; the other two fall through to the `default` branch and are only logged as "Unhandled ICICI webhook event":

| Event | Response codes | Handled? |
|---|---|---|
| `payment.success` | `E000` | ✓ marks the payment `success` |
| `challan.generated` | `E00327`, `E00328`, `E00329`, `E00336` | ✓ records the gateway payment id, keeps the payment `pending` |
| `payment.failed` | `E007`, `E008` | ✓ marks the payment `failed` |
| `upi.initiated` | `E00331` | ✗ logged only, no state change |
| `payment.unknown` | any other code | ✗ logged only, no state change |

**Implementation**:

```php
public function iciciEazyPay(Request $request): JsonResponse
{
    try {
        // Get raw encrypted content
        $encryptedData = $request->getContent();

        // Get gateway adapter
        $gateway = new ICICIEazyPayAdapter();

        // Parse webhook payload (decrypts and parses XML)
        $parsedData = $gateway->parseWebhookPayload([
            'encrypted_data' => $encryptedData,
        ]);

        // Verify signature if HashVal is present
        $hashVal = $parsedData['hash_value'] ?? '';
        $rawPayload = $parsedData['raw_payload'] ?? [];

        if ($hashVal && !$gateway->verifyWebhookSignature($rawPayload, $hashVal)) {
            Log::warning("ICICI EazyPay invalid webhook signature");
            return response()->json([
                'success' => false,
                'message' => 'Invalid webhook signature',
            ]);
        }

        // Find payment by gateway_payment_id
        $payment = Payment::where('gateway_payment_id', $parsedData['payment_id'])
            ->orWhere('gateway_order_id', $parsedData['payment_id'])
            ->first();

        if (!$payment) {
            return response()->json([
                'success' => true,
                'message' => 'Payment not found, webhook acknowledged',
            ]);
        }

        // Process the webhook event
        $this->processICICIWebhookEvent($payment, $parsedData);

        return response()->json([
            'success' => true,
            'message' => 'Webhook processed successfully',
        ]);
    } catch (\Exception $e) {
        Log::error("ICICI EazyPay webhook error: " . $e->getMessage());

        // Return 200 to prevent webhook retries
        return response()->json([
            'success' => false,
            'message' => 'Webhook processing failed',
        ], 200);
    }
}

```

Each event is then applied through `PaymentSettlementService` rather than inline:
`payment.success` calls `settleSuccess()`, `payment.failed` calls `settleFailure()`, and
`challan.generated` calls `recordPayload()` so the challan reference is stored without changing
the status. See the settlement section below for what each of those does.

**Configure Webhook in ICICI Dashboard**:
- **Push URL**: `https://domain/api/v1/webhooks/payments/icici-eazypay`
- Store push URL in `.env` as `ICICI_EAZYPAY_PUSH_URL`

---

## Settlement — one path, four callers

Applying a gateway verdict to a payment lives in
[`PaymentSettlementService`](../../app/Services/Payment/PaymentSettlementService.php), not in the
controllers. Four callers settle payments and every one of them owes the same side effects, so
they all go through this service:

| Caller | Settles from |
|---|---|
| `PaymentWebhookController::iciciEazyPayCallback` | the browser return URL |
| `PaymentWebhookController::processICICIWebhookEvent` | the push notification |
| `payments:verify-pending` | the scheduled re-verification sweep |
| `scripts/icici-fix-mismarked-payments.php` | manual reconciliation |

`settleSuccess()` runs, in order: the payment row update, the amount-mismatch check, the
application rollup and `payment_success` state transition (all in one transaction), then the
Business Central invoice and receipt and the applicant's receipt email after the commit.
`settleFailure()` records the failure. `recordPayload()` stores a notification that carries no
verdict, such as an offline challan being generated.

**Settling is idempotent.** The payment row is locked and its status re-read inside the
transaction, and only `initiated`, `pending` and `processing` rows are settled. A late push
notification racing the sweep therefore cannot double-count a payment, raise a second ERP
invoice, or send a second receipt; the losing caller records its payload and returns false. A
successful payment is never downgraded by a later negative verdict.

---

## Automatic re-verification of stuck payments

A payment depends on either the return callback or the push notification coming back. When both
are missed the row stays `pending` while the bank has already taken the money, and nothing polls
the gateway. The scheduled sweep closes that gap.

**Command**: `php artisan payments:verify-pending`
**Schedule**: every 30 minutes (`routes/console.php`, alongside the `bc:*` entries)

Each run picks up `icici_eazypay` payments that are still `initiated`, `pending` or `processing`,
were initiated longer ago than the threshold, and are below the attempt ceiling. For each it calls
`ICICIEazyPayAdapter::verifyPayment()` against the EazyPay Verify URL and:

- **verified success** → `settleSuccess()`, exactly as a callback would
- **failed at the gateway** → `settleFailure()`
- **still in flight** (an offline challan can sit here for days) → left for the next run
- **gateway unreachable or no verdict** → left alone. A network failure is never read as a
  verdict; treating it as one would mark a live payment failed.

The attempt is counted before the call, so a gateway that keeps erroring cannot hold a row in the
sweep forever. On reaching the ceiling the payment is logged at `error` level and raised as a
`critical` error-log entry for manual reconciliation, and its **status is deliberately left
untouched** — `RIP` and `SIP` mean the money may already have moved, so forcing the row to
`failed` would hide a real payment rather than resolve it.

**Configuration** (`config/services.php` → `icici_eazypay`):

| Setting | Env | Default | Meaning |
|---|---|---|---|
| `verify_after_minutes` | `ICICI_EAZYPAY_VERIFY_AFTER_MINUTES` | 30 | How old a payment must be before it is swept |
| `verify_max_attempts` | `ICICI_EAZYPAY_VERIFY_MAX_ATTEMPTS` | 48 | Checks before the payment goes to manual reconciliation |

The defaults cover roughly the first day after initiation, which is where a missed callback shows
up. Two columns on `payments` track the sweep: `verification_attempts` and `last_verified_at`.

**Options**: `--max=` and `--minutes=` override the configured values for one run; `--id=` checks
a single payment immediately, ignoring the age threshold.

**The scheduler must be running.** Both dev and staging carry the `* * * * * php artisan
schedule:run` crontab entry that drives this, along with the Business Central sync and the
certificate reminders. Without it the sweep never fires.

---

## Payment Status

### Check Payment Status

```http
GET /api/v1/payments/1
Authorization: Bearer {token}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "payment": {
      "id": 1,
      "payment_number": "TXN1705312345678A3F9",
      "application_id": 101,
      "payment_type": "application_fee",
      "amount": 5000.00,
      "currency": "INR",
      "status": "success",
      "gateway": "icici_eazypay",
      "gateway_payment_id": "TXN123456789",
      "paid_at": "2025-01-15T10:30:00+05:30",
      "created_at": "2025-01-15T10:25:00+05:30",
      "application": {
        "id": 101,
        "application_number": "APP-2025-000101",
        "organization": {
          "id": 1,
          "name": "ABC Industries Ltd"
        }
      },
      "paid_by": {
        "id": 5,
        "name": "John Doe",
        "email": "john@example.com"
      },
      "description": "SAMAR Application Fee",
      "failure_reason": null
    }
  }
}
```

### ICICI EazyPay Response Codes

| Code | Description | Status |
|------|-------------|--------|
| `E000` | Transaction successful | `success` |
| `E001` | Unauthorized Payment Mode | `failed` |
| `E002` | Unauthorized Key | `failed` |
| `E007` | Transaction Failed | `failed` |
| `E008` | Failure from Third Party due to Technical Error | `failed` |
| `E00325` | Merchant Reference Number Duplicate | `failed` |
| `E00327` | Cash Challan Generated | `pending` |
| `E00328` | Cheque Challan Generated | `pending` |
| `E00329` | NEFT Challan Generated | `pending` |
| `E00331` | UPI Transaction Initiated - Please Accept or Reject | `processing` |
| `E00335` | Transaction Cancelled By User | `cancelled` |
| `E00336` | WIRE Challan Generated | `pending` |

---

## Payment Reports

### List All Payments

```http
GET /api/v1/payments?status=success&payment_type=application_fee&per_page=15
Authorization: Bearer {token}
```

**Query Parameters**:
- `application_id` - Filter by application ID
- `status` - Filter by status (pending, success, failed, etc.)
- `payment_type` - Filter by payment type
- `per_page` - Results per page (default: 15)

**Response**:
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": 1,
        "payment_number": "TXN1705312345678A3F9",
        "application_id": 101,
        "payment_type": "application_fee",
        "amount": 5000.00,
        "currency": "INR",
        "status": "success",
        "gateway": "icici_eazypay",
        "gateway_payment_id": "TXN123456789",
        "paid_at": "2025-01-15T10:30:00+05:30",
        "created_at": "2025-01-15T10:25:00+05:30"
      }
    ],
    "pagination": {
      "total": 50,
      "per_page": 15,
      "current_page": 1,
      "last_page": 4
    }
  }
}
```

---

## Payment Gateway Configuration

### Environment Variables

**Code Reference**: [`config/services.php`](../../config/services.php)

```env
# Payment Configuration
PAYMENT_DEFAULT_GATEWAY=icici_eazypay

# ICICI EazyPay Configuration
ICICI_EAZYPAY_ENABLED=true
ICICI_EAZYPAY_MERCHANT_ID=<merchant_id>
ICICI_EAZYPAY_ENCRYPTION_KEY=<encryption_key>
ICICI_EAZYPAY_SUB_MERCHANT_ID=11
ICICI_EAZYPAY_RETURN_URL=https://domain/api/v1/payments/icici-eazypay/callback
ICICI_EAZYPAY_PUSH_URL=https://domain/api/v1/webhooks/payments/icici-eazypay

# ICICI EazyPay URLs (UAT)
ICICI_EAZYPAY_BASE_URL=https://eazypayuat.icici.bank.in/EazyPG
ICICI_EAZYPAY_VERIFY_URL=https://eazypayuat.icici.bank.in/EazyPGVerify

# ICICI EazyPay URLs (Production)
# ICICI_EAZYPAY_BASE_URL=https://eazypay.icicibank.com/EazyPG
# ICICI_EAZYPAY_VERIFY_URL=https://eazypay.icicibank.com/EazyPGVerify

# Scheduled re-verification of unsettled payments (both optional; defaults shown)
ICICI_EAZYPAY_VERIFY_AFTER_MINUTES=30
ICICI_EAZYPAY_VERIFY_MAX_ATTEMPTS=48
```

### Configuration File

```php
// config/services.php

return [
    // ...

    'payment' => [
        'default_gateway' => env('PAYMENT_DEFAULT_GATEWAY', 'icici_eazypay'),
    ],

    'icici_eazypay' => [
        'enabled' => env('ICICI_EAZYPAY_ENABLED', true),
        'merchant_id' => env('ICICI_EAZYPAY_MERCHANT_ID'),
        'encryption_key' => env('ICICI_EAZYPAY_ENCRYPTION_KEY'),
        'sub_merchant_id' => env('ICICI_EAZYPAY_SUB_MERCHANT_ID', '1'),
        'return_url' => env('ICICI_EAZYPAY_RETURN_URL'),
        'push_url' => env('ICICI_EAZYPAY_PUSH_URL'),
        'base_url' => env('ICICI_EAZYPAY_BASE_URL', 'https://eazypay.icicibank.com/EazyPG'),
        'verify_url' => env('ICICI_EAZYPAY_VERIFY_URL', 'https://eazypay.icicibank.com/EazyPGVerify'),
        'verify_after_minutes' => env('ICICI_EAZYPAY_VERIFY_AFTER_MINUTES', 30),
        'verify_max_attempts' => env('ICICI_EAZYPAY_VERIFY_MAX_ATTEMPTS', 48),
    ],
];
```

### Payment Modes

ICICI EazyPay supports multiple payment modes:

| Mode | Code | Description |
|------|------|-------------|
| All Modes | `9` | All payment modes enabled (default) |
| Net Banking | `3` | Net banking only |
| Debit Card | `4` | Debit card only |
| Credit Card | `5` | Credit card only |
| UPI | `6` | UPI only |
| Cash | `0` | Cash (offline) |
| Cheque | `1` | Cheque (offline) |
| NEFT/RTGS | `2` | Bank transfer (offline) |

---

## Testing Payments

### ICICI EazyPay UAT Environment

**Test Credentials**: see `ICICI_EAZYPAY_MERCHANT_ID` / `ICICI_EAZYPAY_ENCRYPTION_KEY` / `ICICI_EAZYPAY_SUB_MERCHANT_ID` in `.env.example` for the shared UAT values. Environment: UAT (User Acceptance Testing).

### Test Net Banking

For testing net banking payments in UAT environment:

1. Select **HDFC NB** (HDFC Net Banking) as the bank
2. Use test credentials:
   - **User ID**: `payu`
   - **Password**: `payu`
3. Complete the payment flow

### Test Payment Modes

ICICI EazyPay UAT supports testing:
- **Net Banking** (recommended for testing)
- **Credit Card** (test cards provided by ICICI)
- **Debit Card** (test cards provided by ICICI)
- **UPI** (test VPA provided by ICICI)

### UAT to Production Migration

When moving from UAT to production:

1. Update environment variables:
   ```env
   ICICI_EAZYPAY_MERCHANT_ID=<production_merchant_id>
   ICICI_EAZYPAY_ENCRYPTION_KEY=<production_key>
   ICICI_EAZYPAY_SUB_MERCHANT_ID=<production_sub_merchant_id>
   ICICI_EAZYPAY_BASE_URL=https://eazypay.icicibank.com/EazyPG
   ICICI_EAZYPAY_VERIFY_URL=https://eazypay.icicibank.com/EazyPGVerify
   ```

2. Update return and push URLs to production domain
3. Configure webhooks in ICICI merchant dashboard
4. Test with small real transaction before going live

---

## Business Rules

1. **Payment Required Before Allocation**: Application cannot be allocated to assessor until payment is completed
2. **Organization Details Required**: PAN, TAN, GSTIN, and complete address must be configured in organization profile before payment
3. **Payment Number Format**: `TXN{unix_timestamp_ms}{4_uppercase_hex}` (e.g., `TXN1705312345678A3F9`), generated by [`PaymentController::generatePaymentNumber()`](../../app/Http/Controllers/Api/V1/PaymentController.php) — globally unique without database coordination
4. **No Refunds**: the applicant's payment declaration states the fee is non-refundable, non-adjustable and non-transferable irrespective of the outcome of the certification process. There is no refund flow, no refund API, and no refund columns or statuses on `payments`
5. **Currency**: INR only
6. **Encryption**: All payment parameters encrypted using AES-128-ECB
7. **Signature Verification**: All responses verified using SHA512 signature

---

## API Reference

**Base Path**: `/api/v1/payments`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | List all payments | ✓ |
| GET | `/{id}` | View payment details | ✓ |
| POST | `/initiate` | Create payment order | ✓ |

**Webhook Endpoints** (No Auth):
- `/api/v1/webhooks/payments/icici-eazypay` - ICICI push notification
- `/api/v1/payments/icici-eazypay/callback` - ICICI return URL

For complete API documentation, see [Payment API](../30-api/36-payment-api.md).

---

## Security Considerations

1. **Encryption Key Protection**: Never expose ICICI_EAZYPAY_ENCRYPTION_KEY in logs or client-side code
2. **Signature Verification**: Always verify SHA512 signatures on return URLs and webhooks
3. **HTTPS Only**: All payment URLs must use HTTPS in production
4. **Webhook Security**: Webhooks accept encrypted XML from ICICI, validate signatures before processing
5. **PII Protection**: Organization PAN, TAN, GSTIN are encrypted before transmission
6. **Payment Data Storage**: Store only essential payment data, avoid storing full card details

---

## Troubleshooting

### Common Issues

**Issue**: Payment initiation fails with "Mandatory fields coming from merchant are empty"

**Solution**: Ensure organization has all required fields:
- Email, phone, PAN, TAN, GSTIN
- Complete address (address, district, pin code, state, country)

---

**Issue**: Invalid signature error on return URL

**Solution**: Verify encryption key matches ICICI configuration. Check signature string includes all required fields in correct order.

---

**Issue**: Webhook not received after payment

**Solution**:
- Verify push URL is configured in ICICI merchant dashboard
- Check webhook endpoint is accessible from ICICI servers (not localhost)
- Review server logs for webhook errors

---

**Issue**: Duplicate reference number error (E00325)

**Solution**: Payment ID already exists. Each payment must have unique reference number. Check if payment record was already created.

---

## See Also

- [Application Workflow](23-application-workflow.md) - How payments fit in application flow
- [Payment API](../30-api/36-payment-api.md) - Complete API reference
- [Database Schema](../10-architecture/12-database-schema.md#payment-tables) - Payments table structure

**Code References**:
- [`Payment` model](../../app/Models/Payment.php)
- [`PaymentController`](../../app/Http/Controllers/Api/V1/PaymentController.php)
- [`PaymentWebhookController`](../../app/Http/Controllers/Api/V1/PaymentWebhookController.php)
- [`ICICIEazyPayAdapter`](../../app/Services/Payment/ICICIEazyPayAdapter.php)
