---
title: "Support Ticket System (Zoho Desk Integration)"
category: "features"
tags: ["support", "tickets", "zoho-desk", "helpdesk", "integration", "api-proxy"]
related:
  - ../30-api/37-api-reference.md
  - 27-document-management.md
  - 28-notifications.md
code_files:
  - app/Http/Controllers/Api/V1/SupportTicketController.php
  - app/Services/SupportPlatforms/ZohoDeskAdapter.php
  - app/Services/SupportPlatforms/ZohoOAuthService.php
  - app/Contracts/SupportPlatformInterface.php
  - app/Providers/SupportPlatformServiceProvider.php
  - app/Http/Requests/Api/V1/Ticket/StoreTicketRequest.php
  - app/Http/Requests/Api/V1/Ticket/UpdateTicketRequest.php
last_updated: "2026-07-22"
version: "3.2"
---

# Support Ticket System (Zoho Desk Integration)

**Location**: `docs/20-features/33-support-tickets.md`
**Related**: [API Reference](../30-api/37-api-reference.md) | [Document Management](27-document-management.md) | [Notifications](28-notifications.md)

## Overview

The QCI Samar support ticket system provides **direct integration with Zoho Desk (India region)**, acting as an API proxy layer. All ticket data lives in Zoho Desk - there is no local database storage. Every operation (create, read, update, delete) communicates directly with the Zoho Desk API in real-time.

This integration is specifically configured for the **NDIE Department** in Zoho Desk, with custom fields required per the official SAMAR-ZOHODESK INTEGRATION API DOCUMENTATION.

**Key Characteristics**:
- **No Local Storage**: No database tables, models, or migrations for tickets
- **Real-Time Integration**: All operations hit Zoho Desk API immediately
- **API Proxy Pattern**: Controller acts as a secure gateway to Zoho Desk
- **NDIE Department**: Configured for NDIE department with mandatory custom fields
- **Contact Management**: Automatic contact creation/retrieval by email
- **Organization Segregation**: Tickets are segregated by organization for data isolation
- **Platform Agnostic**: Interface-based design allows swapping to other platforms (Zendesk, Freshdesk)
- **Secure by Design**: Input sanitization, file validation, timeout handling, retry logic

## Business Value

- **Real-Time Integration**: Immediate synchronization with Zoho Desk - no sync delays or conflicts
- **Simplified Architecture**: No database sync complexity, queue jobs, or state management
- **Centralized Data**: Single source of truth in Zoho Desk for all support operations
- **Organization Segregation**: Complete data isolation between organizations for security and compliance
- **File Attachments**: Secure document upload with comprehensive validation
- **Priority Management**: Track urgent vs routine issues with SLA-based priority levels
- **Role-Based Access**: Fine-grained authorization for ticket operations
- **Enterprise Ready**: Retry logic, timeout handling, comprehensive logging

## Organization Segregation

**NEW FEATURE**: Tickets are now automatically segregated by organization to ensure complete data isolation.

### How It Works

When a user creates a support ticket:
1. **Automatic Population**: The system automatically populates `organisation_id` and `organisation_name` from the authenticated user's organization
2. **Custom Field Storage**: Organization data is stored in Zoho Desk as custom fields (`cf_organisation_id`)
3. **Access Control**: Users can ONLY access tickets that match BOTH:
   - Their email address (ticket ownership)
   - Their organization ID (organization segregation)

### Benefits

- **Data Isolation**: Users from Organization A cannot see or access tickets from Organization B
- **Security**: Prevents unauthorized cross-organization data access
- **Compliance**: Ensures data privacy and tenant isolation requirements are met
- **Automatic**: No manual configuration needed - works automatically based on user's organization

### Authorization Rules

**Non-Admin Users**:
- Can ONLY see tickets created with their email address
- Can ONLY access tickets from their own organization
- Both conditions must match for access

**Admin Users** (system_admin, operations_manager, operations_admin):
- Can access ALL tickets across all organizations
- Organization filter does not apply to admin users

**Legacy Tickets**:
- Tickets created before this feature (without `organisation_id`) remain accessible if email matches
- Provides backward compatibility with existing tickets
- New tickets always include organization segregation

### Implementation Details

**Auto-Populated Fields**:
- `organisation_id`: Automatically set from `user.organization_id`
- `organisation_name`: Automatically set from `user.organization.name`
- These fields are NOT accepted in the request body - they are server-side populated

**Zoho Desk Custom Field**:
- `cf_organisation_id`: Stores the organization ID for filtering and segregation
- Stored as string in Zoho Desk for compatibility

**Filtering Logic**:
- List endpoint: Filters by email AND organization_id for non-admin users
- View endpoint: Checks both email ownership AND organization match
- Admin users: Bypass organization filter (can see all tickets)

## Key Features

### 1. Real-Time Operations

The API exposes exactly four ticket operations, all of which hit the Zoho Desk API immediately:
- **Create Ticket**: POST to Zoho Desk API with contact creation, return ticket ID immediately (attachments may be included inline at creation time)
- **List Tickets**: Query Zoho Desk with filters, pagination
- **Get Ticket Details**: Fetch from Zoho Desk with comments
- **Update Ticket**: PATCH to Zoho Desk (status, priority, assignment) — closing is done here by setting `status: closed`

There is **no** reply/comment endpoint, no post-creation attachment endpoint, and no dedicated close endpoint. Replying to and closing a ticket are done by agents in the **Zoho Desk agent console**, not through this API.

### 2. Contact Management Flow

Per SAMAR-ZOHODESK documentation, ticket creation requires a contact:

```
1. Search for existing contact by email → GET /contacts?email={email}
2. If found → Use existing contactId
3. If not found → Create new contact → POST /contacts
4. Use contactId to create ticket → POST /tickets
```

**Contact Fields**:
- **email** (required): User's email address
- **lastName** (required): User's last name or "User" if not available
- **firstName** (optional): User's first name
- **phone** (optional): User's phone number
- **mobile** (optional): User's mobile number
- **ownerId** (optional): Default owner from configuration

### 3. NDIE Department Custom Fields

Per SAMAR-ZOHODESK documentation, the NDIE Department requires specific custom fields:

**Mandatory Custom Fields**:
- `cf_user_role`: User role (e.g., "MSME", "Consultant", "Government")
- `cf_issue_category`: Issue category (e.g., "Against Consultant Organisations")
- `cf_issue_type`: Issue type (e.g., "Complaint", "Query")
- `cf_issue_sub_category`: Issue sub-category (e.g., "Lack of systems")

**Auto-Populated Custom Fields** (for organization segregation):
- `cf_organisation_id`: Organization ID from authenticated user's organization (server-side populated)
- `cf_organisation_name`: Organisation name from authenticated user's organization (server-side populated)

