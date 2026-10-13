---
title: "Payment API"
category: "api"
tags: ["api", "payments", "icici-eazypay", "webhooks", "encryption"]
related:
  - ../20-features/26-payment-processing.md
code_files:
  - app/Http/Controllers/Api/V1/PaymentController.php
  - app/Http/Controllers/Api/V1/PaymentWebhookController.php
  - app/Services/Payment/ICICIEazyPayAdapter.php
last_updated: "2026-07-22"
version: "2.0"
---

# Payment API

**Location**: `docs/30-api/36-payment-api.md`
**Related**: [Payment Processing](../20-features/26-payment-processing.md) - Complete documentation

**Base Path**: `/api/v1/payments`

---

## Endpoints Reference

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/` | List all payments | ✓ | All authenticated users |
| GET | `/export` | Download the list as CSV | ✓ | Everyone who can list payments |
| GET | `/{id}` | View payment details | ✓ | Admin or Owner |
| POST | `/initiate` | Create payment order | ✓ | Enterprise Admin, Enterprise User |

**Callback & Webhook Endpoints** (No Auth, Signature Verified):
- `GET /api/v1/payments/icici-eazypay/callback` - ICICI return URL
- `POST /api/v1/webhooks/payments/icici-eazypay` - ICICI push notification

---

## API Endpoints

### 1. List All Payments

**Endpoint**: `GET /api/v1/payments`

**Description**: Retrieves a paginated list of payments. System administrators can view all payments, while other users see only payments related to their organization.

**Authentication**: Required (Bearer token)

**Query Parameters**:
- `application_id` (integer, optional) - Filter by application ID
- `status` (string, optional) - Filter by status (pending, success, failed, etc.)
- `payment_type` (string, optional) - Filter by type (application_fee, assessment_fee, etc.)
- `per_page` (integer, optional) - Results per page (default: 15)

**Request**:
```http
GET /api/v1/payments?status=success&payment_type=application_fee&per_page=15
Authorization: Bearer {token}
```

**Response** (200 OK):
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

### 1a. Export Payments

**Endpoint**: `GET /api/v1/payments/export`

**Description**: Downloads the payment list as CSV. It shares the list endpoint's query, so the
file always contains exactly the rows the screen is showing: the same `success`/`failed` set, the
same filters, and the same role-based scoping (an organisation only ever exports its own
payments). Assessors and DRDO Lab users get 403, as they do on the list.

**Authentication**: Required (Bearer token). Rate limited to 60 requests per minute.

**Query Parameters**: the same as the list, minus paging — `search`, `applicationId`,
`paymentType`, `sector`, `enterpriseClassification`, `fromDate`, `toDate`. An unparseable or
inverted date range is refused with 422 rather than silently returning an empty file.

**Response** (200 OK): `text/csv`, streamed in chunks so memory stays flat however many rows
match. The body opens with a UTF-8 BOM so Excel reads it correctly on double-click, and the file
is named `payments_export_YYYY-MM-DD_His.csv` — the same convention the applications and
assessments exports use.

**Columns**: ID, Payment Number, Application Number, Organization Name, Unit Name, Sector,
Enterprise Classification, Payment Type, Amount, Currency, Status, Gateway, Gateway Transaction
ID, GSTIN, TAN, Paid By, Failure Reason, Paid At, Created At.

```http
GET /api/v1/payments/export?sector=manufacturing&fromDate=2026-08-01&toDate=2026-08-31
Authorization: Bearer {token}
```

---

### 2. View Payment Details

**Endpoint**: `GET /api/v1/payments/{id}`

**Description**: Retrieves detailed information about a specific payment.

**Authentication**: Required (Bearer token)

**Path Parameters**:
- `id` (integer, required) - Payment ID

**Request**:
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

**Error Responses**:
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Unauthorized to view this payment
- `404 Not Found` - Payment not found

---

### 3. Initiate Payment

**Endpoint**: `POST /api/v1/payments/initiate`

**Description**: Creates a new payment record and initiates the payment process with ICICI EazyPay. Returns gateway-specific data required for completing the payment. Organization details are automatically fetched from the application.

**Authentication**: Required (Bearer token)

**Request Body**:
```json
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

