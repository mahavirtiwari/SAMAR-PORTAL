---
title: "Database Schema"
category: "architecture"
tags: ["database", "schema", "models", "relationships", "migrations"]
related:
  - 11-system-architecture.md
  - 13-state-machines.md
  - ../20-features/README.md
code_files:
  - database/migrations/
  - app/Models/
last_updated: "2026-07-22"
version: "1.0"
---

# Database Schema

**Location**: `docs/10-architecture/12-database-schema.md`
**Related**: [System Architecture](11-system-architecture.md) | [State Machines](13-state-machines.md)

---

## Overview

The QCI SAMAR backend uses a **normalized relational database schema** with MySQL 8.0+. The schema supports the complete certification lifecycle with comprehensive relationships and optimized indexes.

**Key Characteristics**:
- **Database**: MySQL 8.0+
- **Models**: see [`app/Models/`](../../app/Models/) for the current list
- **Migrations**: see [`database/migrations/`](../../database/migrations/) for the current list
- **Features**: Soft deletes, timestamps, foreign keys, JSON columns

---

## Entity Relationship Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     CORE ENTITIES                                 │
└──────────────────────────────────────────────────────────────────┘

┌─────────────────┐         ┌──────────────────┐
│  Organizations  │────1:N──│      Units       │
└────────┬────────┘         └────────┬─────────┘
         │                           │
         │1:N                       1:N
         │                           │
    ┌────▼────────┐            ┌────▼────────┐
    │    Users    │            │Applications │
    └──┬──────┬───┘            └──┬──────────┘
       │      │                   │
       │N:M   │1:N                │1:1
       │      │                   │
  ┌────▼───┐  │              ┌────▼──────────┐
  │  Roles │  │              │  Assessments  │
  └────────┘  │              └───┬───────────┘
              │                  │1:N
              │              ┌───▼───────────┐
              │              │  Scorecards   │
              │              └───────────────┘
              │
              │1:N
              │
         ┌────▼──────────────┐
         │   Notifications   │
         └───────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│                  APPLICATION LIFECYCLE                             │
└───────────────────────────────────────────────────────────────────┘

┌──────────────┐  1:N  ┌────────────────────┐
│ Applications │───────│ ApplicationProducts│
└──────┬───────┘       └────────────────────┘
       │1:N
       ├───────────────┌────────────────────────┐
       │               │ ApplicationCustomers   │
       │               └────────────────────────┘
       │1:N
       ├───────────────┌────────────────────────┐
       │               │ ApplicationProcesses   │
       │               └────────────────────────┘
       │1:N
       ├───────────────┌─────────────────────────────┐
       │               │ ApplicationOutsourcedProcess│
       │               └─────────────────────────────┘
       │1:N
       ├───────────────┌──────────────┐
       │               │ Raw Materials│
       │               └──────────────┘
       │1:N
       ├───────────────┌────────────────────────────┐
       │               │ ThirdPartyCertifications   │
       │               └────────────────────────────┘
       │1:1
       ├───────────────┌────────────┐
       │               │  Payments  │
       │               └────────────┘
       │1:1
       ├───────────────┌────────────┐
       │               │Certificates│
       │               └────────────┘
       │1:N
       └───────────────┌──────────────────────┐
                       │ApplicationStatusHistory│
                       └──────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│               COMMITTEE & CERTIFICATION                            │
└───────────────────────────────────────────────────────────────────┘

┌──────────────────┐  N:M  ┌──────────────┐
│CommitteeMeetings │───────│ Applications │
└────────┬─────────┘       └──────────────┘
         │1:N
         ├──────────────────┌──────────────────┐
         │                  │CommitteeDecisions│
         │                  └──────────────────┘
         │N:M
         └──────────────────┌───────┐
                            │ Users │
                            └───────┘

┌───────────────────────────────────────────────────────────────────┐
│                     AUDIT & SUPPORT                                │
└───────────────────────────────────────────────────────────────────┘

┌─────────────┐ Polymorphic  ┌────────────┐
│  Documents  │──────────────│ All Models │
└─────────────┘              └────────────┘

┌─────────────┐ Polymorphic  ┌────────────┐
│ Audit Logs  │──────────────│ All Models │
└─────────────┘              └────────────┘