**Optional Custom Fields**:
- `cf_udyam_number`: Udyam registration number

All custom fields are sent in the `cf` object when creating tickets.

> **Important**: `organisation_id` and `organisation_name` are automatically populated from the authenticated user's organization and are NOT accepted in the request body. This ensures proper organization segregation and prevents users from creating tickets for other organizations.

### 4. Security Features

- **Input Sanitization**: All user inputs sanitized with `strip_tags()` to prevent XSS attacks
- **File Upload Validation**:
  - Maximum file size: 10MB
  - Allowed MIME types: PDF, JPEG, PNG, GIF, Word documents, plain text
  - Document ownership verification (users can only attach their own documents)
- **Timeout Configuration**: 30-second timeout with 10-second connection timeout
- **Retry Logic**: Automatic retry (3 attempts) with exponential backoff on transient failures
- **Ticket ID Validation**: Only numeric ticket IDs accepted
- **Log Security**: API tokens and personally identifiable information removed from all logs
- **Authorization Checks**: Role-based and ownership-based access control

### 5. Priority Levels

| Priority | SLA Response Time | Use Case | Zoho Desk Mapping |
|----------|------------------|----------|-------------------|
| **low** | 72 hours | General inquiries, feature requests | Low |
| **medium** | 24 hours | Non-critical issues | Medium |
| **high** | 4 hours | Critical functionality affected | High |
| **urgent** | 1 hour | System down, payment issues | Critical |

### 6. Status Workflow

`UpdateTicketRequest` accepts a different status set than `ZohoDeskAdapter` knows how to map — a real gap, not a doc typo:

- **`PUT /support/tickets/{id}` accepts**: `open, in_progress, pending_customer, pending_internal, resolved, closed`
- **`ZohoDeskAdapter::mapStatusToZohoHelp()` only recognizes**: `open, in_progress, waiting_for_response, resolved, closed` — anything else (including `pending_customer`/`pending_internal`) falls through to its `default => 'Open'`, so setting those two statuses silently reopens the ticket in Zoho Desk instead of doing what the name implies.

**Status Descriptions** (the set the adapter actually maps):
- **open**: New ticket, awaiting assignment (Zoho Desk: "Open")
- **in_progress**: Assigned and being worked on (Zoho Desk: "In Progress")
- **waiting_for_response**: Awaiting customer response (Zoho Desk: "Waiting on Customer") — accepted by the adapter, but **not** in `UpdateTicketRequest`'s allowed list, so it can't actually be set through the API today
- **resolved**: Issue resolved, awaiting closure (Zoho Desk: "Resolved")
- **closed**: Ticket closed - final state (Zoho Desk: "Closed")

## User Guide

### Creating a Ticket

> **Note**: `organisation_name` and `organisation_id` are automatically populated from the authenticated user's organization and should NOT be included in the request body.

```bash
curl -X POST https://api.example.com/api/v1/support/tickets \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Unable to submit application",
    "description": "Getting error when trying to submit application APP-2025-001",
    "priority": "high",
    "user_role": "MSME",
    "issue_category": "Against Consultant Organisations",
    "issue_type": "Complaint",
    "issue_sub_category": "Lack of systems",
    "udyam_number": "UDYAM-XX-00-0000000"
  }'
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Support ticket created successfully",
  "data": {
    "id": "185393000002655001",
    "ticket_number": "25134",
    "subject": "Unable to submit application",
    "description": "Getting error when trying to submit application APP-2025-001",
    "status": "open",
    "priority": "high",
    "channel": "Web",
    "department_id": "185393000001510116",
    "created_at": "2025-01-21T10:00:00.000Z",
    "updated_at": "2025-01-21T10:00:00.000Z",
    "closed_at": null,
    "due_date": null,
    "contact": {
      "id": "185393000002655002",
      "email": "john@example.com",
      "phone": null
    },
    "assignee": {
      "id": null,
      "email": null,
      "name": null
    },
    "custom_fields": {
      "user_role": "MSME",
      "organisation_id": "123",
      "organisation_name": "QCI",
      "issue_category": "Against Consultant Organisations",
      "issue_type": "Complaint",
      "issue_sub_category": "Lack of systems",
      "udyam_number": "UDYAM-XX-00-0000000"
    },
    "web_url": "https://desk.zoho.in/support/qci/ShowHomePage.do#Cases/dv/185393000002655001"
  }
}
```

> **Note**: The `organisation_id` and `organisation_name` in the response are automatically populated from the authenticated user's organization profile.

### Listing Tickets

```bash
curl -X GET "https://api.example.com/api/v1/support/tickets?status=open&priority=high&per_page=20&page=1" \
  -H "Authorization: Bearer {token}"
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Support tickets retrieved successfully",
  "data": {
    "data": [
      {
        "id": "185393000002655001",
        "ticket_number": "25134",
        "subject": "Unable to submit application",
        "status": "open",
        "priority": "high",
        "channel": "Web",
        "department_id": "185393000001510116",
        "contact": {
          "id": "185393000002655002",
          "email": "john@example.com",
          "phone": null
        },
        "created_at": "2025-01-21T10:00:00.000Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total": 45,
      "from": 0,
      "has_more": true
    }
  }
}
```

### Viewing Ticket Details

```bash
curl -X GET https://api.example.com/api/v1/support/tickets/185393000002655001 \
  -H "Authorization: Bearer {token}"
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Support ticket retrieved successfully",
  "data": {
    "id": "185393000002655001",
    "ticket_number": "25134",
    "subject": "Unable to submit application",
    "description": "Getting error when trying to submit application APP-2025-001",
    "status": "open",
    "priority": "high",
    "channel": "Web",
    "department_id": "185393000001510116",
    "created_at": "2025-01-21T10:00:00.000Z",
    "updated_at": "2025-01-21T10:15:00.000Z",
    "closed_at": null,
    "due_date": null,
    "contact": {
      "id": "185393000002655002",
      "email": "john@example.com",
      "phone": null
    },
    "assignee": {
      "id": "185393000000278043",
      "email": "support@example.com",
      "name": "Support Agent"
    },
    "custom_fields": {
      "user_role": "MSME",
      "organisation_name": "QCI",
      "issue_category": "Against Consultant Organisations",
      "issue_type": "Complaint",
      "issue_sub_category": "Lack of systems",
      "udyam_number": "UDYAM-XX-00-0000000"
    },
    "web_url": "https://desk.zoho.in/support/qci/ShowHomePage.do#Cases/dv/185393000002655001",
    "comments": [
      {
        "id": "987654321",
        "content": "We're looking into this issue",
        "is_internal": false,
        "author_email": "support@example.com",
        "author_name": "Support Agent",
        "created_at": "2025-01-21T10:15:00.000Z"
      }
    ]
  }
}
```

