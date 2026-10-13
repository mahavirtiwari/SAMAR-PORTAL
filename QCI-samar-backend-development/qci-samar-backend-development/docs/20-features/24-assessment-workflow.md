---
title: "Assessment Workflow (DEPRECATED — see assessment-lifecycle-end-to-end.md)"
category: "features"
tags: ["deprecated"]
related:
  - assessment-lifecycle-end-to-end.md
last_updated: "2026-05-19"
version: "1.0-deprecated"
---

# Assessment Workflow — DEPRECATED

> **This file is out of date and retained only for historical reference.**
>
> The state list and transition narrative below predate the Rating Committee work and the May-2026 audit fixes. The state names listed (`unassigned`, `assigned`, `started`, `closed`) do not match the real state machine.
>
> **For the current cross-stack lifecycle, see [assessment-lifecycle-end-to-end.md](assessment-lifecycle-end-to-end.md)** (covers manufacturing sector across backend / web / mobile).
>
> For the technical state-machine details, see [../10-architecture/13-state-machines.md](../10-architecture/13-state-machines.md).
>
> The historical content below is preserved for reference but should not be relied on.

---

**Location**: `docs/20-features/24-assessment-workflow.md`
**Related**: [Application Workflow](23-application-workflow.md) | [State Machines](../10-architecture/13-state-machines.md) | [Assessment API](../30-api/34-assessment-api.md)

## Overview

The **Assessment Workflow** manages the evaluation process conducted by assessors to determine if an organization meets certification standards.

### Assessment Types

- **On-Site Assessment** - Physical visit to organization
- **Remote Assessment** - Virtual/document-based review
- **Surveillance** - Periodic checks for certified organizations
- **Re-certification** - Renewal assessments

---

## Assessment Lifecycle

### States

1. **unassigned** - Created but no assessor assigned
2. **assigned** - Assessor allocated
3. **started** - Assessment in progress
4. **submitted_for_qc** - Submitted for quality check
5. **qc_feedback** - QC corrections needed
6. **ready_for_committee** - QC approved
7. **closed** - Assessment completed