┌──────────────┐  1:N  ┌───────────────────────┐
│SupportTickets│───────│SupportTicketComments  │
└──────────────┘       └───────────────────────┘
```

---

## Core Tables

### 1. Organizations

**Purpose**: Multi-tenant organization entities

**Table**: `organizations`

**Columns**:
```sql
id                  BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
name                VARCHAR(255) NOT NULL
legal_name          VARCHAR(255) NULL
type                ENUM('government', 'public_sector', 'private_limited', 'partnership', 'proprietorship', 'others')
registration_number VARCHAR(100) NULL
pan_number          VARCHAR(10) NULL
gst_number          VARCHAR(15) NULL
address             TEXT NULL
city                VARCHAR(100) NULL
state               VARCHAR(100) NULL
pincode             VARCHAR(10) NULL
country             VARCHAR(100) DEFAULT 'India'
phone               VARCHAR(20) NULL
email               VARCHAR(255) NULL
website             VARCHAR(255) NULL
contact_person_name VARCHAR(255) NULL
contact_person_designation VARCHAR(100) NULL
contact_person_phone VARCHAR(20) NULL
contact_person_email VARCHAR(255) NULL
established_year    INT NULL
employee_count      INT NULL
annual_turnover     DECIMAL(15,2) NULL
profile_completed   BOOLEAN DEFAULT FALSE
created_at          TIMESTAMP NULL
updated_at          TIMESTAMP NULL
deleted_at          TIMESTAMP NULL
```

**Indexes**:
- PRIMARY KEY (`id`)
- INDEX `idx_organizations_type` (`type`)
- INDEX `idx_organizations_profile_completed` (`profile_completed`)

**Relationships**:
- `hasMany` → Units
- `hasMany` → Users
- `hasMany` → Applications
- `hasMany` → SupportTickets

**Model**: [`app/Models/Organization.php`](../../app/Models/Organization.php)

**Migration**: [`2024_01_01_000001_create_organizations_table.php`](../../database/migrations/2024_01_01_000001_create_organizations_table.php)

---

### 2. Units

**Purpose**: Sub-entities within organizations (branches, divisions, plants)

**Table**: `units`

**Columns**:
```sql
id                  BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
organization_id     BIGINT UNSIGNED NOT NULL
name                VARCHAR(255) NOT NULL
type                VARCHAR(100) NULL (e.g., 'head_office', 'branch', 'manufacturing_plant')
address             TEXT NULL
city                VARCHAR(100) NULL
state               VARCHAR(100) NULL
pincode             VARCHAR(10) NULL
country             VARCHAR(100) DEFAULT 'India'
phone               VARCHAR(20) NULL
email               VARCHAR(255) NULL
manager_name        VARCHAR(255) NULL
manager_phone       VARCHAR(20) NULL
manager_email       VARCHAR(255) NULL
is_active           BOOLEAN DEFAULT TRUE
created_at          TIMESTAMP NULL
updated_at          TIMESTAMP NULL
deleted_at          TIMESTAMP NULL

FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
```

**Indexes**:
- PRIMARY KEY (`id`)
- FOREIGN KEY (`organization_id`)
- INDEX `idx_units_organization_active` (`organization_id`, `is_active`)

**Relationships**:
- `belongsTo` → Organization
- `hasMany` → Users
- `hasMany` → Applications

**Model**: [`app/Models/Unit.php`](../../app/Models/Unit.php)

---

### 3. Users

**Purpose**: System users with authentication and RBAC

**Table**: `users`

**Columns**:
```sql
id                  BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
organization_id     BIGINT UNSIGNED NULL
unit_id             BIGINT UNSIGNED NULL
name                VARCHAR(255) NOT NULL
email               VARCHAR(255) UNIQUE NOT NULL
email_verified_at   TIMESTAMP NULL
password            VARCHAR(255) NOT NULL
phone               VARCHAR(20) NULL
designation         VARCHAR(100) NULL
department          VARCHAR(100) NULL
is_active           BOOLEAN DEFAULT TRUE
otp_code            VARCHAR(255) NULL           -- Hashed OTP
otp_expires_at      TIMESTAMP NULL              -- OTP expiry
otp_attempts        INT DEFAULT 0               -- Failed OTP attempts
otp_locked_until    TIMESTAMP NULL              -- Lockout timestamp
last_login_at       TIMESTAMP NULL
last_login_ip       VARCHAR(45) NULL
session_token       VARCHAR(255) NULL           -- For single session enforcement
remember_token      VARCHAR(100) NULL
created_at          TIMESTAMP NULL
updated_at          TIMESTAMP NULL
deleted_at          TIMESTAMP NULL

FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL
```

**Indexes**:
- PRIMARY KEY (`id`)
- UNIQUE (`email`)
- FOREIGN KEY (`organization_id`)
- FOREIGN KEY (`unit_id`)
- INDEX `idx_users_organization_email_verified` (`organization_id`, `email_verified_at`)
- INDEX `idx_users_is_active` (`is_active`)

**Relationships**:
- `belongsTo` → Organization
- `belongsTo` → Unit
- `belongsToMany` → Roles (via `user_role` pivot)
- `hasMany` → Applications (as creator)
- `belongsToMany` → Assessments (via `application_assessment_team_members`, as lead/co-assessor — see [Assessments](#8-assessments))
- `hasMany` → Notifications
- `morphMany` → AuditLogs

**Model**: [`app/Models/User.php`](../../app/Models/User.php)

---

### 4. Roles & Permissions (RBAC)

#### Roles Table

**Table**: `roles`

**Columns**:
```sql
id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
name        VARCHAR(100) UNIQUE NOT NULL
slug        VARCHAR(100) UNIQUE NOT NULL
description TEXT NULL
is_system   BOOLEAN DEFAULT FALSE            -- System-defined roles (cannot be deleted)
created_at  TIMESTAMP NULL
updated_at  TIMESTAMP NULL
```

**9 Predefined Roles** (`database/seeders/RoleSeeder.php`):
1. System Admin - Full system access
2. DRDO Admin - DRDO administrative oversight and approval authority
3. DRDO Lab - Read-only access to certified enterprises
4. Operations Manager - Manages operations team and oversees assessment processes
5. Operations Admin - Day-to-day operations and application processing
6. Assessor - Conducts assessments and evaluations
7. Enterprise Admin - Organization administrator with full org-level access
8. Unit Admin - Unit-level administrator within an organization
9. ERP Integration - Machine account for the Business Central ERP integration

**Relationships**:
- `belongsToMany` → Users (via `user_role`)
- `belongsToMany` → Permissions (via `role_permission`)

**Model**: [`app/Models/Role.php`](../../app/Models/Role.php)

---

#### Permissions Table

**Table**: `permissions`

**Columns**:
```sql
id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
name        VARCHAR(100) UNIQUE NOT NULL
slug        VARCHAR(100) UNIQUE NOT NULL
module      VARCHAR(50) NOT NULL                 -- Module grouping
description TEXT NULL
created_at  TIMESTAMP NULL
updated_at  TIMESTAMP NULL
```

**60+ Permissions** across 12 modules:
- `organizations` (view, create, update, delete)
- `units` (view, create, update, delete)
- `applications` (view, create, update, submit, review, approve, reject)
- `assessments` (view, create, allocate, conduct, submit, qc-review)
- `payments` (view, initiate)
- `certificates` (view, issue, approve, suspend, revoke)
- `committees` (view, create, schedule, record-decisions)
- `users` (view, create, update, delete, assign-roles)
- `roles` (view, create, update, delete, assign-permissions)
- `audit-logs` (view, export)
- `notifications` (view, send, manage-templates)
- `documents` (view, upload, delete)

**Relationships**:
- `belongsToMany` → Roles (via `role_permission`)

**Model**: [`app/Models/Permission.php`](../../app/Models/Permission.php)

---

#### Pivot Tables

**user_role**:
```sql
id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
user_id     BIGINT UNSIGNED NOT NULL
role_id     BIGINT UNSIGNED NOT NULL
assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
expires_at  TIMESTAMP NULL                       -- Role assignment expiry (optional)
assigned_by BIGINT UNSIGNED NULL

FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
UNIQUE (user_id, role_id)
```

**role_permission**:
```sql
id            BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
role_id       BIGINT UNSIGNED NOT NULL
permission_id BIGINT UNSIGNED NOT NULL

FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
UNIQUE (role_id, permission_id)
```

---

## Application Lifecycle Tables

### 5. Applications

**Purpose**: Main certification applications

**Table**: `applications`

**Columns**:
```sql
id                   BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
organization_id      BIGINT UNSIGNED NOT NULL
unit_id              BIGINT UNSIGNED NULL
application_number   VARCHAR(50) UNIQUE NOT NULL      -- Format: APP-YYYY-ORGID-NNNNNN
type                 ENUM('initial', 'renewal', 'upgrade', 'surveillance') NOT NULL
scope                TEXT NOT NULL                     -- Certification scope
standard             VARCHAR(100) NULL                 -- ISO standard
status               VARCHAR(50) DEFAULT 'draft'
title                VARCHAR(255) NULL
description          TEXT NULL
remarks              TEXT NULL
submitted_at         TIMESTAMP NULL
approved_at          TIMESTAMP NULL
rejected_at          TIMESTAMP NULL
certified_at         TIMESTAMP NULL
created_by           BIGINT UNSIGNED NULL
created_at           TIMESTAMP NULL
updated_at           TIMESTAMP NULL
deleted_at           TIMESTAMP NULL

FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
```

**Status Values**: see `app/Services/StateMachine/ApplicationStateMachine.php` (authoritative source — also see [State Machines](13-state-machines.md)).

**Indexes**:
- PRIMARY KEY (`id`)
- UNIQUE (`application_number`)
- FOREIGN KEY (`organization_id`, `unit_id`, `created_by`)
- INDEX `idx_applications_org_status` (`organization_id`, `status`)
- INDEX `idx_applications_status_created` (`status`, `created_at`)
- INDEX `idx_applications_type_status` (`type`, `status`)

**Relationships**:
- `belongsTo` → Organization
- `belongsTo` → Unit
- `belongsTo` → User (creator)
- `hasMany` → ApplicationProducts
- `hasMany` → ApplicationCustomers
- `hasMany` → ApplicationProcesses
- `hasMany` → ApplicationOutsourcedProcesses
- `hasMany` → RawMaterials
- `hasMany` → ThirdPartyCertifications
- `hasOne` → Assessment
- `hasOne` → Payment
- `hasOne` → Certificate
- `hasMany` → ApplicationStatusHistories
- `belongsToMany` → CommitteeMeetings
- `morphMany` → Documents
- `morphMany` → AuditLogs

**Model**: [`app/Models/Application.php`](../../app/Models/Application.php)

**See Also**: [Application Workflow](../20-features/23-application-workflow.md)

---

### 6. Application Sub-Entities

#### ApplicationProducts

**Purpose**: Products/services being certified

**Table**: `application_products`

**Columns**:
```sql
id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
application_id  BIGINT UNSIGNED NOT NULL
product_name    VARCHAR(255) NOT NULL
product_code    VARCHAR(100) NULL
description     TEXT NULL
hsn_code        VARCHAR(20) NULL
category        VARCHAR(100) NULL
created_at      TIMESTAMP NULL
updated_at      TIMESTAMP NULL
deleted_at      TIMESTAMP NULL

FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
```

---

#### ApplicationCustomers

**Purpose**: Key customers of the applicant

**Table**: `application_customers`

**Columns**:
```sql
id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
application_id  BIGINT UNSIGNED NOT NULL
customer_name   VARCHAR(255) NOT NULL
customer_type   VARCHAR(100) NULL (e.g., 'government', 'private', 'public_sector')
location        VARCHAR(255) NULL
relationship    VARCHAR(255) NULL
created_at      TIMESTAMP NULL
updated_at      TIMESTAMP NULL
deleted_at      TIMESTAMP NULL

FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
```

---

#### ApplicationProcesses

**Purpose**: Manufacturing/operational processes

**Table**: `application_processes`

**Columns**:
```sql
id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
application_id  BIGINT UNSIGNED NOT NULL
process_name    VARCHAR(255) NOT NULL
process_type    VARCHAR(100) NULL
description     TEXT NULL
location        VARCHAR(255) NULL
equipment       TEXT NULL
created_at      TIMESTAMP NULL
updated_at      TIMESTAMP NULL
deleted_at      TIMESTAMP NULL

FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
```

---

#### ApplicationOutsourcedProcesses

**Purpose**: Outsourced processes and vendors

**Table**: `application_outsourced_processes`

**Columns**:
```sql
id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
application_id  BIGINT UNSIGNED NOT NULL
process_name    VARCHAR(255) NOT NULL
vendor_name     VARCHAR(255) NOT NULL
vendor_address  TEXT NULL
reason          TEXT NULL
created_at      TIMESTAMP NULL
updated_at      TIMESTAMP NULL
deleted_at      TIMESTAMP NULL

FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
```

---

#### RawMaterials

**Purpose**: Key raw materials used

**Table**: `raw_materials`

**Columns**:
```sql
id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
application_id  BIGINT UNSIGNED NOT NULL
material_name   VARCHAR(255) NOT NULL
material_code   VARCHAR(100) NULL
supplier_name   VARCHAR(255) NULL
specification   TEXT NULL
created_at      TIMESTAMP NULL
updated_at      TIMESTAMP NULL
deleted_at      TIMESTAMP NULL

FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
```

---

#### ThirdPartyCertifications

**Purpose**: Existing certifications held by applicant

**Table**: `third_party_certifications`

**Columns**:
```sql
id                  BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
application_id      BIGINT UNSIGNED NOT NULL
certification_name  VARCHAR(255) NOT NULL
certification_body  VARCHAR(255) NOT NULL
certificate_number  VARCHAR(100) NULL
issue_date          DATE NULL
expiry_date         DATE NULL
scope               TEXT NULL
created_at          TIMESTAMP NULL
updated_at          TIMESTAMP NULL
deleted_at          TIMESTAMP NULL

FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
```

---

### 7. ApplicationStatusHistory

**Purpose**: Track application status changes over time

**Table**: `application_status_histories`

**Columns**:
```sql
id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
application_id  BIGINT UNSIGNED NOT NULL
old_status      VARCHAR(50) NULL
new_status      VARCHAR(50) NOT NULL
changed_by      BIGINT UNSIGNED NULL
remarks         TEXT NULL
changed_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP

FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
```

**Indexes**:
- INDEX `idx_status_history_application_changed` (`application_id`, `changed_at`)

---

## Assessment & Scoring Tables

### 8. Assessments

**Purpose**: Assessment records

**Table**: `application_assessments` (the `Assessment` model sets `protected $table = 'application_assessments'` — there is no `assessments` table)

**Columns and indexes**: see `database/migrations/2026_02_07_000601_create_application_assessments_table.php` for the current, authoritative definition — the column set here had drifted too far from that migration to correct in place (invented columns like `lead_assessor_id`, `team_assessors`, `scheduled_date`/`scheduled_time`, `location`, `assessment_type` that don't exist; missing real ones like `organization_id`, `unit_id`, `step_progress`, `committee_remarks`/`committee_feedback`, `cancellation_reason`).

**Status Values**: see `app/Services/StateMachine/AssessmentStateMachine.php` (authoritative source — also see [State Machines](13-state-machines.md)).

**Relationships** (see [`app/Models/Assessment.php`](../../app/Models/Assessment.php) for the full list):
- `belongsTo` → Application, Organization, Unit
- `hasMany` → team members (`application_assessment_team_members` — see below), status histories, parameters, questions, responses

**Model**: [`app/Models/Assessment.php`](../../app/Models/Assessment.php)

**See Also**: [Assessment Workflow](../20-features/24-assessment-workflow.md)

---

### 8a. Application Assessment Team Members

**Purpose**: Assessor team assignment per assessment (replaces the invented `lead_assessor_id`/`team_assessors` columns above — there is no single lead-assessor column; team membership, including the lead-assessor role, is its own table)

**Table**: `application_assessment_team_members`

**Columns**: `assessment_id`, `user_id`, `role` (enum: `lead_assessor`, `co_assessor`), timestamps. Unique on (`assessment_id`, `user_id`).

**Model**: `app/Models/AssessmentTeamMember.php`

**Migration**: [`database/migrations/2026_02_07_000602_create_application_assessment_team_members_table.php`](../../database/migrations/2026_02_07_000602_create_application_assessment_team_members_table.php)

---

### 9. Assessment Scoring Schema

There is no `Scorecard` model or `scorecards`/`questions`/`options`/`parameters` table. The real
scoring schema splits into master (org-independent question bank) and per-application
(snapshotted per assessment via `Assessment::copyAssessmentData()`) tables:

**Master data**:
- `assessment_parameters` — criteria grouping. [`app/Models/AssessmentParameter.php`](../../app/Models/AssessmentParameter.php) · [migration](../../database/migrations/2026_02_07_000501_create_assessment_parameters_table.php)
- `assessment_questions` — questions under a parameter. [`app/Models/AssessmentQuestion.php`](../../app/Models/AssessmentQuestion.php) · [migration](../../database/migrations/2026_02_07_000502_create_assessment_questions_table.php)
- `assessment_question_options` — scored answer options per question. [`app/Models/AssessmentQuestionOption.php`](../../app/Models/AssessmentQuestionOption.php) · [migration](../../database/migrations/2026_02_07_000503_create_assessment_question_options_table.php)

**Per-application data**:
- `application_assessment_parameters` — [`app/Models/ApplicationAssessmentParameter.php`](../../app/Models/ApplicationAssessmentParameter.php) · [migration](../../database/migrations/2026_02_07_000603_create_application_assessment_parameters_table.php)
- `application_assessment_questions` — carries its 5 answer options inline (`option_1_text`..`option_5_text`/`_score` columns), not a separate options table. [`app/Models/ApplicationAssessmentQuestion.php`](../../app/Models/ApplicationAssessmentQuestion.php) · [migration](../../database/migrations/2026_02_07_000604_create_application_assessment_questions_table.php)
- `application_assessment_responses` — the assessor's answer per question; this is what the previously-documented "Scorecards" table stood in for. [`app/Models/ApplicationAssessmentResponse.php`](../../app/Models/ApplicationAssessmentResponse.php) · [migration](../../database/migrations/2026_02_07_000605_create_application_assessment_responses_table.php)
- `application_assessment_response_evidences` — file/photo evidence attached to a response. [`app/Models/ApplicationAssessmentResponseEvidence.php`](../../app/Models/ApplicationAssessmentResponseEvidence.php) · [migration](../../database/migrations/2026_02_07_000606_create_application_assessment_response_evidences_table.php)
- `application_assessment_question_feedbacks` — QC/committee feedback threaded per question. [`app/Models/ApplicationAssessmentQuestionFeedback.php`](../../app/Models/ApplicationAssessmentQuestionFeedback.php) · [migration](../../database/migrations/2026_02_07_000607_create_application_assessment_question_feedbacks_table.php)

The schema also has further assessment-execution tables (attendance, site pictures, site tour
pictures, meetings and meeting participants/comments, basic information) not detailed here —
see [`database/migrations/`](../../database/migrations/) (files dated `2026_02_07_00060x` onward)
for the full set.

---

### 10. AssessmentStatusHistory

**Purpose**: Track assessment status changes

**Table**: `application_assessment_status_histories` (not `assessment_status_histories`)

**Columns**: see [`database/migrations/2026_02_07_000608_create_application_assessment_status_histories_table.php`](../../database/migrations/2026_02_07_000608_create_application_assessment_status_histories_table.php) for the current definition.

**Model**: [`app/Models/AssessmentStatusHistory.php`](../../app/Models/AssessmentStatusHistory.php)

---

## Payment Tables

### 11. Payments

**Purpose**: Payment transactions

**Table**: `payments`

**Columns**:
```sql
id                  BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
application_id      BIGINT UNSIGNED UNIQUE NOT NULL
payment_number      VARCHAR(50) UNIQUE NOT NULL     -- Format: TXN{unix_millis}{4 uppercase hex}, e.g. TXN1705312345678A3F9
amount              DECIMAL(10,2) NOT NULL
currency            VARCHAR(3) DEFAULT 'INR'
gateway             VARCHAR(50) NOT NULL            -- 'icici_eazypay'
gateway_order_id    VARCHAR(255) NULL
gateway_payment_id  VARCHAR(255) NULL
gateway_signature   VARCHAR(255) NULL
status              VARCHAR(50) DEFAULT 'initiated'
payment_method      VARCHAR(50) NULL
paid_at             TIMESTAMP NULL
failed_at           TIMESTAMP NULL
failure_reason      TEXT NULL
metadata            JSON NULL
created_at          TIMESTAMP NULL
updated_at          TIMESTAMP NULL
deleted_at          TIMESTAMP NULL

FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
```

**Status Values**: `initiated`, `pending`, `processing`, `success`, `failed`, `cancelled` (no refund statuses — refund support was dropped).
- `initiated` - Payment record created, not yet sent to gateway
- `pending` - Sent to gateway, awaiting user action
- `processing` - Being processed by gateway
- `success` - Payment successful
- `failed` - Payment failed
- `cancelled` - Payment cancelled by user

**Indexes**:
- PRIMARY KEY (`id`)
- UNIQUE (`payment_number`, `application_id`)
- INDEX `idx_payments_status_paid` (`status`, `paid_at`)
- INDEX `idx_payments_gateway_order` (`gateway`, `gateway_order_id`)

**Relationships**:
- `belongsTo` → Application
- `hasMany` → PaymentReconciliations

**Model**: [`app/Models/Payment.php`](../../app/Models/Payment.php)

**See Also**: [Payment Processing](../20-features/26-payment-processing.md)

---

### 12. PaymentReconciliations

**Purpose**: Payment reconciliation records

**Table**: `payment_reconciliations`

**Columns**:
```sql
id                  BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
payment_id          BIGINT UNSIGNED NOT NULL
reconciled_amount   DECIMAL(10,2) NOT NULL
reconciled_by       BIGINT UNSIGNED NULL
reconciliation_date DATE NOT NULL
notes               TEXT NULL
status              VARCHAR(50) DEFAULT 'pending'
created_at          TIMESTAMP NULL
updated_at          TIMESTAMP NULL

FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
FOREIGN KEY (reconciled_by) REFERENCES users(id) ON DELETE SET NULL
```

---

## Committee & Certificate Tables

### 13. CommitteeMeetings

**Purpose**: Committee meeting management

**Table**: `committee_meetings`

**Columns**:
```sql
id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
meeting_number  VARCHAR(50) UNIQUE NOT NULL
meeting_date    DATE NOT NULL
meeting_time    TIME NULL
location        VARCHAR(255) NULL
agenda          TEXT NULL
minutes         TEXT NULL
status          VARCHAR(50) DEFAULT 'scheduled'
chairperson_id  BIGINT UNSIGNED NULL
created_by      BIGINT UNSIGNED NULL
created_at      TIMESTAMP NULL
updated_at      TIMESTAMP NULL
deleted_at      TIMESTAMP NULL