> There is no comment/reply endpoint and no post-creation attachment endpoint — `POST /support/tickets/{id}/comments` and `POST /support/tickets/{id}/attachments` do not exist in `routes/api.php`. `AddCommentRequest`/`AddAttachmentRequest` FormRequest classes exist in the codebase but aren't referenced by any route or controller method; `SupportTicketController` has no `addComment`/`addAttachment`/`close` methods (only `index`, `store`, `show`, `update`, plus the private `userCanAccessTicket`/`handleTicketAttachments` helpers). File attachments are only possible **at ticket-creation time** via the `attachments[]` multipart field on `POST /support/tickets` (raw file upload, not a reference to an existing `documents` row).

### Updating Ticket (Admin Only)

```bash
curl -X PUT https://api.example.com/api/v1/support/tickets/185393000002655001 \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress",
    "priority": "urgent",
    "assigned_to_email": "agent@example.com"
  }'
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Support ticket updated successfully",
  "data": {
    "id": "185393000002655001",
    "status": "in_progress",
    "priority": "urgent",
    "assignee": {
      "email": "agent@example.com",
      "name": "Agent Name"
    }
  }
}
```

There is no dedicated close endpoint — closing is done via `PUT /support/tickets/{id}` with `"status": "closed"` (admin roles only).

## Technical Details

### Architecture

**System Flow**:
```
User Request (API Call)
    ↓
API Controller (SupportTicketController)
    ↓ [Authorization & Validation]
ZohoDeskAdapter (implements SupportPlatformInterface)
    ↓ [Contact Resolution: Search/Create Contact]
    ↓ [HTTP Request with Retry Logic]
HTTP Client (Laravel HTTP Client)
    ↓ [30s timeout, 10s connect timeout]
Zoho Desk API (https://desk.zoho.in/api/v1)
```

**No Local Storage**:
- No database tables
- No Eloquent models
- No queue jobs
- No sync status tracking
- No webhook handlers

All data lives in Zoho Desk. The controller acts as a secure proxy layer.

### Components

#### Controller: SupportTicketController

**File**: [`app/Http/Controllers/Api/V1/SupportTicketController.php`](../../app/Http/Controllers/Api/V1/SupportTicketController.php)

**Responsibilities**:
- API endpoint handler (proxy layer)
- Request validation
- Role-based authorization (system_admin, operations_manager, operations_admin)
- Ownership-based authorization (users can access their own tickets)
- Delegates all operations to `SupportPlatformInterface`

**Key Methods** (only these exist — no `close`, `addComment`, or `addAttachment` controller methods):
- `index(Request)`: List tickets with filters and pagination
- `store(StoreTicketRequest)`: Create new ticket with NDIE custom fields (accepts optional `attachments[]` files inline)
- `show(Request, string)`: Get ticket details with comments
- `update(UpdateTicketRequest, string)`: Update ticket (admin only) — this is also how a ticket is closed (`status: closed`)
- `userCanAccessTicket()` / `handleTicketAttachments()`: private helpers, not routes

**Authorization Rules**:
- **Listing Tickets**: Non-admin users can only see tickets matching BOTH their email AND their organization
- **Viewing Ticket**: User must own the ticket (email match) AND belong to the same organization OR be an admin
- **Updating/Closing Ticket**: Admin roles only (system_admin, operations_manager, operations_admin) — enforced by both the route middleware and `UpdateTicketRequest::authorize()`

**Organization Segregation**:
- Non-admin users can ONLY access tickets from their own organization
- Admin users (system_admin, operations_manager, operations_admin) can access ALL tickets across all organizations
- Legacy tickets (created before organization segregation) without `organisation_id` allow email-only access for backward compatibility

#### OAuth Service: ZohoOAuthService

**File**: [`app/Services/SupportPlatforms/ZohoOAuthService.php`](../../app/Services/SupportPlatforms/ZohoOAuthService.php)

**Responsibilities**:
- Manages OAuth 2.0 authentication with Zoho Desk
- Automatically refreshes access tokens using refresh token grant
- Caches access tokens to minimize API calls to Zoho auth server
- Handles token expiry (refreshes 5 minutes before expiry)
- Provides token validation and testing functionality
- Logs all OAuth operations (success/failure)

**Key Methods**:
- `getAccessToken()`: Get valid access token (auto-refreshes if expired)
- `refreshAccessToken()`: Force refresh access token using refresh token
- `hasValidCredentials()`: Check if OAuth credentials are configured
- `clearCache()`: Clear cached access token (useful for testing/forced refresh)
- `testConnection()`: Test OAuth configuration by obtaining token

**Token Management**:
- Cache key: `zoho_desk_access_token`
- Token buffer: 300 seconds (5 minutes before expiry)
- Minimum cache duration: 60 seconds
- Default token lifetime: 3600 seconds (1 hour)
- Automatic cache invalidation on invalid refresh token

**Error Handling**:
- Detects invalid/expired refresh tokens
- Logs critical errors for manual intervention
- Handles network timeouts (30-second timeout)
- Provides detailed error messages for troubleshooting

#### Adapter: ZohoDeskAdapter

**File**: [`app/Services/SupportPlatforms/ZohoDeskAdapter.php`](../../app/Services/SupportPlatforms/ZohoDeskAdapter.php)

**Responsibilities**:
- Implements `SupportPlatformInterface`
- Makes real HTTP calls to Zoho Desk API (India region)
- Uses `ZohoOAuthService` for authentication (OAuth 2.0)
- Manages contact creation/retrieval flow
- Maps internal data structures to Zoho Desk format
- Adds NDIE Department custom fields
- Handles retry logic with exponential backoff (3 attempts)
- Manages timeout configuration (30s timeout, 10s connect timeout)
- Sanitizes user input (strip_tags on subject and description)
- Logs all API interactions (without sensitive data)

**Key Methods** (all real; several are unreachable from the current API since the controller has no route to them):
- `createTicket(array)`: Create ticket in Zoho Desk with contact resolution — used
- `resolveContactId(array)` / `createOrGetContact(array)` / `searchContactByEmail(string)`: contact resolution — used
- `addCustomFields(array, array)`: Add NDIE Department custom fields — used
- `updateTicket(string, array)`: Update ticket in Zoho Desk — used (via `PUT /support/tickets/{id}`)
- `getTicket(string)` / `listTickets(array)` / `getTicketComments(string)`: used
- `addComment(string, string, bool)`, `addAttachment(string, string, string)`, `closeTicket(string, ?string)`, `assignTicket(string, string)`: implemented but **not called by any controller method or route** — dead capability from the controller's perspective. Closing a ticket via the API goes through `update()` → `updateTicket()` with `status: closed`, not through `closeTicket()`.
- `testConnection()` / `isEnabled()`: used for health checks

