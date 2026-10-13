---
title: "Assessment API"
category: "api"
tags: ["api", "assessments", "scorecards", "filters", "search"]
related:
  - ../20-features/24-assessment-workflow.md
code_files:
  - app/Http/Controllers/Api/V1/AssessmentController.php
  - app/Http/Requests/ListAssessmentsRequest.php
last_updated: "2026-02-08"
version: "2.0"
---

# Assessment API

**Location**: `docs/30-api/34-assessment-api.md`
**Related**: [Assessment Workflow](../20-features/24-assessment-workflow.md) - Complete workflow documentation

**Base Path**: `/api/v1/assessments`

---

## Table of Contents

- [Endpoints Reference](#endpoints-reference)
- [List Assessments](#list-assessments)
  - [Search Parameter](#search-parameter)
  - [Enterprise Filters](#enterprise-filters)
  - [Assessor Filters](#assessor-filters)
  - [Date Range Filters](#date-range-filters)
  - [Certification Filter](#certification-filter)
  - [Legacy Filters](#legacy-filters)
  - [Pagination](#pagination)
- [Tab-Based Filter Examples](#tab-based-filter-examples)
- [Key Operations](#key-operations)
- [See Also](#see-also)

---

## Endpoints Reference

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| GET | `/` | List assessments with filters | ✓ | Operations Manager+ |
| GET | `/{id}` | View assessment details | ✓ | Assigned Assessor+ |
| POST | `/{id}/schedule` | Allocate assessors and schedule | ✓ | Operations Manager |
| POST | `/{id}/start` | Start assessment | ✓ | Team Member |
| POST | `/{id}/submit-for-qc` | Submit for QC | ✓ | Lead Assessor |
| POST | `/{id}/qc-decision` | QC review decision | ✓ | Operations Manager |
| POST | `/{id}/address-qc-feedback` | Address QC feedback | ✓ | Lead Assessor |
| POST | `/{id}/schedule-committee` | Schedule for committee | ✓ | Operations Admin |
| POST | `/{id}/committee-decision` | Committee decision | ✓ | Operations Admin |
| POST | `/{id}/address-committee-feedback` | Address committee feedback | ✓ | Lead Assessor |
| GET | `/{id}/available-transitions` | Get available transitions | ✓ | Assessor+ |

---

## List Assessments

Retrieve a paginated list of assessments with comprehensive filtering options.

**Endpoint**: `GET /api/v1/assessments`

**Authentication**: Required (Bearer token)

**Authorization**: System Admin, DRDO Admin, Operations Manager, Operations Admin, Assessor

**Description**: Retrieves assessments with automatic role-based filtering. Results are automatically filtered for Assessors (only assigned assessments), Enterprise Admins (only their organization), and Unit Admins (only their units).

### Search Parameter

**Case-insensitive partial match search** across multiple fields:

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search across Application Number, Assessment Number, and Enterprise Name |

**Example**:
```http
GET /api/v1/assessments?search=qci
```

**Use Case**: User types "qci" to find all assessments related to applications or enterprises containing "qci" in their name/number.

---

### Enterprise Filters

Filter assessments by organization characteristics:

| Parameter | Type | Valid Values | Description |
|-----------|------|--------------|-------------|
| `enterprise_size` | string | `startup`, `micro`, `small`, `medium`, `large` | Filter by enterprise size classification |
| `drdo_vendor_category` | string | Any string | Filter by DRDO vendor category |
| `sector` | string | `manufacturing`, `service` | Filter by enterprise sector |

**Examples**:

**Filter by enterprise size:**
```http
GET /api/v1/assessments?enterprise_size=micro
```

**Filter by DRDO vendor category:**
```http
GET /api/v1/assessments?drdo_vendor_category=Category-A
```

**Filter by sector:**
```http
GET /api/v1/assessments?sector=manufacturing
```

**Combined enterprise filters:**
```http
GET /api/v1/assessments?sector=manufacturing&enterprise_size=small&drdo_vendor_category=Category-A
```

---

### Assessor Filters

Filter assessments by assigned assessors:

| Parameter | Type | Description |
|-----------|------|-------------|
| `lead_assessor_id` | integer | Filter by lead assessor user ID |
| `co_assessor_id` | integer | Filter by co-assessor user ID |

**Examples**:

**Filter by lead assessor:**
```http
GET /api/v1/assessments?lead_assessor_id=42
```

**Filter by co-assessor:**
```http
GET /api/v1/assessments?co_assessor_id=58
```

**Combined assessor filters:**
```http
GET /api/v1/assessments?lead_assessor_id=42&co_assessor_id=58
```

**Use Case**: Workload distribution - Find all assessments assigned to a specific assessor to check their current workload.

---

### Date Range Filters

Filter assessments by date ranges on different date fields:

| Parameter | Type | Format | Description |
|-----------|------|--------|-------------|
| `date_from` | date | `YYYY-MM-DD` | Start date of the range (inclusive) |
| `date_to` | date | `YYYY-MM-DD` | End date of the range (inclusive) |
| `date_type` | string | See below | Which date field to filter on |

**Valid `date_type` values**:

| Value | Field | Description |
|-------|-------|-------------|
| `scheduled_start` | `scheduled_start_date` | Scheduled start date (default) |
| `actual_start` | `actual_start_date` | Actual start date |
| `review` | `submitted_at` | Committee review date |
| `certified` | `completed_at` | Certification/completion date |

**Examples**:

**Filter by scheduled start date:**
```http
GET /api/v1/assessments?date_from=2025-01-01&date_to=2025-01-31&date_type=scheduled_start
```

**Filter by actual start date:**
```http
GET /api/v1/assessments?date_from=2025-01-15&date_type=actual_start
```

**Filter by committee review date:**
```http
GET /api/v1/assessments?date_to=2025-02-28&date_type=review
```

**Filter by certification date:**
```http
GET /api/v1/assessments?date_from=2024-01-01&date_to=2024-12-31&date_type=certified
```

**Use Cases**:
- **Scheduling**: Find assessments scheduled for next month
- **Performance Tracking**: Find assessments started in a specific period
- **Committee Planning**: Find assessments pending committee review
- **Reporting**: Generate certified assessments report for a year

---

### Certification Filter

Filter certified assessments by certification level/grade:

| Parameter | Type | Description |
|-----------|------|-------------|
| `certification_level` | string | Filter by certification grade (e.g., "Gold", "Silver", "Bronze") |

**Example**:
```http
GET /api/v1/assessments?status=certified&certification_level=Gold
```

**Use Case**: Generate a list of all Gold-certified enterprises for the annual report.

---

### Legacy Filters

Maintained for backward compatibility:

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by assessment status (see status values below) |
| `application_id` | integer | Filter by specific application ID |
| `assessment_type` | string | Filter by assessment type (`initial`, `surveillance`, `recertification`) |

**Valid status values**:
- `allocation_pending` - Awaiting assessor allocation
- `scheduled` - Assessor allocated, assessment scheduled
- `in_progress` - Assessment started
- `submitted_for_qc` - Submitted for QC review
- `qc_feedback` - QC feedback provided
- `ready_for_committee` - Ready for committee review
- `committee_review` - Under committee review
- `committee_feedback` - Committee feedback provided
- `certified` - Assessment certified (final state)

**Examples**:

**Filter by status:**
```http
GET /api/v1/assessments?status=scheduled
```

**Filter by application:**
```http
GET /api/v1/assessments?application_id=123
```

**Filter by assessment type:**
```http
GET /api/v1/assessments?assessment_type=initial
```

---

### Pagination

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `per_page` | integer | 15 | Items per page (max: 100) |
| `page` | integer | 1 | Page number |

**Example**:
```http
GET /api/v1/assessments?per_page=25&page=2
```

---

### Response Format

**Success Response (200 OK)**:

```json
{
  "success": true,
  "message": "Assessments retrieved successfully",
  "data": {
    "assessments": [
      {
        "id": 75,
        "application_id": 123,
        "status": "scheduled",
        "lead_assessor": {
          "id": 42,
          "name": "Dr. Rajesh Kumar",
          "email": "rajesh.kumar@example.com"
        },
        "scheduled_start_date": "2025-02-15",
        "scheduled_end_date": "2025-02-20",
        "actual_start_date": null,
        "actual_end_date": null,
        "completed_at": null,
        "total_score": null,
        "application": {
          "id": 123,
          "application_number": "APP-2025-00123",
          "status": "assessment_scheduled",
          "sector": "manufacturing",
          "enterprise_classification": "micro",
          "organization": {
            "id": 45,
            "name": "ABC Defense Systems Pvt. Ltd."
          },
          "unit": {
            "id": 67,
            "name": "Unit 1 - Manufacturing Plant",
            "address": "Industrial Area, Pune"
          }
        },
        "team_members": [
          {
            "user_id": 42,
            "name": "Dr. Rajesh Kumar",
            "email": "rajesh.kumar@example.com",
            "role": "lead_assessor",
            "designation": "Senior Quality Auditor",
            "location": "Pune, Maharashtra",
            "department": "Manufacturing Quality"
          },
          {
            "user_id": 58,
            "name": "Mr. Anil Sharma",
            "email": "anil.sharma@example.com",
            "role": "co_assessor",
            "designation": "Quality Auditor",
            "location": "Mumbai, Maharashtra",
            "department": "Process Quality"
          }
        ],
        "allocated_at": "2025-01-10T09:30:00Z",
        "started_at": null,
        "submitted_at": null,
        "created_at": "2025-01-05T10:15:30Z",
        "updated_at": "2025-01-10T09:30:00Z"
      }
    ],
    "pagination": {
      "total": 150,
      "per_page": 15,
      "current_page": 1,
      "last_page": 10
    }
  }
}
```

**Error Responses**:

- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Unauthorized to view assessments
- `422 Unprocessable Entity` - Validation failed

**Validation Error Example**:
```json
{
  "success": false,
  "message": "Validation failed.",
  "errors": {
    "enterprise_size": [
      "The enterprise size must be one of: startup, micro, small, medium, large."
    ],
    "date_to": [
      "The end date must be on or after the start date."
    ]
  }
}
```

---

## Tab-Based Filter Examples

Frontend typically displays assessments in tabs based on status/stage. Here are recommended filter combinations for each tab:

### 1. Allocation Pending Tab

**Description**: Assessments awaiting assessor allocation

**Recommended Filters**:
```http
GET /api/v1/assessments?status=allocation_pending&search=&enterprise_size=&drdo_vendor_category=
```

**Use Case**: Operations Manager needs to allocate assessors to pending assessments, filtered by enterprise characteristics.

**Example with filters**:
```http
GET /api/v1/assessments?status=allocation_pending&enterprise_size=micro&sector=manufacturing
```

---

### 2. Scheduled Tab

**Description**: Assessments with allocated assessors, not yet started

**Recommended Filters**:
```http
GET /api/v1/assessments?status=scheduled&date_type=scheduled_start&date_from=2025-01-01&date_to=2025-01-31&lead_assessor_id=&co_assessor_id=
```

**Use Case**: View all assessments scheduled for January 2025, optionally filtered by specific assessor.

**Example with assessor filter**:
```http
GET /api/v1/assessments?status=scheduled&date_type=scheduled_start&date_from=2025-01-15&date_to=2025-01-31&lead_assessor_id=42
```

---

### 3. In Progress Tab

**Description**: Assessments currently being conducted

**Recommended Filters**:
```http
GET /api/v1/assessments?status=in_progress&date_type=actual_start&date_from=&date_to=&lead_assessor_id=&co_assessor_id=
```

**Use Case**: Monitor ongoing assessments, filter by actual start date or assessor.

**Example with date range**:
```http
GET /api/v1/assessments?status=in_progress&date_type=actual_start&date_from=2025-01-01&date_to=2025-01-15
```

---

### 4. QC Review Tab

**Description**: Assessments submitted for quality control review

**Recommended Filters**:
```http
GET /api/v1/assessments?status=submitted_for_qc&date_type=review&date_from=&date_to=
```

**Use Case**: Operations Manager reviews assessments pending QC approval.

**Example**:
```http
GET /api/v1/assessments?status=submitted_for_qc&date_type=review&date_to=2025-01-20
```

---

### 5. Committee Review Tab

**Description**: Assessments ready for or under committee review

**Recommended Filters**:
```http
GET /api/v1/assessments?status=ready_for_committee,committee_review&date_type=review&date_from=&date_to=
```

**Note**: For multiple statuses, separate with commas.

**Use Case**: Committee members view assessments pending their review.

---

### 6. Certified Tab

**Description**: Assessments that have been certified

**Recommended Filters**:
```http
GET /api/v1/assessments?status=certified&certification_level=&date_type=certified&date_from=&date_to=
```

**Use Case**: Generate reports of certified enterprises, filtered by grade and date.

**Example - Gold certifications in 2024**:
```http
GET /api/v1/assessments?status=certified&certification_level=Gold&date_type=certified&date_from=2024-01-01&date_to=2024-12-31
```

---

### 7. Complex Multi-Filter Example

**Scenario**: Find all micro manufacturing enterprises with scheduled assessments in February 2025, assigned to a specific lead assessor.

```http
GET /api/v1/assessments?status=scheduled&sector=manufacturing&enterprise_size=micro&lead_assessor_id=42&date_type=scheduled_start&date_from=2025-02-01&date_to=2025-02-28&per_page=25
```

**Response Interpretation**:
- Only assessments matching ALL criteria will be returned
- Results automatically filtered by user role (e.g., Assessors only see their assigned assessments)
- Pagination controls allow navigating through large result sets

---

## Key Operations

### Start Assessment

**Endpoint**: `POST /api/v1/assessments/{id}/start`

**Authorization**: Assessor (must be assigned to assessment)

**Request**:
```http
POST /api/v1/assessments/75/start
Authorization: Bearer {token}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Assessment started successfully.",
  "data": {
    "assessment": {
      "id": 75,
      "status": "in_progress",
      "actual_start_date": "2025-01-15",
      "started_at": "2025-01-15T08:30:00Z"
    }
  }
}
```

---

### Submit for QC

**Endpoint**: `POST /api/v1/assessments/{id}/submit-for-qc`

**Authorization**: Lead Assessor

**Request**:
```http
POST /api/v1/assessments/75/submit-for-qc
Authorization: Bearer {token}
Content-Type: application/json

{
  "remarks": "Assessment completed as per schedule",
  "recommendations": "Organization demonstrates strong quality management practices"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Assessment submitted for QC successfully.",
  "data": {
    "assessment": {
      "id": 75,
      "status": "submitted_for_qc",
      "total_score": 87.5,
      "submitted_at": "2025-01-20T16:45:00Z"
    }
  }
}
```

**Error (400 Bad Request)**:
```json
{
  "success": false,
  "message": "There are 12 unanswered questions.",
  "errors": {}
}
```

---

### QC Decision

**Endpoint**: `POST /api/v1/assessments/{id}/qc-decision`

**Authorization**: Operations Manager

**Request (Approve for Committee)**:
```http
POST /api/v1/assessments/75/qc-decision
Authorization: Bearer {token}
Content-Type: application/json

{
  "action": "approve_for_committee",
  "feedback": null
}
```

**Valid Actions**:
- `approve_for_committee` - Approve and forward to committee. Questions stay `review_status=pending`.
- `provide_feedback` - Send back to assessor with per-question feedback. Flagged questions get `review_status=flagged`, `review_type=qc`.

**Request (Provide Feedback)**:
```http
POST /api/v1/assessments/75/qc-decision
Authorization: Bearer {token}
Content-Type: application/json

{
  "action": "provide_feedback",
  "feedback": [
    {
      "question_id": 123,
      "comment": "Insufficient evidence for this score"
    },
    {
      "question_id": 456,
      "comment": "Score should be lower based on evidence provided"
    }
  ]
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "QC review completed successfully.",
  "data": {
    "assessment": {
      "id": 75,
      "status": "ready_for_committee"
    }
  }
}
```

---

### Address QC Feedback

**Endpoint**: `POST /api/v1/assessments/{id}/address-qc-feedback`

**Authorization**: Lead Assessor

**Request**:
```http
POST /api/v1/assessments/75/address-qc-feedback
Authorization: Bearer {token}
Content-Type: application/json

{
  "remarks": "All feedback addressed. Evidence updated.",
  "changes_made": "Updated scores for Q123 and Q456, added supporting documents."
}
```

**Side Effects**:
- ALL question review statuses reset to `pending` (clean slate)
- Score recalculated
- Transitions to `ready_for_committee`

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "QC feedback addressed successfully. Assessment moved to ready for committee review.",
  "data": {
    "assessment": {
      "id": 75,
      "status": "ready_for_committee"
    }
  }
}
```

---

### Schedule Committee

**Endpoint**: `POST /api/v1/assessments/{id}/schedule-committee`

**Authorization**: Operations Admin

**Request**:
```http
POST /api/v1/assessments/75/schedule-committee
Authorization: Bearer {token}
Content-Type: application/json

{
  "committee_meeting_id": 42
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Assessment scheduled for committee review.",
  "data": {
    "assessment": {
      "id": 75,
      "status": "committee_review"
    }
  }
}
```

---

### Committee Decision

**Endpoint**: `POST /api/v1/assessments/{id}/committee-decision`

**Authorization**: Operations Admin

**Valid Actions**:
- `certify` - Certify the assessment. ALL questions marked `review_status=approved`, `review_type=committee`. Certificate auto-created.
- `provide_feedback` - Send back with feedback. Flagged questions marked `review_status=flagged`, `review_type=committee`.

**Request (Certify)**:
```http
POST /api/v1/assessments/75/committee-decision
Authorization: Bearer {token}
Content-Type: application/json

{
  "action": "certify",
  "remarks": "Assessment meets all certification standards"
}
```

**Request (Provide Feedback)**:
```http
POST /api/v1/assessments/75/committee-decision
Authorization: Bearer {token}
Content-Type: application/json

{
  "action": "provide_feedback",
  "remarks": "Clarification needed on specific questions",
  "feedback": [
    {
      "question_id": 123,
      "comment": "Score justification unclear",
      "rc_score": 3
    }
  ]
}
```

**Response (200 OK) - Certify**:
```json
{
  "success": true,
  "message": "Assessment certified successfully.",
  "data": {
    "assessment": {
      "id": 75,
      "status": "certified"
    }
  }
}
```

**Side Effects on Certify**:
- All questions: `review_status=approved`, `review_type=committee`
- Certificate auto-created (QCI-SAMAR-{YYYY}-{NNNNNN})
- Application status synced to `certified`

---

### Address Committee Feedback

**Endpoint**: `POST /api/v1/assessments/{id}/address-committee-feedback`

**Authorization**: Lead Assessor

**Request**:
```http
POST /api/v1/assessments/75/address-committee-feedback
Authorization: Bearer {token}
Content-Type: application/json

{
  "remarks": "All committee feedback addressed",
  "changes_summary": "Updated RC score clarifications for flagged questions"
}
```

**Side Effects**:
- ALL question review statuses reset to `pending` (clean slate)
- Score recalculated
- Transitions back to `submitted_for_qc` (goes through QC again before committee)

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Committee feedback addressed successfully. Assessment submitted for QC review.",
  "data": {
    "assessment": {
      "id": 75,
      "status": "submitted_for_qc"
    }
  }
}
```

---

### Schedule Assessors

**Endpoint**: `POST /api/v1/assessments/{id}/schedule`

**Authorization**: Operations Manager

**Request**:
```http
POST /api/v1/assessments/75/schedule
Authorization: Bearer {token}
Content-Type: application/json

{
  "lead_assessor_id": 42,
  "team_assessor_ids": [58, 63],
  "scheduled_start_date": "2025-02-15",
  "scheduled_end_date": "2025-02-20",
  "remarks": "Allocated based on expertise in ISO 9001 and manufacturing quality"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Assessment allocated successfully.",
  "data": {
    "assessment": {
      "id": 75,
      "status": "scheduled",
      "scheduled_start_date": "2025-02-15",
      "scheduled_end_date": "2025-02-20",
      "allocated_at": "2025-01-10T09:30:00Z",
      "team_members": [
        {
          "user_id": 42,
          "name": "Dr. Rajesh Kumar",
          "role": "lead_assessor"
        },
        {
          "user_id": 58,
          "name": "Mr. Anil Sharma",
          "role": "co_assessor"
        },
        {
          "user_id": 63,
          "name": "Ms. Priya Patel",
          "role": "co_assessor"
        }
      ]
    }
  }
}
```

**Error (400 Bad Request)**:
```json
{
  "success": false,
  "message": "Selected user is not an Assessor.",
  "errors": {}
}
```

---

## See Also

- [Assessment Workflow](../20-features/24-assessment-workflow.md) - Complete workflow with state machine
- [State Machines](../10-architecture/13-state-machines.md) - Assessment states and transitions
- [API Reference](37-api-reference.md) - Complete API documentation
- [Search Functionality](../20-features/31-search-functionality.md) - Search implementation details

**Code References**:
- [`AssessmentController`](../../app/Http/Controllers/Api/V1/AssessmentController.php) - Main controller
- [`ListAssessmentsRequest`](../../app/Http/Requests/ListAssessmentsRequest.php) - Validation rules
- [`Assessment` model](../../app/Models/Assessment.php) - Model with scopes and relationships

---

**Last Updated**: February 8, 2026
**API Version**: 2.0
**Code Version**: Laravel 12, PHP 8.4+
