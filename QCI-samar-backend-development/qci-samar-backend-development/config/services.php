<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Payment Gateway Configuration
    |--------------------------------------------------------------------------
    */

    'payment' => [
        'default_gateway' => env('PAYMENT_DEFAULT_GATEWAY', 'icici_eazypay'),
    ],

    'icici_eazypay' => [
        'enabled' => env('ICICI_EAZYPAY_ENABLED', false),

        // Merchant credentials (provided by ICICI Bank after enrollment)
        'merchant_id' => env('ICICI_EAZYPAY_MERCHANT_ID'),           // 6-digit Eazypay ICID
        'encryption_key' => env('ICICI_EAZYPAY_ENCRYPTION_KEY'),     // 16-character AES key
        'sub_merchant_id' => env('ICICI_EAZYPAY_SUB_MERCHANT_ID', '1'),

        // Return URL (where user is redirected after payment)
        'return_url' => env('ICICI_EAZYPAY_RETURN_URL'),

        // Push URL for real-time notifications (configured during enrollment)
        'push_url' => env('ICICI_EAZYPAY_PUSH_URL'),

        // URLs (Production)
        'base_url' => env('ICICI_EAZYPAY_BASE_URL', 'https://eazypay.icicibank.com/EazyPG'),
        'verify_url' => env('ICICI_EAZYPAY_VERIFY_URL', 'https://eazypay.icicibank.com/EazyPGVerify'),

        // Scheduled re-verification of payments the gateway never told us about.
        // A payment is only swept once it is older than verify_after_minutes, and
        // is abandoned to manual reconciliation after verify_max_attempts checks.
        // 30 minutes x 48 attempts covers roughly the first day after initiation,
        // which is where a missed callback or push notification shows up.
        'verify_after_minutes' => env('ICICI_EAZYPAY_VERIFY_AFTER_MINUTES', 30),
        'verify_max_attempts' => env('ICICI_EAZYPAY_VERIFY_MAX_ATTEMPTS', 48),

        // UAT URLs (for testing)
        // 'base_url' => 'https://eazypayuat.icici.bank.in/EazyPG',
        // 'verify_url' => 'https://eazypayuat.icici.bank.in/EazyPGVerify',
    ],

    /*
    |--------------------------------------------------------------------------
    | GSTIN Live Verification
    |--------------------------------------------------------------------------
    | Live verification of a supplied GSTIN against the government registry via
    | a swappable provider (Protean eGov GVS API today). Runs after the offline
    | GstinConsistencyValidator checksum. `enabled` plus present credentials arm
    | the hard gate — with credentials absent the verifier stays dormant, so a
    | submission is never blocked by a verifier that cannot actually call out.
    |
    | Protean whitelists the calling server's IP; unwhitelisted calls fail with
    | ERR_10010. Credentials (UserID/Password) are issued by Protean.
    */

    'gstin' => [
        'enabled' => env('GSTIN_VERIFICATION_ENABLED', false),
        'provider' => env('GSTIN_VERIFICATION_PROVIDER', 'protean'),

        // Days a successful verification is served from the gstin_verifications
        // record before Protean is re-called (registry data rarely changes).
        'cache_ttl_days' => (int) env('GSTIN_VERIFICATION_CACHE_TTL_DAYS', 30),

        'protean' => [
            'base_url' => env('GSTIN_PROTEAN_BASE_URL', 'https://gstlite.proteantech.in/STP/GetGstn'),
            'user_id' => env('GSTIN_PROTEAN_USER_ID'),
            'password' => env('GSTIN_PROTEAN_PASSWORD'),
            // Runs inside the submit request; a slow or down GST service must not hold
            // a PHP-FPM worker for long.
            'timeout' => (int) env('GSTIN_PROTEAN_TIMEOUT', 15),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Zoho Desk Integration (NDIE Department)
    |--------------------------------------------------------------------------
    | Integration with Zoho Desk India region for NDIE Department support tickets.
    | See SAMAR-ZOHODESK INTEGRATION API DOCUMENTATION.docx for details.
    |
    | OAuth Flow:
    | 1. Register a Self-Client at https://api-console.zoho.in/
    | 2. Generate refresh token with scopes: Desk.tickets.ALL, Desk.contacts.ALL, Desk.basic.ALL
    | 3. Configure client_id, client_secret, and refresh_token below
    | 4. Access tokens are auto-refreshed and cached
    |
    | Endpoints used:
    | - POST /contacts - Create contact
    | - GET /contacts - Search contact by email
    | - POST /tickets - Create ticket with custom fields
    */

    'zoho_desk' => [
        'enabled' => env('ZOHO_DESK_ENABLED', false),
        'org_id' => env('ZOHO_DESK_ORG_ID', '60037449308'),
        'base_url' => env('ZOHO_DESK_BASE_URL', 'https://desk.zoho.in/api/v1'),
        'department_id' => env('ZOHO_DESK_DEPARTMENT_ID', '185393000001510116'),
        'owner_id' => env('ZOHO_DESK_OWNER_ID', '185393000000278043'),

        // OAuth 2.0 Configuration (India region: accounts.zoho.in)
        'oauth' => [
            'client_id' => env('ZOHO_DESK_CLIENT_ID'),
            'client_secret' => env('ZOHO_DESK_CLIENT_SECRET'),
            'refresh_token' => env('ZOHO_DESK_REFRESH_TOKEN'),
            'token_url' => env('ZOHO_DESK_TOKEN_URL', 'https://accounts.zoho.in/oauth/v2/token'),
            'scopes' => 'Desk.tickets.ALL,Desk.contacts.ALL,Desk.basic.ALL',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Microsoft Dynamics 365 Business Central (ERP) Integration
    |--------------------------------------------------------------------------
    | Outbound push of Customer / Invoice / Receipt data to BC's OData v4
    | endpoints (ProcessCustomer / ProcessInvoice / ProcessReceipt) and inbound
    | invoice/receipt PDFs. Auth is Azure AD OAuth2 client-credentials; access
    | tokens are auto-refreshed and cached.
    |
    | Endpoint shape:
    |   {base_url}/{tenant_id}/{environment}/ODataV4/Company('{company}')/{action}
    */

    'business_central' => [
        'enabled' => env('BC_ENABLED', false),

        // Retry ceiling for outbound pushes. bc:retry-failed re-dispatches a
        // failed row until its attempts reach this, then stops. The push job
        // raises one CRITICAL as a record crosses the ceiling and never again —
        // the single source of truth both the job and the sweep read.
        'max_attempts' => (int) env('BC_MAX_ATTEMPTS', 5),

        // Azure AD OAuth2 (client-credentials)
        'tenant_id' => env('BC_TENANT_ID'),
        'client_id' => env('BC_CLIENT_ID'),
        'client_secret' => env('BC_CLIENT_SECRET'),
        'token_url' => env('BC_TOKEN_URL'),   // optional; derived from tenant_id when unset
        'scope' => env('BC_SCOPE', 'https://api.businesscentral.dynamics.com/.default'),

        // Business Central environment + company
        'base_url' => env('BC_BASE_URL', 'https://api.businesscentral.dynamics.com/v2.0'),
        'environment' => env('BC_ENVIRONMENT'),   // e.g. ProtivitiSandBox-Test10Apr2024
        'company' => env('BC_COMPANY'),           // e.g. Quality Council of India.

        // Portal identity on BC's side (per QCI 16-Jul-2026; values pending
        // their Customer Integration Setup confirmation).
        'board' => env('BC_BOARD', 'DRDO'),
        'portal_name' => env('BC_PORTAL_NAME', 'NDIE'),
        'location_code' => env('BC_LOCATION_CODE', 'NDIE'),

        // Fixed ledger/discipline values provided by QCI (16-Jul-2026).
        'sub_discipline_name' => env('BC_SUB_DISCIPLINE_NAME', 'ZDR - Assessment (80% & 50%)'),
        'tada_ledger_new' => env('BC_TADA_LEDGER_NEW', 'ASSESSMENT FEE'),
        'tada_ledger_renewal' => env('BC_TADA_LEDGER_RENEWAL', 'RENEWAL FEE'),

        // GST rate fallback for receipt amounts when the payment breakdown does
        // not carry gstPercentage. Matches FeeConfiguration.gst_percentage (18).
        'gst_rate' => (float) env('BC_GST_RATE', 18),

        // Inbound (BC -> SAMAR) service account the ERP uses to push
        // invoice/receipt PDFs. Provision with `php artisan erp:provision-service-account`.
        'inbound' => [
            'samar_id' => env('BC_INBOUND_SAMAR_ID', 'SAMAR-160726-900'),
            'email' => env('BC_INBOUND_EMAIL', 'erp-integration@webority.dev'),
            'password' => env('BC_INBOUND_PASSWORD'),

            // Access-token lifetime for the ERP machine caller, in minutes.
            // Deliberately separate from the global jwt.ttl (15 min), which
            // governs human sessions and must stay short. Business Central's
            // document sync runs unattended, so a per-batch re-login is
            // impractical for them; 1 day is applied to this account only.
            'token_ttl_minutes' => (int) env('BC_INBOUND_TOKEN_TTL_MINUTES', 1440),
        ],
    ],

];