**Contact Resolution Flow**:
1. Check if `contact_id` provided in data → Use it
2. If not, check if `user_email` provided
3. Search for existing contact by email → `GET /contacts?email={email}`
4. If found → Return contactId
5. If not found → Create contact → `POST /contacts` with email, lastName (required), firstName, phone, mobile (optional)
6. Return contactId for ticket creation

**Retry Logic**:
- Maximum 3 attempts per request
- Exponential backoff: 200ms, 400ms, 800ms
- Only retries on server errors (5xx) or connection exceptions
- Client errors (4xx) are not retried

**Status/Priority Mapping**:
- Internal values mapped to Zoho Desk values bidirectionally
- Example: `urgent` → `Critical`, `Critical` → `urgent`

#### Interface: SupportPlatformInterface

**File**: [`app/Contracts/SupportPlatformInterface.php`](../../app/Contracts/SupportPlatformInterface.php)

**Purpose**: Define contract for support platform integrations

**Methods**:
- `createTicket(array): ?string`
- `updateTicket(string, array): bool`
- `getTicket(string): ?array`
- `listTickets(array): array`
- `addComment(string, string, bool): ?string`
- `addAttachment(string, string, string): bool`
- `closeTicket(string, ?string): bool`
- `assignTicket(string, string): bool`
- `getTicketStatus(string): array`
- `syncTicket(string): array`
- `getTicketComments(string): array`
- `getPlatformName(): string`
- `isEnabled(): bool`
- `testConnection(): bool`

**Design Pattern**: Interface allows swapping to other platforms (Zendesk, Freshdesk, etc.) without changing controller code.

#### Service Provider: SupportPlatformServiceProvider

**File**: [`app/Providers/SupportPlatformServiceProvider.php`](../../app/Providers/SupportPlatformServiceProvider.php)

**Responsibilities**:
- Binds `SupportPlatformInterface` to `ZohoDeskAdapter`
- Singleton binding for dependency injection
- Auto-discovered by Laravel

**Future Enhancement**: Can be made configurable to support multiple platforms via config.

#### Form Request: StoreTicketRequest

**File**: [`app/Http/Requests/Api/V1/Ticket/StoreTicketRequest.php`](../../app/Http/Requests/Api/V1/Ticket/StoreTicketRequest.php)

**Validation Rules** (per SAMAR-ZOHODESK documentation):

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| subject | string | Yes | max:255 |
| description | string | Yes | - |
| priority | string | No | in:low,medium,high,urgent |
| user_role | string | Yes | max:100 (NDIE mandatory) |
| issue_category | string | Yes | max:100 (NDIE mandatory) |
| issue_type | string | Yes | max:100 (NDIE mandatory) |
| issue_sub_category | string | Yes | max:100 (NDIE mandatory) |
| udyam_number | string | No | max:50 (NDIE optional) |
| attachments[] | file array | No | max 5 files, 10MB each, mimes: pdf,jpeg,jpg,png,gif,doc,docx,txt |

`organisation_name`/`organisation_id` are **not** validated request fields — they're server-populated from `$user->organization` and rejected as no-ops if sent.

## Authentication

### OAuth 2.0 Configuration

The integration uses **OAuth 2.0 with automatic token refresh** for secure authentication with Zoho Desk. Access tokens are automatically refreshed when they expire and cached to minimize API calls.

**Key Features**:
- **Automatic Token Refresh**: Access tokens automatically refresh 5 minutes before expiry
- **Token Caching**: Tokens cached in Laravel cache to minimize auth API calls
- **Error Handling**: Comprehensive error handling for expired/invalid refresh tokens
- **Secure Credential Storage**: Sensitive credentials stored in environment variables

### OAuth Setup Steps

#### 1. Register a Self-Client Application

1. Go to **Zoho API Console**: https://api-console.zoho.in/
2. Click **Add Client** → Select **Self-Client**
3. Note your **Client ID** and **Client Secret**

#### 2. Generate Refresh Token

Generate a refresh token with the following scopes:
- `Desk.tickets.ALL` - Full access to tickets
- `Desk.contacts.ALL` - Full access to contacts
- `Desk.basic.ALL` - Basic Zoho Desk access

**Using Zoho API Console**:
1. In your Self-Client, go to **Generate Code** tab
2. Select scopes: `Desk.tickets.ALL,Desk.contacts.ALL,Desk.basic.ALL`
3. Set **Time Duration**: 10 minutes
4. Click **Create** → Copy the authorization code
5. Use the code to get refresh token via API:

```bash
curl -X POST "https://accounts.zoho.in/oauth/v2/token" \
  -d "grant_type=authorization_code" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=YOUR_AUTHORIZATION_CODE"
```