For complete state diagram, see [State Machines](../10-architecture/13-state-machines.md#assessment-state-machine).

---

## Creating Assessment

Assessments are automatically created when application is allocated to assessor:

```http
POST /api/applications/101/allocate
Content-Type: application/json

{
  "lead_assessor_id": 25,
  "assessor_id": 30,
  "scheduled_date": "2025-01-15",
  "planned_duration_days": 3
}
```

**Response includes assessment**:
```json
{
  "success": true,
  "data": {
    "application": {...},
    "assessment": {
      "id": 75,
      "assessment_number": "ASM-000075",
      "status": "assigned",
      "lead_assessor_id": 25,
      "assessor_id": 30,
      "planned_start_date": "2025-01-15",
      "planned_duration_days": 3
    }
  }
}
```

---

## Conducting Assessment

### Step 1: Start Assessment

```http
POST /api/assessments/75/start
Authorization: Bearer {token}
```

**Response**:
```json
{
  "success": true,
  "message": "Assessment started",
  "data": {
    "status": "started",
    "started_at": "2025-01-15T09:00:00Z",
    "scorecards": [
      {
        "id": 201,
        "question_id": 1,
        "question": "Does the organization have documented quality policy?",
        "max_score": 10,
        "status": "pending"
      }
      // ... more scorecards
    ]
  }
}
```

### Step 2: Complete Scorecards

Assessors evaluate each criterion and assign scores:

```http
PUT /api/assessments/75/scorecards/201
Content-Type: application/json

{
  "score_obtained": 8.5,
  "finding_type": "minor",
  "finding_description": "Quality policy exists but not regularly reviewed",
  "evidence": "Document QP-2024-001 reviewed",
  "assessor_remarks": "Recommend quarterly policy reviews",
  "is_na": false
}
```

**Scoring System**:
- **max_score**: Maximum possible score (from question)
- **score_obtained**: Actual score given by assessor
- **weighted_score**: Calculated based on question weight
- **finding_type**: `major`, `minor`, `observation`, `none`

### Step 3: Upload Evidence

```http
POST /api/assessments/75/documents
Content-Type: multipart/form-data

file: (binary)
document_type: evidence
category: quality_control
description: Photo of quality control station
```

### Step 4: Calculate Final Score

```http
POST /api/assessments/75/calculate-score
```

**Calculation Logic**:
```php
public function calculateScore(): void
{
    $scorecards = $this->scorecards()
        ->where('status', 'completed')
        ->where('is_na', false)
        ->get();

    $totalScore = $scorecards->sum('weighted_score');
    $maxScore = $scorecards->sum('max_score');
    $percentage = $maxScore > 0 ? ($totalScore / $maxScore) * 100 : 0;

    // Determine grade
    $grade = match (true) {
        $percentage >= 95 => 'A+',
        $percentage >= 90 => 'A',
        $percentage >= 85 => 'B+',
        $percentage >= 80 => 'B',
        $percentage >= 70 => 'C',
        $percentage >= 60 => 'D',
        default => 'F',
    };

    // Count findings
    $majorFindings = $scorecards->where('finding_type', 'major')->count();
    $minorFindings = $scorecards->where('finding_type', 'minor')->count();
    $observations = $scorecards->where('finding_type', 'observation')->count();

    $this->update([
        'total_score' => $totalScore,
        'max_score' => $maxScore,
        'percentage' => $percentage,
        'grade' => $grade,
        'major_findings' => $majorFindings,
        'minor_findings' => $minorFindings,
        'observations' => $observations,
    ]);
}
```

---

## Submitting for QC

### Prerequisites

✅ All scorecards completed
✅ Score calculated
✅ Evidence uploaded
✅ Assessment report generated

### Submit

```http
POST /api/assessments/75/submit-for-qc
Content-Type: application/json

{
  "executive_summary": "Organization demonstrates strong quality management...",
  "detailed_findings": "...",
  "recommendation": "approve"
}
```

**Recommendations**:
- `approve` - Recommend certification
- `conditional_approve` - Approve with conditions
- `reject` - Do not recommend certification

**Response**:
```json
{
  "success": true,
  "message": "Assessment submitted for QC review",
  "data": {
    "status": "submitted_for_qc",
    "submitted_at": "2025-01-18T16:00:00Z",
    "total_score": 425.5,
    "max_score": 500,
    "percentage": 85.1,
    "grade": "B+",
    "major_findings": 0,
    "minor_findings": 3,
    "observations": 5
  }
}
```

---

## Quality Check (QC) Review

**Performed by**: Operations Manager

### Review Assessment

```http
GET /api/assessments/75/qc-review
```

**Returns**:
- Assessment details
- All scorecards
- Evidence documents
- Calculation verification

### Approve QC

```http
POST /api/assessments/75/qc-approve
Content-Type: application/json

{
  "qc_remarks": "Assessment thoroughly conducted, all criteria properly evaluated"
}
```

Assessment transitions to `ready_for_committee`.

### Provide QC Feedback

```http
POST /api/assessments/75/qc-feedback
Content-Type: application/json

{
  "qc_status": "feedback_provided",
  "qc_remarks": "Please revise scoring for sections 3.2 and 4.5",
  "qc_feedback": [
    {
      "section": "Quality Control",
      "scorecard_id": 205,
      "issue": "Insufficient evidence for score given",
      "required_action": "Provide photographic evidence or adjust score"
    },
    {
      "section": "Process Management",
      "scorecard_id": 210,
      "issue": "Finding type should be 'major' not 'minor'",
      "required_action": "Reclassify finding severity"
    }
  ]
}
```

Assessment transitions to `qc_feedback`. Lead assessor must address feedback.

---

## Addressing QC Feedback

**Performed by**: Lead Assessor

### View Feedback

```http
GET /api/assessments/75
```

### Update Scorecards

```http
PUT /api/assessments/75/scorecards/205
Content-Type: application/json

{
  "score_obtained": 7.0,
  "evidence": "Added photos QC-001.jpg, QC-002.jpg"
}
```

### Resubmit for QC

```http
POST /api/assessments/75/resubmit-for-qc
Content-Type: application/json

{
  "response_to_feedback": "All feedback addressed. Evidence added and scoring revised."
}
```

---

## Assessment Reports

### Generate Report

```http
POST /api/assessments/75/generate-report
```

**Report Includes**:
- Executive summary
- Scorecard results
- Findings (major, minor, observations)
- Evidence references
- Recommendations
- Assessor details and signatures

### Download Report

```http
GET /api/assessments/75/report/download
```

Returns PDF assessment report.

---

## Scorecard Structure

### Question Model

```php
class Question extends Model
{
    protected $fillable = [
        'certification_scheme',
        'section',
        'subsection',
        'question_number',
        'question_text',
        'criteria',
        'max_score',
        'weight',
        'is_mandatory',
        'evidence_required',
        'status',
    ];
}
```

### Scorecard Model

```php
class AssessmentScorecard extends Model
{
    protected $fillable = [
        'assessment_id',
        'question_id',
        'score_obtained',
        'max_score',
        'weighted_score',
        'finding_type',        // major, minor, observation, none
        'finding_description',
        'evidence',
        'corrective_action',
        'assessor_remarks',
        'is_na',              // Not applicable
        'na_reason',
        'status',             // pending, completed
    ];
}
```

### Scorecard API

```http
GET /api/assessments/75/scorecards
```

**Response**:
```json
{
  "success": true,
  "data": {
    "scorecards": [
      {
        "id": 201,
        "question": {
          "id": 1,
          "section": "Quality Management",
          "question_text": "Does the organization have documented quality policy?",
          "max_score": 10,
          "weight": 1.5
        },
        "score_obtained": 8.5,
        "weighted_score": 12.75,
        "finding_type": "minor",
        "finding_description": "Policy exists but not regularly reviewed",
        "status": "completed"
      }
    ],
    "summary": {
      "total_questions": 50,
      "completed": 48,
      "pending": 2,
      "total_score": 425.5,
      "max_possible_score": 500,
      "percentage": 85.1
    }
  }
}
```

---

## Assessment Team

### Assign Team Members

```http
POST /api/assessments/75/team
Content-Type: application/json

{
  "assessor_ids": [30, 35, 40]
}
```

### Team Member Responsibilities

- **Lead Assessor**: Overall responsibility, final approval
- **Assessor**: Complete assigned sections
- **Team Members**: Support, evidence collection

---

## Assessment History

### Status History

```http
GET /api/assessments/75/status-history
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "from_status": "started",
      "to_status": "submitted_for_qc",
      "changed_by": "Lead Assessor Name",
      "changed_at": "2025-01-18T16:00:00Z",
      "remarks": "Assessment completed and submitted for QC"
    },
    {
      "from_status": "assigned",
      "to_status": "started",
      "changed_by": "Lead Assessor Name",
      "changed_at": "2025-01-15T09:00:00Z",
      "remarks": "Assessment started"
    }
  ]
}
```

---

## Business Rules

### Scoring Rules

1. **N/A (Not Applicable)**: Questions can be marked N/A with justification
2. **Mandatory Questions**: Must score minimum threshold
3. **Weighted Scoring**: Questions have different weights based on importance
4. **Finding Classification**:
   - **Major**: Critical non-conformance
   - **Minor**: Non-critical issue
   - **Observation**: Opportunity for improvement

### QC Rules

1. **Mandatory Review**: All assessments must pass QC
2. **Feedback Loop**: Assessor can resubmit after addressing feedback
3. **Maximum Revisions**: Configurable limit (default: 3)

### Grading System

| Percentage | Grade | Outcome |
|-----------|-------|---------|
| 95-100% | A+ | Excellent - Recommend certification |
| 90-94% | A | Very Good - Recommend certification |
| 85-89% | B+ | Good - Recommend certification |
| 80-84% | B | Satisfactory - Recommend certification |
| 70-79% | C | Acceptable - Conditional certification |
| 60-69% | D | Marginal - Conditional/Reject |
| <60% | F | Fail - Reject |

---

## Notifications

| Event | Notified Users |
|-------|---------------|
| Assessment Assigned | Lead Assessor, Assessor, Organization |
| Assessment Started | Organization Admin |
| Assessment Submitted | Operations Manager, Organization |
| QC Feedback | Lead Assessor |
| QC Approved | Lead Assessor, Organization, Committee |
| Assessment Closed | All stakeholders |

---

## API Reference

**Base Path**: `/api/assessments`

| Method | Endpoint | Description | Role Required |
|--------|----------|-------------|---------------|
| GET | `/` | List assessments | Operations Manager+ |
| GET | `/{id}` | View assessment | Assigned Assessor or Admin |
| POST | `/{id}/start` | Start assessment | Lead Assessor |
| PUT | `/{id}/scorecards/{scorecardId}` | Update scorecard | Assessor |
| POST | `/{id}/calculate-score` | Calculate score | Lead Assessor |
| POST | `/{id}/submit-for-qc` | Submit for QC | Lead Assessor |
| POST | `/{id}/qc-approve` | Approve QC | Operations Manager |
| POST | `/{id}/qc-feedback` | Provide QC feedback | Operations Manager |
| POST | `/{id}/resubmit-for-qc` | Resubmit after feedback | Lead Assessor |
| GET | `/{id}/report` | View report | Assessor or Admin |
| GET | `/{id}/status-history` | Status history | Assessor or Admin |

For complete API documentation, see [Assessment API](../30-api/34-assessment-api.md).

---

## See Also

- [Application Workflow](23-application-workflow.md) - Application lifecycle
- [State Machines](../10-architecture/13-state-machines.md) - Assessment state machine
- [Assessment API](../30-api/34-assessment-api.md) - Complete API reference

**Code References**:
- [`Assessment` model](../../app/Models/Assessment.php)
- [`AssessmentScorecard` model](../../app/Models/AssessmentScorecard.php)
- [`AssessmentStateMachine`](../../app/Services/StateMachine/AssessmentStateMachine.php)
- [`ScorecardService`](../../app/Services/ScorecardService.php)