FOREIGN KEY (chairperson_id) REFERENCES users(id) ON DELETE SET NULL
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
```

**Status Values**:
- `scheduled` - Meeting scheduled
- `in_progress` - Meeting in progress
- `completed` - Meeting completed
- `cancelled` - Meeting cancelled

**Relationships**:
- `belongsTo` → User (chairperson)
- `belongsToMany` → Users (members, via pivot)
- `belongsToMany` → Applications (via pivot)
- `hasMany` → CommitteeDecisions

**Model**: [`app/Models/CommitteeMeeting.php`](../../app/Models/CommitteeMeeting.php)

---

### 14. CommitteeDecisions

**Purpose**: Committee decisions on applications

**Table**: `committee_decisions`

**Columns**:
```sql
id                  BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
committee_meeting_id BIGINT UNSIGNED NOT NULL
application_id      BIGINT UNSIGNED NOT NULL
decision            VARCHAR(50) NOT NULL            -- 'approve', 'conditional_approve', 'reject', 'defer'
conditions          TEXT NULL
reasons             TEXT NULL
validity_period     INT NULL                        -- Months
certificate_type    VARCHAR(50) NULL
notes               TEXT NULL
decided_at          TIMESTAMP NULL
created_at          TIMESTAMP NULL
updated_at          TIMESTAMP NULL
deleted_at          TIMESTAMP NULL

FOREIGN KEY (committee_meeting_id) REFERENCES committee_meetings(id) ON DELETE CASCADE
FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
```

**Relationships**:
- `belongsTo` → CommitteeMeeting
- `belongsTo` → Application

**Model**: [`app/Models/CommitteeDecision.php`](../../app/Models/CommitteeDecision.php)

---

### 15. Certificates

**Purpose**: Certificate issuance and management

**Table**: `certificates`

**Columns**:
```sql
id                  BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
application_id      BIGINT UNSIGNED UNIQUE NOT NULL
certificate_number  VARCHAR(100) UNIQUE NOT NULL    -- Format: {DDMMYYYY}_{samar_id tail}, '-N' on same-day collision
certificate_type    VARCHAR(50) NOT NULL            -- 'initial' or 'renewal' (only these two are ever assigned)
scope               TEXT NOT NULL
standard            VARCHAR(100) NULL
issue_date          DATE NOT NULL
expiry_date         DATE NOT NULL
validity_period     INT NULL                        -- Months
status              ENUM('active','expired','suspended','revoked','renewed') DEFAULT 'active'
issued_by           BIGINT UNSIGNED NULL
approved_by         BIGINT UNSIGNED NULL
approved_at         TIMESTAMP NULL
suspended_from      DATE NULL
suspended_until     DATE NULL
suspension_reason   TEXT NULL
revoked_at          TIMESTAMP NULL
revocation_reason   TEXT NULL
certificate_path    VARCHAR(255) NULL               -- PDF file path
qr_code             TEXT NULL
verification_code   VARCHAR(50) NULL
created_at          TIMESTAMP NULL
updated_at          TIMESTAMP NULL
deleted_at          TIMESTAMP NULL

FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE SET NULL
FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
```

**Status Values** (`status` enum): `active`, `expired`, `suspended`, `revoked`, `renewed`.
- `active` - Certificate active and valid (default on issue)
- `expired` - Certificate expired
- `suspended` - Certificate temporarily suspended
- `revoked` - Certificate permanently revoked
- `renewed` - Superseded by a renewal certificate (predecessor is set to this on renewal)

**Certificate Types**: `initial` or `renewal` — determined by whether any prior certificate
exists for the organization/unit (`AssessmentStateMachine::determineCertificateType()`). The
certificate number is not `CERT-*`; it's generated in legacy format
`{DDMMYYYY}_{samar_id tail}` (with a `-N` suffix on same-day collisions) by
`AssessmentStateMachine::generateCertificateNumber()`.

**Indexes**:
- PRIMARY KEY (`id`)
- UNIQUE (`certificate_number`, `application_id`)
- INDEX `idx_certificates_status_expiry` (`status`, `expiry_date`)
- INDEX `idx_certificates_verification` (`verification_code`)

**Relationships**:
- `belongsTo` → Application
- `belongsTo` → User (issued_by)
- `belongsTo` → User (approved_by)

**Model**: [`app/Models/Certificate.php`](../../app/Models/Certificate.php)

**See Also**: [Certificate Management](../20-features/25-certificate-management.md)

---

## Notification Tables

### 16. NotificationTemplates

**Purpose**: Email notification template management

**Table**: `notification_templates`

**Columns**:
```sql
id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
slug            VARCHAR(100) UNIQUE NOT NULL
name            VARCHAR(255) NOT NULL
description     TEXT NULL
event           VARCHAR(100) NOT NULL
category        VARCHAR(50) NOT NULL
subject         VARCHAR(255) NOT NULL
body            TEXT NOT NULL
body_text       TEXT NULL
variables       JSON NULL
recipient_roles JSON NULL
is_active       BOOLEAN DEFAULT TRUE
priority        INT DEFAULT 5
created_at      TIMESTAMP NULL
updated_at      TIMESTAMP NULL
deleted_at      TIMESTAMP NULL
```

**Note**: System now supports **email notifications only**. In-app, SMS, and Push notification support was removed in version 3.0.

**Key Changes in v3.0**:
- Removed `send_email`, `send_in_app` flags (email is implicit)
- Removed `in_app_title`, `in_app_body`, `in_app_action_url` columns
- Removed `channels` JSON column
- Renamed `email_subject` → `subject`
- Renamed `email_body` → `body`
- Renamed `email_body_text` → `body_text`

**11 Default Templates**:
- `payment-received`
- `assessment-scheduled`
- `qc-feedback-required`
- `certificate-issued`
- `password-reset`
- `otp-verification`
- `user-created`
- `application-approved`
- `assessment-completed`

**Model**: [`app/Models/NotificationTemplate.php`](../../app/Models/NotificationTemplate.php)

**See Also**: [Notifications](../20-features/28-notifications.md)

---

### 17. NotificationEvents

**Purpose**: Track email notification delivery status

**Table**: `notification_events`

**Columns**:
```sql
id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
user_id         BIGINT UNSIGNED NOT NULL
template_id     BIGINT UNSIGNED NOT NULL
subject         VARCHAR(255) NOT NULL
body            TEXT NOT NULL
priority        VARCHAR(20) DEFAULT 'normal'
status          VARCHAR(50) DEFAULT 'pending'
sent            BOOLEAN DEFAULT FALSE
sent_at         TIMESTAMP NULL
failed_at       TIMESTAMP NULL
failure_reason  TEXT NULL
metadata        JSON NULL
created_at      TIMESTAMP NULL
updated_at      TIMESTAMP NULL

FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
FOREIGN KEY (template_id) REFERENCES notification_templates(id) ON DELETE CASCADE
```

**Note**: This table tracks email delivery only. In-app notification tracking (is_read, read_at) was removed in v3.0.

**Key Changes in v3.0**:
- Renamed `sent_email` → `sent`
- Renamed `email_subject` → `subject`
- Renamed `email_body` → `body`
- Renamed `sent_email_at` → `sent_at`
- Removed `is_read`, `read_at` columns (no in-app tracking)
- Removed `channels` JSON column

**Status Values**:
- `pending` - Queued for sending
- `sent` - Successfully sent via email
- `failed` - Failed to send

**Indexes**:
- INDEX `idx_notification_events_user_status` (`user_id`, `status`)
- INDEX `idx_notification_events_sent_at` (`sent_at`)

---

## Audit & Support Tables

### 18. AuditLogs

**Purpose**: Complete audit trail for all data changes

**Table**: `audit_logs`

**Columns**:
```sql
id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
auditable_type  VARCHAR(255) NOT NULL           -- Model class name
auditable_id    BIGINT UNSIGNED NOT NULL        -- Model ID
user_id         BIGINT UNSIGNED NULL
action          VARCHAR(50) NOT NULL            -- 'created', 'updated', 'deleted'
old_values      JSON NULL
new_values      JSON NULL
ip_address      VARCHAR(45) NULL
user_agent      TEXT NULL
created_at      TIMESTAMP NULL

INDEX (auditable_type, auditable_id)
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
```

**Polymorphic Relationship**:
- Any model using `HasAuditLog` trait automatically logs changes

**Model**: [`app/Models/AuditLog.php`](../../app/Models/AuditLog.php)

**See Also**: [Audit Trail](../20-features/29-audit-trail.md)

---

### 19. Documents

**Purpose**: Polymorphic document storage

**Table**: `documents`

**Columns**:
```sql
id                  BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
documentable_type   VARCHAR(255) NOT NULL           -- Model class name
documentable_id     BIGINT UNSIGNED NOT NULL        -- Model ID
document_type       VARCHAR(100) NOT NULL           -- 'application_form', 'certificate', 'invoice', etc.
file_name           VARCHAR(255) NOT NULL
file_path           VARCHAR(255) NOT NULL
file_size           INT NULL
mime_type           VARCHAR(100) NULL
uploaded_by         BIGINT UNSIGNED NULL
is_public           BOOLEAN DEFAULT FALSE
created_at          TIMESTAMP NULL
updated_at          TIMESTAMP NULL
deleted_at          TIMESTAMP NULL

INDEX (documentable_type, documentable_id)
FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
```

**Polymorphic Relationship**:
- Can attach to any model (Applications, Assessments, Certificates, etc.)

**Model**: [`app/Models/Document.php`](../../app/Models/Document.php)

**See Also**: [Document Management](../20-features/27-document-management.md)

---

### 20. SupportTickets

**Purpose**: Support ticket management

**Table**: `support_tickets`

**Columns**:
```sql
id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
ticket_number   VARCHAR(50) UNIQUE NOT NULL
organization_id BIGINT UNSIGNED NULL
user_id         BIGINT UNSIGNED NOT NULL
application_id  BIGINT UNSIGNED NULL
subject         VARCHAR(255) NOT NULL
description     TEXT NOT NULL
category        VARCHAR(100) NULL
priority        VARCHAR(20) DEFAULT 'normal'
status          VARCHAR(50) DEFAULT 'open'
assigned_to     BIGINT UNSIGNED NULL
external_ticket_id VARCHAR(255) NULL           -- Zoho Desk ticket ID
closed_at       TIMESTAMP NULL
created_at      TIMESTAMP NULL
updated_at      TIMESTAMP NULL
deleted_at      TIMESTAMP NULL

FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE SET NULL
FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
```

**Status Values**:
- `open` - New ticket
- `in_progress` - Being worked on
- `awaiting_response` - Waiting for user response
- `resolved` - Issue resolved
- `closed` - Ticket closed

**Priority Values**:
- `low`, `normal`, `high`, `urgent`

**Relationships**:
- `belongsTo` → Organization
- `belongsTo` → User (creator)
- `belongsTo` → Application (optional)
- `belongsTo` → User (assigned_to)
- `hasMany` → SupportTicketComments

**Model**: [`app/Models/SupportTicket.php`](../../app/Models/SupportTicket.php)

**See Also**: [Support Tickets](../20-features/33-support-tickets.md)

---

### 21. SupportTicketComments

**Purpose**: Comments/replies on support tickets

**Table**: `support_ticket_comments`

**Columns**:
```sql
id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
ticket_id       BIGINT UNSIGNED NOT NULL
user_id         BIGINT UNSIGNED NOT NULL
comment         TEXT NOT NULL
is_internal     BOOLEAN DEFAULT FALSE           -- Internal note (not visible to user)
created_at      TIMESTAMP NULL
updated_at      TIMESTAMP NULL
deleted_at      TIMESTAMP NULL

FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
```

**Relationships**:
- `belongsTo` → SupportTicket
- `belongsTo` → User

**Model**: [`app/Models/SupportTicketComment.php`](../../app/Models/SupportTicketComment.php)

---

## System Tables

### 22. Sessions

**Purpose**: Laravel session management

**Table**: `sessions`

**Columns**:
```sql
id              VARCHAR(255) PRIMARY KEY
user_id         BIGINT UNSIGNED NULL
ip_address      VARCHAR(45) NULL
user_agent      TEXT NULL
payload         LONGTEXT NOT NULL
last_activity   INT NOT NULL

INDEX (user_id)
INDEX (last_activity)
```

---

## Performance Indexes

### Search Optimization Indexes

**Added in migration**: `2025_11_05_043941_add_search_indexes_to_tables.php`

**Organizations**:
```sql
INDEX idx_organizations_search (name, city, state)
INDEX idx_organizations_profile (profile_completed, created_at)
```

**Applications**:
```sql
INDEX idx_applications_search (application_number, scope)
INDEX idx_applications_org_status (organization_id, status, created_at)
INDEX idx_applications_type_status (type, status)
```

**Users**:
```sql
INDEX idx_users_search (name, email, designation)
INDEX idx_users_org_active (organization_id, is_active)
```

**Certificates**:
```sql
INDEX idx_certificates_search (certificate_number, status)
INDEX idx_certificates_expiry (expiry_date, status)
```

**Support Tickets**:
```sql
INDEX idx_tickets_search (ticket_number, subject)
INDEX idx_tickets_status (status, priority, created_at)
INDEX idx_tickets_assigned (assigned_to, status)
```

**Total**: 35+ composite indexes for optimal query performance

---

## Data Integrity

### Foreign Key Constraints

**Cascade Delete**:
- Parent entity deleted → Child records deleted
- Example: Organization deleted → Users, Applications deleted

**Set Null**:
- Referenced record deleted → Foreign key set to NULL
- Example: User deleted → created_by set to NULL

**Restrict**:
- Cannot delete if referenced records exist
- Example: Role with assigned users cannot be deleted

---

### Soft Deletes

**28 tables** implement soft deletes:
- Records marked as deleted (`deleted_at` timestamp)
- Not returned in normal queries
- Can be restored if needed
- Hard delete only when absolutely necessary

**Usage**:
```php
// Soft delete
$application->delete();

// Check if soft deleted
if ($application->trashed()) { }

// Include soft deleted
Application::withTrashed()->get();

// Restore
$application->restore();

// Force (permanent) delete
$application->forceDelete();
```

---

## Database Migrations

**Migration Naming**:
- Format: `YYYY_MM_DD_HHMMSS_description.php`
- Chronological order
- Descriptive names

**Running Migrations**:
```bash
# Run all pending migrations
php artisan migrate

# Rollback last batch
php artisan migrate:rollback

# Rollback specific steps
php artisan migrate:rollback --step=2

# Fresh migration (CAUTION: data loss)
php artisan migrate:fresh

# Refresh with seeders
php artisan migrate:fresh --seed

# Check migration status
php artisan migrate:status
```

**Code Reference**: [`database/migrations/`](../../database/migrations/)

---

## Database Seeders

### RoleSeeder

**Purpose**: Seed 8 predefined roles and 60+ permissions

**File**: `database/seeders/RoleSeeder.php`

**Roles & Permissions Seeded**:
- 8 roles (system_admin, drdo_admin, enterprise_admin, etc.)
- 60+ permissions across 12 modules
- Role-permission assignments

**Run**:
```bash
php artisan db:seed --class=RoleSeeder
```

---

### NotificationTemplateSeeder

**Purpose**: Seed 12 default notification templates

**File**: `database/seeders/NotificationTemplateSeeder.php`

**Templates Seeded**:
- Application lifecycle notifications
- Payment notifications
- Assessment notifications
- Certificate notifications

**Run**:
```bash
php artisan db:seed --class=NotificationTemplateSeeder
```

---

## Related Documentation

- [System Architecture](11-system-architecture.md) - Overall architecture
- [State Machines](13-state-machines.md) - Workflow details
- [Application Workflow](../20-features/23-application-workflow.md) - Application lifecycle
- [Assessment Workflow](../20-features/24-assessment-workflow.md) - Assessment process
- [Authorization & RBAC](../20-features/22-authorization-rbac.md) - Roles and permissions

---

## Summary

The QCI SAMAR database schema is:
- ✅ **Normalized** (3NF) for data integrity
- ✅ **Comprehensive** - Covers all certification lifecycle aspects
- ✅ **Auditable** - Complete audit trail with `audit_logs`
- ✅ **Recoverable** - Soft deletes on most tables
- ✅ **Flexible** - JSON columns for dynamic data
- ✅ **Scalable** - Multi-tenant architecture
- ✅ **Maintainable** - Clean migrations, well-defined relationships

---

**Last Updated**: January 2025
**Version**: 1.0
**Database Version**: MySQL 8.0+
