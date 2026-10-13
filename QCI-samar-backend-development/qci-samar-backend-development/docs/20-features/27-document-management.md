---
title: "Document Management System"
category: "features"
tags: ["documents", "file-upload", "storage", "security"]
related:
  - ../30-api/37-api-reference.md
  - 29-audit-trail.md
  - ../10-architecture/12-database-schema.md
code_files:
  - app/Services/DocumentService.php
  - app/Http/Controllers/Api/V1/DocumentController.php
  - app/Models/Document.php
  - config/documents.php
last_updated: "2025-01-05"
version: "1.0"
---

# Document Management System

**Location**: `docs/20-features/27-document-management.md`
**Related**: [API Reference](../30-api/37-api-reference.md) | [Audit Trail](29-audit-trail.md) | [Database Schema](../10-architecture/12-database-schema.md)

## Overview

The Document Management System provides secure, scalable file upload, storage, and management capabilities with comprehensive security features for the QCI SAMAR Certification Portal. The system handles various document types required throughout the certification lifecycle with role-based access control and audit trail integration.

## Business Value

- **Secure Storage**: Whitelist-based validation (MIME type + extension), UUID-based naming
- **Access Control**: Admin roles have full access; uploaders can manage their own documents
- **Audit Compliance**: Uploads/updates/deletions tracked via the audit trail (`Document` is an audited model); downloads are recorded in application logs only
- **Scalability**: Cloud storage ready (S3 disk configured in `config/filesystems.php`)

## Key Features

### 1. File Upload & Validation

- **Single-file upload** via `POST /api/v1/documents` (accepts PDF only)
- **Whitelist validation**: `config/documents.php` allows a broader set (PDF, JPG, JPEG, PNG, DOC, DOCX, XLS, XLSX, ZIP) used by other callers (e.g. ERP), but the standard upload endpoint restricts to PDF
- **Size limits**: Configurable (default 50MB per file)
- **Extension check**: Double validation (MIME type + extension)

### 2. Secure Storage

- **UUID-based naming**: Prevents directory traversal and overwrite attacks
- **Organized structure**: Year/month directory organization
- **Private visibility**: Files not publicly accessible
- **Cloud-ready**: Supports local and S3 storage (`config/filesystems.php`)

### 3. Access Control

- **Policy-based authorization** (`DocumentPolicy`): admin roles (System Admin, Operations Admin, Operations Manager, DRDO Admin) can access any document; other users can only access documents they uploaded
- **No organization or unit scoping**: access is uniform admin-vs-uploader, not scoped by organization/unit

## User Guide

### Uploading a Document

```bash
curl -X POST https://api.example.com/api/v1/documents \
  -H "Authorization: Bearer {token}" \
  -F "file=@document.pdf" \
  -F "title=Company PAN Card" \
  -F "name=pan_card.pdf"
```

Only PDF files are accepted (`UploadDocumentRequest` validates `mimes:pdf`), even though `config/documents.php` lists a broader MIME/extension whitelist used by other callers (e.g. the ERP document endpoint).

### Viewing / Downloading a Document

```bash
curl -X GET https://api.example.com/api/v1/documents/{uuid} \
  -H "Authorization: Bearer {token}" \
  -o downloaded_file.pdf
```

Served inline by default; add `?download=true` to force an attachment response.

## Technical Details

### Architecture

**Service Layer**: [`DocumentService`](../../app/Services/DocumentService.php)
- File validation (MIME type, size, extension)
- Secure UUID-based file naming
- Year/month organized storage structure
- `storeRaw()` — stores raw bytes for machine callers (e.g. ERP integration) that send base64 instead of multipart uploads
- `batchUpload()` exists on the service but is not wired to any controller/route

**Controller**: [`DocumentController`](../../app/Http/Controllers/Api/V1/DocumentController.php)
- List documents (`index`)
- Upload document (`store`)
- View/download document (`show`)
- Activate / deactivate document (`activate`, `deactivate`)

**Model**: [`Document`](../../app/Models/Document.php)
- UUID auto-generation
- Single relation: `uploader()` (belongs to `User`)
- Helper methods: `getFullPath()`, `exists()`, `download()`
- No query scopes

**Policy**: [`DocumentPolicy`](../../app/Policies/DocumentPolicy.php)
- Admin roles (System Admin, Operations Admin, Operations Manager, DRDO Admin) can view/update/delete/change-status any document
- Document uploader can do the same on their own documents
- No organization/unit scoping

### Storage Structure

```
storage/app/documents/
├── 2025/
│   ├── 01/
│   │   ├── {uuid}.pdf
│   │   ├── {uuid}.jpg
│   │   └── ...
│   ├── 02/
│   └── ...
├── 2026/
└── ...
```

### Security Features

1. **File Validation**:
   - Whitelist approach (allowed MIME types/extensions in `config/documents.php`; the upload endpoint further restricts to PDF only via `UploadDocumentRequest`)
   - Size limit enforcement (50MB default)
   - MIME type and extension verification

2. **Secure File Naming**:
   - UUID-based (no user input)
   - Prevents directory traversal
   - Prevents file overwrite attacks