**Request Parameters**:
- `application_id` (integer, required) - Application ID
- `payment_type` (string, required) - Type of payment (application_fee, assessment_fee, certification_fee, surveillance_fee, other)
- `amount` (number, required) - Payment amount (minimum 0.01)
- `gateway` (string, optional) - Payment gateway (icici_eazypay, default: icici_eazypay)
- `notes` (string, optional) - Additional notes
- `contact_person_name` (string, optional, max 50) - Contact person name (defaults to user name)
- `fee_description` (string, optional, max 80) - Fee description (defaults to payment type)

**Request**:
```http
POST /api/v1/payments/initiate
Authorization: Bearer {token}
Content-Type: application/json

{
  "application_id": 101,
  "payment_type": "application_fee",
  "amount": 5000.00,
  "gateway": "icici_eazypay"
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
      "payment_url": "https://eazypayuat.icici.bank.in/EazyPG?merchantid=<merchant_id>&mandatory%20fields=...",
      "reference_no": "TXN1705312345678A3F9",
      "redirect_method": "GET",
      "form_data": {
        "merchantid": "<merchant_id>",
        "mandatory_fields": "<encrypted_string>",
        "optional_fields": "<encrypted_string>",
        "returnurl": "<encrypted_string>",
        "reference_no": "<encrypted_string>",
        "submerchantid": "<encrypted_string>",
        "transaction_amount": "<encrypted_string>",
        "paymode": "<encrypted_string>"
      }
    }
  }
}
```

**Frontend Usage**:
```javascript
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
  // Redirect to ICICI EazyPay
  window.location.href = data.data.gateway_data.payment_url;
}
```

**Error Responses**:
- `400 Bad Request` - Validation failed
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Unauthorized to create payment for this application
- `500 Internal Server Error` - Failed to initiate payment

---

## Webhook Endpoints

### 4. ICICI EazyPay Callback

**Endpoint**: `GET /api/v1/payments/icici-eazypay/callback`

**Description**: Handles the return URL callback from ICICI EazyPay after payment completion. This endpoint validates the response signature and updates payment status. Users are automatically redirected to the frontend.

**Authentication**: None (called by ICICI gateway)

**Query Parameters**: Returned by ICICI EazyPay (encrypted)
- `Response Code` - E000 for success
- `Unique Ref Number` - EazyPay Transaction ID
- `Transaction Amount` - Transaction amount
- `Total Amount` - Total amount including fees
- `Service Tax Amount` - Service tax
- `Processing Fee Amount` - Processing fee
- `Payment Mode` - Payment method used
- `ReferenceNo` - Merchant reference number
- `SubMerchantId` - Sub-merchant ID
- `ID` - Merchant EazyPay ID
- `RS` - SHA512 Signature

**Response**: Redirects to frontend with query parameters
- `status` - success, failed, or error
- `message` - Status message
- `payment_id` - Payment ID
- `application_id` - Application ID (on success)
- `response_code` - ICICI response code (on failure)

**Frontend Callback URL**: `http://localhost:3000/payment-callback?status=success&payment_id=1&application_id=101`

---

### 5. ICICI EazyPay Push Notification

**Endpoint**: `POST /api/v1/webhooks/payments/icici-eazypay`

**Description**: Receives and processes real-time push notifications from ICICI EazyPay. This endpoint receives encrypted XML data which is decrypted and processed to update payment status.

**Authentication**: None (signature verified)

**Request Body**: Encrypted XML data from ICICI EazyPay

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

**Events Handled**:
- `payment.success` - Payment completed successfully
- `challan.generated` - Offline payment challan generated
- `payment.failed` - Payment failed

---

## Complete Request/Response Examples

For complete examples including:
- Frontend integration code
- Encryption/decryption examples
- Webhook handling
- Error scenarios
- Testing credentials

See [Payment Processing Documentation](../20-features/26-payment-processing.md).

---

## See Also

- [Payment Processing](../20-features/26-payment-processing.md) - Complete feature documentation
- [Application Workflow](../20-features/23-application-workflow.md) - How payments fit in application flow

**Code References**:
- [`PaymentController`](../../app/Http/Controllers/Api/V1/PaymentController.php)
- [`PaymentWebhookController`](../../app/Http/Controllers/Api/V1/PaymentWebhookController.php)
- [`ICICIEazyPayAdapter`](../../app/Services/Payment/ICICIEazyPayAdapter.php)
- [`Payment` model](../../app/Models/Payment.php)