Response will include `refresh_token` - **save this value** (it's long-lived).

#### 3. Configure Environment Variables

Add to `.env`:
```env
# Zoho Desk Configuration (India Region - NDIE Department)
ZOHO_DESK_ENABLED=true
ZOHO_DESK_ORG_ID=60037449308
ZOHO_DESK_BASE_URL=https://desk.zoho.in/api/v1
ZOHO_DESK_DEPARTMENT_ID=185393000001510116
ZOHO_DESK_OWNER_ID=185393000000278043

# OAuth 2.0 Configuration (India Region)
ZOHO_DESK_CLIENT_ID=your_client_id
ZOHO_DESK_CLIENT_SECRET=your_client_secret
ZOHO_DESK_REFRESH_TOKEN=your_refresh_token
ZOHO_DESK_TOKEN_URL=https://accounts.zoho.in/oauth/v2/token
```

> **Important**: The old `ZOHO_DESK_API_TOKEN` environment variable is no longer used. Use OAuth 2.0 credentials instead.

**Variable Descriptions**:
- `ZOHO_DESK_ENABLED`: Master switch to enable/disable integration (default: `false`)
- `ZOHO_DESK_ORG_ID`: Your Zoho Desk organization ID (required)
- `ZOHO_DESK_BASE_URL`: API base URL for India region (default: `https://desk.zoho.in/api/v1`)
- `ZOHO_DESK_DEPARTMENT_ID`: NDIE Department ID for ticket routing (required)
- `ZOHO_DESK_OWNER_ID`: Default owner ID for new contacts (optional)
- `ZOHO_DESK_CLIENT_ID`: OAuth client ID from Zoho API Console (required)
- `ZOHO_DESK_CLIENT_SECRET`: OAuth client secret (required)
- `ZOHO_DESK_REFRESH_TOKEN`: Long-lived refresh token (required)
- `ZOHO_DESK_TOKEN_URL`: OAuth token endpoint (default: `https://accounts.zoho.in/oauth/v2/token`)

#### 4. Test OAuth Connection

Test your OAuth configuration:

```bash
php artisan tinker
```

```php
use App\Services\SupportPlatforms\ZohoOAuthService;

$oauth = app(ZohoOAuthService::class);
$result = $oauth->testConnection();

// Check result
if ($result['success']) {
    echo "OAuth connected successfully!\n";
    echo "Token preview: " . $result['token_preview'] . "\n";
} else {
    echo "OAuth connection failed: " . $result['message'] . "\n";
}
```

### Token Management

The `ZohoOAuthService` class handles all OAuth operations:

**Get Access Token** (automatically refreshes if needed):
```php
use App\Services\SupportPlatforms\ZohoOAuthService;

$oauth = app(ZohoOAuthService::class);
$accessToken = $oauth->getAccessToken();

if ($accessToken) {
    // Use token for Zoho Desk API calls
    $response = Http::withToken($accessToken)
        ->withHeader('orgId', config('services.zoho_desk.org_id'))
        ->get('https://desk.zoho.in/api/v1/tickets');
}
```

**Force Refresh Token**:
```php
$oauth = app(ZohoOAuthService::class);
$newToken = $oauth->refreshAccessToken();
```

**Clear Token Cache**:
```php
$oauth = app(ZohoOAuthService::class);
$oauth->clearCache(); // Forces token refresh on next request
```

**Token Refresh Behavior**:
- Tokens are cached for their lifetime minus 5-minute buffer
- Automatic refresh happens on next `getAccessToken()` call after expiry
- Minimum cache duration: 60 seconds
- Default token lifetime: 3600 seconds (1 hour)

### OAuth Error Handling

**Common OAuth Errors**:

| Error Code | Description | Solution |
|------------|-------------|----------|
| `invalid_code` | Authorization code expired or invalid | Regenerate authorization code and refresh token |
| `invalid_client` | Client ID or secret incorrect | Verify credentials in Zoho API Console |
| `invalid_grant` | Refresh token expired or revoked | Generate new refresh token |
| No credentials | Environment variables not set | Configure all required OAuth variables |

**Error Logging**:
- All OAuth errors logged to `storage/logs/laravel.log`
- Critical errors (invalid refresh token) logged with `Log::critical()`
- Successful token refreshes logged with expiry time

**Handling Invalid Refresh Tokens**:
If refresh token becomes invalid:
1. Cache is automatically cleared
2. Critical log entry created: "Zoho refresh token may be invalid or expired. Manual intervention required."
3. Generate new refresh token using OAuth setup steps above
4. Update `ZOHO_DESK_REFRESH_TOKEN` in `.env`
5. Clear Laravel config cache: `php artisan config:clear`

## Configuration

### Service Configuration

**File**: [`config/services.php`](../../config/services.php)

```php
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
```

### HTTP Client Configuration

**Timeouts**:
- Request timeout: 30 seconds
- Connection timeout: 10 seconds

**Retry Configuration**:
- Maximum attempts: 3
- Backoff strategy: Exponential (200ms, 400ms, 800ms)
- Retry conditions: Connection exceptions and server errors (5xx)

## Zoho Desk Integration

### API Endpoints Used

**Zoho Desk API v1** (https://desk.zoho.in/api/v1):
- `POST /contacts` - Create new contact
- `GET /contacts?email={email}` - Search contact by email
- `POST /tickets` - Create new ticket with custom fields
- `GET /tickets` - List tickets with filters
- `GET /tickets/{id}` - Get ticket details
- `PATCH /tickets/{id}` - Update ticket
- `POST /tickets/{id}/threads` - Add comment
- `GET /tickets/{id}/threads` - Get comments
- `POST /tickets/{id}/attachments` - Upload attachment

### Status Mapping

| Local Status | Zoho Desk Status |
|--------------|------------------|
| open | Open |
| in_progress | In Progress |
| waiting_for_response | Waiting on Customer |
| resolved | Resolved |
| closed | Closed |

### Priority Mapping

| Local Priority | Zoho Desk Priority |
|----------------|-------------------|
| low | Low |
| medium | Medium |
| high | High |
| urgent | Critical |

## Security Features

### Input Sanitization

All user inputs are sanitized to prevent XSS attacks:
```php
$payload = [
    'subject' => strip_tags($data['subject'] ?? ''),
    'description' => strip_tags($data['description'] ?? ''),
    // ...
];
```

**What is sanitized**:
- Ticket subject
- Ticket description
- Comment text

**What is NOT sanitized** (validated instead):
- Email addresses
- Priority/status (validated against allowed values)
- Ticket IDs (numeric validation)
- Custom fields (max length validation)

### File Upload Validation

**Maximum File Size**: 10MB (10,485,760 bytes)

**Allowed MIME Types**:
- `application/pdf` - PDF documents
- `image/jpeg` - JPEG images
- `image/png` - PNG images
- `image/gif` - GIF images
- `application/msword` - Word documents (.doc)
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` - Word documents (.docx)
- `text/plain` - Plain text files

**Document Ownership**:
- Users can only attach documents they own (`uploaded_by` field matches user ID)
- Admins can attach any document

### Timeout Configuration

**Request Timeout**: 30 seconds
- Prevents hanging requests
- Returns error after 30 seconds if no response

**Connection Timeout**: 10 seconds
- Prevents long connection establishment delays
- Returns error after 10 seconds if cannot connect

### Retry Logic

**Strategy**: Exponential backoff with 3 attempts

**Retry Conditions**:
- Connection exceptions (network issues)
- Server errors (5xx status codes)

**Backoff Delays**:
- Attempt 1 → Attempt 2: 200ms delay
- Attempt 2 → Attempt 3: 400ms delay
- Attempt 3 → Failure: No more retries

**Not Retried**:
- Client errors (4xx) - invalid requests won't succeed on retry
- Authentication failures (401) - credentials need to be fixed

### Ticket ID Validation

Only numeric ticket IDs accepted:
```php
if (!is_numeric($id) || $id <= 0) {
    return $this->errorResponse('Invalid ticket ID format', 400);
}
```

### Log Security

**What is logged**:
- Ticket ID
- User ID
- Operation type (create, update, close, etc.)
- Success/failure status
- Error messages

**What is NOT logged**:
- API tokens
- Full email addresses (except when necessary for debugging)
- Personally identifiable information (PII)
- Full request payloads containing sensitive data

Example secure logging:
```php
Log::info('Support ticket created', [
    'ticket_id' => $ticketId,
    'user_id' => $user->id,
    'subject' => $request->subject, // Safe - no PII
    'user_role' => $request->user_role,
]);
```

## API Reference

### List Tickets

**Endpoint**: `GET /api/v1/support/tickets`

**Authentication**: Required (Bearer token)

**Authorization**: All authenticated users (non-admin users see only their own tickets)

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | No | Filter by status (open, in_progress, waiting_for_response, resolved, closed) |
| priority | string | No | Filter by priority (low, medium, high, urgent) |
| search | string | No | Search in ticket subject and description |
| per_page | integer | No | Items per page (default: 15) |
| page | integer | No | Page number (default: 1) |
| sort_by | string | No | Sort field (e.g., createdTime, modifiedTime) |

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Support tickets retrieved successfully",
  "data": {
    "data": [
      {
        "id": "185393000002655001",
        "ticket_number": "25134",
        "subject": "Ticket subject",
        "status": "open",
        "priority": "high",
        "channel": "Web",
        "contact": {
          "email": "user@example.com"
        },
        "created_at": "2025-01-21T10:00:00.000Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 15,
      "total": 45,
      "from": 0,
      "has_more": true
    }
  }
}
```

**Errors**:
- `401 Unauthorized`: Not authenticated
- `503 Service Unavailable`: Zoho Desk integration disabled or unavailable

---

### Create Ticket

**Endpoint**: `POST /api/v1/support/tickets`

**Authentication**: Required (Bearer token)

**Authorization**: All authenticated users

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| subject | string | Yes | Ticket subject (max 255 characters) |
| description | string | Yes | Detailed description |
| priority | string | No | Priority level (default: medium) |
| user_role | string | Yes | User role (NDIE mandatory) |
| issue_category | string | Yes | Issue category (NDIE mandatory) |
| issue_type | string | Yes | Issue type (NDIE mandatory) |
| issue_sub_category | string | Yes | Issue sub-category (NDIE mandatory) |
| udyam_number | string | No | Udyam number (NDIE optional) |

> **Important**: `organisation_name` and `organisation_id` are automatically populated from the authenticated user's organization and should NOT be included in the request body.

**Validation Rules**:
- `subject`: Required, max 255 characters
- `description`: Required
- `priority`: Must be one of: low, medium, high, urgent
- `user_role`: Required, max 100 characters
- `issue_category`: Required, max 100 characters
- `issue_type`: Required, max 100 characters
- `issue_sub_category`: Required, max 100 characters
- `udyam_number`: Nullable, max 50 characters

**Request Example**:
```json
{
  "subject": "Unable to submit application",
  "description": "Getting error when trying to submit application APP-2025-001",
  "priority": "high",
  "user_role": "MSME",
  "issue_category": "Against Consultant Organisations",
  "issue_type": "Complaint",
  "issue_sub_category": "Lack of systems",
  "udyam_number": "UDYAM-XX-00-0000000"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Support ticket created successfully",
  "data": {
    "id": "185393000002655001",
    "ticket_number": "25134",
    "subject": "Unable to submit application",
    "description": "Getting error when trying to submit application APP-2025-001",
    "status": "open",
    "priority": "high",
    "custom_fields": {
      "user_role": "MSME",
      "organisation_id": "123",
      "organisation_name": "QCI",
      "issue_category": "Against Consultant Organisations",
      "issue_type": "Complaint",
      "issue_sub_category": "Lack of systems",
      "udyam_number": "UDYAM-XX-00-0000000"
    },
    "contact": {
      "email": "user@example.com"
    },
    "created_at": "2025-01-21T10:00:00.000Z"
  }
}
```

> **Note**: The `organisation_id` and `organisation_name` fields in `custom_fields` are auto-populated from the user's organization.

**Errors**:
- `401 Unauthorized`: Not authenticated
- `422 Unprocessable Entity`: Validation failed (missing mandatory custom fields)
- `500 Internal Server Error`: Failed to create ticket in Zoho Desk or contact creation failed
- `503 Service Unavailable`: Zoho Desk integration disabled

---

### Get Ticket Details

**Endpoint**: `GET /api/v1/support/tickets/{id}`

**Authentication**: Required (Bearer token)

**Authorization**: User must own the ticket OR be admin (system_admin, operations_manager, operations_admin)

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Zoho Desk ticket ID (numeric) |

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Support ticket retrieved successfully",
  "data": {
    "id": "185393000002655001",
    "ticket_number": "25134",
    "subject": "Unable to submit application",
    "description": "Getting error when trying to submit application APP-2025-001",
    "status": "open",
    "priority": "high",
    "custom_fields": {
      "user_role": "MSME",
      "organisation_id": "123",
      "organisation_name": "QCI",
      "issue_category": "Against Consultant Organisations",
      "issue_type": "Complaint",
      "issue_sub_category": "Lack of systems",
      "udyam_number": "UDYAM-XX-00-0000000"
    },
    "contact": {
      "email": "user@example.com"
    },
    "comments": [
      {
        "id": "987654321",
        "content": "We're looking into this issue",
        "is_internal": false,
        "author_email": "support@example.com",
        "author_name": "Support Agent",
        "created_at": "2025-01-21T10:15:00.000Z"
      }
    ]
  }
}
```

**Errors**:
- `400 Bad Request`: Invalid ticket ID format (non-numeric)
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: User doesn't own ticket and is not admin
- `404 Not Found`: Ticket not found in Zoho Desk
- `503 Service Unavailable`: Zoho Desk integration disabled

---

### Update Ticket

**Endpoint**: `PUT /api/v1/support/tickets/{id}`

**Authentication**: Required (Bearer token)

**Authorization**: Admin only (system_admin, operations_manager, operations_admin)

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Zoho Desk ticket ID (numeric) |

**Request Body** (all optional):

| Field | Type | Description |
|-------|------|-------------|
| status | string | `UpdateTicketRequest` accepts: open, in_progress, pending_customer, pending_internal, resolved, closed — but see the [Status Workflow](#6-status-workflow) note: `pending_customer`/`pending_internal` aren't recognized by the Zoho mapping and fall back to "Open" |
| priority | string | Priority level (low, medium, high, urgent) |
| assigned_to_email | string | Agent email to assign ticket to — must be an existing user's email (`exists:users,email`) |

**Request Example**:
```json
{
  "status": "in_progress",
  "priority": "urgent",
  "assigned_to_email": "agent@example.com"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Support ticket updated successfully",
  "data": {
    "id": "185393000002655001",
    "status": "in_progress",
    "priority": "urgent",
    "assignee": {
      "email": "agent@example.com",
      "name": "Agent Name"
    }
  }
}
```

**Errors**:
- `400 Bad Request`: Invalid ticket ID format
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not admin
- `404 Not Found`: Ticket not found
- `422 Unprocessable Entity`: Validation failed
- `500 Internal Server Error`: Failed to update ticket
- `503 Service Unavailable`: Zoho Desk integration disabled

---

There is no close/comment/attachment API beyond what's described above — see the note in the User Guide section.

---

## Limitations

### No Offline Access
- All operations require Zoho Desk API availability
- If Zoho Desk is down, ticket operations fail
- No local fallback or caching

**Mitigation**:
- Use retry logic to handle transient failures
- Monitor Zoho Desk status page
- Consider implementing local caching layer (future enhancement)

### Dependent on External Service
- System cannot operate independently
- Subject to Zoho Desk's uptime and maintenance schedules
- Breaking changes in Zoho Desk API affect system

**Mitigation**:
- Subscribe to Zoho Desk API changelog
- Implement version pinning in API URL
- Regular testing of API integration

### Rate Limits
- Subject to Zoho Desk API rate limits
- High-volume operations may be throttled
- No local rate limit tracking

**Mitigation**:
- Implement exponential backoff on 429 errors
- Cache frequently accessed tickets (future enhancement)
- Consider batching operations

### No Custom Ticket Numbers
- Ticket numbers generated by Zoho Desk
- Cannot customize format
- Ticket numbering managed by Zoho Desk

**Alternative**: Use ticket_number field returned by Zoho Desk

### Data Location
- All ticket data stored in Zoho Desk (cloud - India region)
- Data sovereignty depends on Zoho Desk datacenter location
- Cannot enforce local data residency

**Consideration**: Review Zoho Desk's data residency options for compliance

### No Bulk Operations
- No native support for bulk ticket creation/update
- Each operation requires separate API call
- High latency for bulk operations

**Mitigation**: Consider implementing job queue for bulk operations

### No Webhook Support
- No webhook integration for real-time updates
- Cannot receive notifications from Zoho Desk
- Changes in Zoho Desk not automatically reflected

**Note**: Webhook functionality was intentionally removed per official SAMAR-ZOHODESK integration documentation

## Error Handling

### Common Error Scenarios

#### 1. Zoho Desk API Unavailable (503)

**Error Response**:
```json
{
  "success": false,
  "message": "Support ticket system is currently unavailable"
}
```

**Cause**: Cannot connect to Zoho Desk API or integration disabled

**Solution**:
- Check internet connectivity
- Verify Zoho Desk status page: https://status.zoho.com
- Check firewall rules allow HTTPS to desk.zoho.in
- Verify `ZOHO_DESK_ENABLED=true` in `.env`
- Verify API token is not expired

---

#### 2. Authentication Failed (401)

**Error Response**:
```json
{
  "success": false,
  "message": "Failed to retrieve support tickets"
}

// In logs:
"Zoho Desk API client error - error_code: 401"
```

**Cause**: Invalid or expired OAuth credentials

**Solution**:
- Verify `ZOHO_DESK_CLIENT_ID` / `ZOHO_DESK_CLIENT_SECRET` / `ZOHO_DESK_REFRESH_TOKEN` in `.env`
- Use `ZohoOAuthService::testConnection()` to check whether the refresh token is still valid
- Verify `ZOHO_DESK_ORG_ID` is correct

---

#### 3. Missing Mandatory Custom Fields (422)

**Error Response**:
```json
{
  "success": false,
  "message": "Validation error",
  "errors": {
    "user_role": ["User role is required."],
    "issue_category": ["Issue category is required."]
  }
}
```

**Cause**: Missing mandatory NDIE Department custom fields

**Solution**:
- Ensure all mandatory fields are provided: user_role, issue_category, issue_type, issue_sub_category
- Check field values match expected format (max 100 characters)

---

#### 4. Contact Creation Failed (500)

**Error Response**:
```json
{
  "success": false,
  "message": "Failed to create support ticket"
}

// In logs:
"Failed to create/get contact for Zoho Desk ticket"
```

**Cause**: Unable to create or retrieve contact in Zoho Desk

**Solution**:
- Verify user email is valid
- Check Zoho Desk contact creation API is accessible
- Verify `ZOHO_DESK_OWNER_ID` is valid (if configured)
- Check contact email doesn't have special characters

---

#### 5. Rate Limit Exceeded (429)

**Error Response**:
```json
{
  "success": false,
  "message": "Failed to create support ticket"
}

// In logs:
"Zoho Desk API client error - error_code: 429"
```

**Cause**: Too many requests to Zoho Desk API

**Solution**:
- Wait 60 seconds before retrying
- Reduce request frequency
- Implement caching for frequently accessed tickets
- Check for request loops in application code

---

#### 6. File Too Large (422)

**Error Response**:
```json
{
  "success": false,
  "message": "File too large. Maximum size is 10MB.",
  "errors": {}
}
```

**Cause**: Attachment exceeds 10MB limit

**Solution**:
- Compress file (e.g., reduce image quality, compress PDF)
- Split into multiple smaller files
- Use external file sharing service and post link in comment

---

#### 7. Invalid Ticket ID Format (400)

**Error Response**:
```json
{
  "success": false,
  "message": "Invalid ticket ID format"
}
```

**Cause**: Non-numeric ticket ID provided

**Solution**:
- Use the numeric ID returned by Zoho Desk in `data.id` field
- Don't use ticket number (25134) - use ID (185393000002655001)
- Check API response for correct ID format

---

## Troubleshooting

### Connection Test Failed

**Symptoms**:
- All API calls return 503 Service Unavailable
- `testConnection()` returns `false`

**Diagnostic Steps**:

1. **Check Environment Variables**:
   ```bash
   php artisan tinker
   >>> config('services.zoho_desk')
   ```

   Verify all values are present:
   - `enabled` → `true`
   - `org_id` → Not empty
   - `api_token` → Not empty
   - `base_url` → `https://desk.zoho.in/api/v1`

2. **Test Network Connectivity**:
   ```bash
   curl -I https://desk.zoho.in/api/v1/tickets \
     -H "Authorization: Zoho-oauthtoken YOUR_TOKEN" \
     -H "orgId: YOUR_ORG_ID"
   ```

   Should return 200 OK or 401 Unauthorized (not connection error)

3. **Check Logs**:
   ```bash
   tail -f storage/logs/laravel.log | grep "Zoho Desk"
   ```

   Look for error messages with details

4. **Clear Configuration Cache**:
   ```bash
   php artisan config:clear
   php artisan cache:clear
   ```

---

### Tickets Not Appearing

**Symptoms**:
- API call succeeds but returns empty list
- `listTickets()` returns empty array

**Diagnostic Steps**:

1. **Check Email Filter**:
   - Non-admin users only see tickets created with their email
   - Verify tickets exist in Zoho Desk for that email

2. **Check Status Filter**:
   - Remove status filter to see all tickets
   - Try: `GET /api/v1/support/tickets` without query parameters

3. **Verify in Zoho Desk Portal**:
   - Log in to Zoho Desk
   - Check if tickets exist in the portal
   - Verify they're in NDIE Department

4. **Check Organization ID**:
   - Verify `ZOHO_DESK_ORG_ID` matches your account
   - Incorrect ID will return tickets from wrong account or no tickets

---

### File Upload Fails

**Symptoms**:
- `addAttachment()` returns 500 error
- Log shows "Document file not found in storage"

**Diagnostic Steps**:

1. **Check File Exists**:
   ```bash
   php artisan tinker
   >>> $doc = App\Models\Document::find(42);
   >>> Storage::disk($doc->disk)->exists($doc->file_path);
   ```

   Should return `true`

2. **Check File Permissions**:
   ```bash
   ls -la storage/app/documents/
   ```

   Files should be readable by web server user

3. **Check Disk Configuration**:
   - Verify `filesystems.php` has correct disk configuration
   - Check `disk` field in documents table matches configured disk

4. **Check File Size**:
   ```bash
   >>> $doc->size
   ```

   Must be ≤ 10485760 bytes (10MB)

---

### Custom Fields Not Saved

**Symptoms**:
- Ticket created successfully but custom fields are null
- Custom fields not visible in Zoho Desk

**Diagnostic Steps**:

1. **Check Department Configuration**:
   - Verify `ZOHO_DESK_DEPARTMENT_ID` is correct
   - Custom fields are department-specific in Zoho Desk

2. **Verify Custom Field Names**:
   - Check custom field API names in Zoho Desk match `cf_user_role`, `cf_issue_category`, etc.
   - Custom field names are case-sensitive

3. **Check Logs**:
   ```bash
   tail -f storage/logs/laravel.log | grep "custom_fields"
   ```

4. **Verify in Zoho Desk**:
   - Log in to Zoho Desk
   - Go to Setup → Customization → Ticket Fields
   - Verify NDIE Department has these custom fields configured

---

## Alternative Platforms

The adapter pattern allows easy integration with other helpdesk platforms. The interface `SupportPlatformInterface` defines the contract that any platform adapter must implement.

### Zendesk Integration

To integrate with Zendesk:

1. **Create Adapter**:
   ```php
   // app/Services/SupportPlatforms/ZendeskAdapter.php
   namespace App\Services\SupportPlatforms;

   use App\Contracts\SupportPlatformInterface;

   class ZendeskAdapter implements SupportPlatformInterface
   {
       // Implement all interface methods
       // Use Zendesk API v2
   }
   ```

2. **Update Service Provider**:
   ```php
   // app/Providers/SupportPlatformServiceProvider.php
   public function register(): void
   {
       $this->app->singleton(SupportPlatformInterface::class, function ($app) {
           return new ZendeskAdapter();
       });
   }
   ```

3. **Configure Credentials**:
   ```env
   ZENDESK_ENABLED=true
   ZENDESK_SUBDOMAIN=your_subdomain
   ZENDESK_EMAIL=api@example.com
   ZENDESK_API_TOKEN=your_token
   ```

### Freshdesk Integration

Similar approach as Zendesk - implement interface, update service provider, configure credentials.

### Multi-Platform Support (Future)

To support multiple platforms simultaneously:

1. **Add Configuration**:
   ```php
   // config/services.php
   'support_platform' => [
       'default' => env('SUPPORT_PLATFORM', 'zoho_desk'),
   ],
   ```

2. **Update Service Provider**:
   ```php
   public function register(): void
   {
       $this->app->singleton(SupportPlatformInterface::class, function ($app) {
           $platform = config('services.support_platform.default');

           return match ($platform) {
               'zoho_desk' => new ZohoDeskAdapter(),
               'zendesk' => new ZendeskAdapter(),
               'freshdesk' => new FreshdeskAdapter(),
               default => throw new \Exception("Unsupported platform: {$platform}"),
           };
       });
   }
   ```

---

## Testing

### Testing with Disabled Integration

When `ZOHO_DESK_ENABLED=false`:

**Behavior**:
- All ticket operations return 503 error: "Support ticket system is currently unavailable"
- No actual API calls are made
- Useful for local development without credentials

**Use Cases**:
- Local development without Zoho Desk account
- CI/CD pipelines without credentials
- Feature flag to temporarily disable tickets

---

### Testing with Zoho Desk Sandbox

1. **Create Sandbox Account**:
   - Sign up for Zoho Desk free trial or sandbox account
   - Use separate credentials from production

2. **Update Environment**:
   ```env
   ZOHO_DESK_ENABLED=true
   ZOHO_DESK_ORG_ID=sandbox_org_id
   ZOHO_DESK_CLIENT_ID=sandbox_client_id
   ZOHO_DESK_CLIENT_SECRET=sandbox_client_secret
   ZOHO_DESK_REFRESH_TOKEN=sandbox_refresh_token
   ZOHO_DESK_BASE_URL=https://desk.zoho.in/api/v1
   ZOHO_DESK_DEPARTMENT_ID=sandbox_dept_id
   ```

3. **Test All Operations**:
   - Create ticket
   - List tickets
   - Get ticket details
   - Update ticket (admin only) — including closing via `status: closed`

4. **Verify in Zoho Desk Portal**:
   - Log in to sandbox portal
   - Navigate to Tickets section
   - Verify all operations reflected correctly
   - Check custom fields are populated

---

## Code References

**Main Controller**: [`SupportTicketController`](../../app/Http/Controllers/Api/V1/SupportTicketController.php)
**Adapter**: [`ZohoDeskAdapter`](../../app/Services/SupportPlatforms/ZohoDeskAdapter.php)
**OAuth Service**: [`ZohoOAuthService`](../../app/Services/SupportPlatforms/ZohoOAuthService.php)
**Interface**: [`SupportPlatformInterface`](../../app/Contracts/SupportPlatformInterface.php)
**Service Provider**: [`SupportPlatformServiceProvider`](../../app/Providers/SupportPlatformServiceProvider.php)
**Form Requests**:
  - [`StoreTicketRequest`](../../app/Http/Requests/Api/V1/Ticket/StoreTicketRequest.php) — used by `POST /support/tickets`
  - [`UpdateTicketRequest`](../../app/Http/Requests/Api/V1/Ticket/UpdateTicketRequest.php) — used by `PUT /support/tickets/{id}`
**Configuration**: [`config/services.php`](../../config/services.php)
**Routes**: [`routes/api.php`](../../routes/api.php) (`support/tickets` prefix)

---

## See Also

- [API Reference](../30-api/37-api-reference.md) - Complete API documentation
- [Document Management](27-document-management.md) - Attaching documents to tickets
- [Notifications](28-notifications.md) - Ticket notifications (email)
- [Authorization & RBAC](22-authorization-rbac.md) - Role-based access control