3. **Access Control**:
   - Policy-based authorization (`DocumentPolicy`)
   - Admin-role or uploader-ownership only — no organization/unit scoping

4. **Audit Trail**:
   - Uploads and deletions logged via `Document`'s `HasAuditLog` trait
   - Downloads/views logged to the application log only (`Log::info`), not to `audit_logs`

### Authorization Rules

| Action | Authorization |
|--------|---------------|
| `viewAny` | All authenticated users |
| `view` | Admin role (System Admin, Operations Admin, Operations Manager, DRDO Admin) **OR** `$document->uploaded_by === $user->id` — no organization/unit scoping |
| `create` | All authenticated users |
| `update` | Same admin roles, or document owner |
| `delete` | Same admin roles, or document owner |
| `changeStatus` (activate/deactivate) | Same admin roles, or document owner |
| `download` | Same as `view` |

## API Reference

### Upload Document

**Endpoint**: `POST /api/v1/documents`

**Request**:
```http
POST /api/v1/documents
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: [binary, PDF only] (required)
title: string, max 150, unique (optional)
name: string, max 255 (optional)
is_active: boolean (optional, defaults true)
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "data": {
    "id": "uuid",
    "title": "Project Plan",
    "name": "project_plan.pdf",
    "original_filename": "original.pdf",
    "mime_type": "application/pdf",
    "size": 1024000,
    "size_human": "1000 KB",
    "extension": "pdf",
    "is_active": true,
    "uploaded_by": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com"
    },
    "uploaded_at": "2025-01-05T10:00:00Z"
  }
}
```

**Errors**:
- `400 Bad Request`: Invalid file type or size exceeded
- `401 Unauthorized`: Missing or invalid token
- `422 Unprocessable Entity`: Validation errors

### View / Download Document

**Endpoint**: `GET /api/v1/documents/{uuid}` (optional `?download=true` to force an attachment response instead of inline)

**Response** (200 OK): File stream

**Errors**:
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: No permission to access document
- `404 Not Found`: Document or file not found

## Configuration

### Environment Variables

Add to `.env`:
```env
# Document Storage
DOCUMENTS_STORAGE_DISK=documents
DOCUMENTS_MAX_FILE_SIZE=52428800  # 50MB in bytes
```

### Configuration File

**File**: [`config/documents.php`](../../config/documents.php)

- Storage disk configuration
- Max file size limit
- Allowed MIME types and extensions

### Storage Setup

```bash
# Create storage directory
mkdir -p storage/app/documents
chmod -R 775 storage/app/documents

# For cloud storage (S3)
# Update .env:
# DOCUMENTS_STORAGE_DISK=s3
# AWS_ACCESS_KEY_ID=your_key
# AWS_SECRET_ACCESS_KEY=your_secret
# AWS_DEFAULT_REGION=us-east-1
# AWS_BUCKET=your_bucket
```

## Performance Considerations

### File Size Limits
- Default: 50MB per file
- Configurable via `DOCUMENTS_MAX_FILE_SIZE`

### Storage Organization
- Year/month structure prevents directory bloat
- Improves filesystem performance
- Easy to archive old documents

## Known Limitations

- **No virus/malware scanning** on uploaded files
- **No file versioning** — re-uploading creates a new document record, it does not version an existing one
- **No signed/expiring URLs** — download access is authorization-gated only
- **`batchUpload()`** exists on `DocumentService` but is not exposed via any route

## Troubleshooting

### Common Issues

**Upload Fails with 422**:
- Check file type is in allowed list
- Verify file size is under limit
- Ensure required fields are provided

**403 Forbidden on Download**:
- Check user has permission to access document (admin role, or the uploader)

**404 Not Found**:
- Verify UUID is correct
- Check document exists in database
- Ensure file exists in storage

**Storage Permission Errors**:
```bash
# Fix storage permissions
chmod -R 775 storage/app/documents
chown -R www-data:www-data storage/app/documents
```

## Testing Recommendations

### Unit Tests
- DocumentService file validation
- Secure filename generation

### Feature Tests
- Upload endpoint with valid file
- Upload with invalid file type (expect 422)
- Upload exceeding size limit (expect 422)
- View/download with authorization
- View/download without authorization (expect 403)

### Integration Tests
- File actually stored in correct location
- Uploader-vs-admin authorization works correctly

## Code References

**Implementation**: [`DocumentService`](../../app/Services/DocumentService.php)
**Controller**: [`DocumentController`](../../app/Http/Controllers/Api/V1/DocumentController.php)
**Model**: [`Document`](../../app/Models/Document.php)
**Policy**: [`DocumentPolicy`](../../app/Policies/DocumentPolicy.php)
**Configuration**: [`config/documents.php`](../../config/documents.php)
**Migration**: [`database/migrations/2026_02_07_000011_create_documents_table.php`](../../database/migrations/2026_02_07_000011_create_documents_table.php)

## See Also

- [API Reference](../30-api/37-api-reference.md) - Complete API documentation
- [Audit Trail](29-audit-trail.md) - Audit logging for documents
- [Database Schema](../10-architecture/12-database-schema.md) - Documents table structure
- [Authentication](21-authentication.md) - JWT authentication for API access
