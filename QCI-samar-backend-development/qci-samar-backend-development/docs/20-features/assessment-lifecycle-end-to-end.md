---
title: "Assessment Lifecycle — End-to-End (Cross-Stack)"
category: "features"
tags: ["assessment", "lifecycle", "state-machine", "rating-committee", "qc", "mobile", "web"]
related:
  - ../10-architecture/13-state-machines.md
  - 23-application-workflow.md
  - assessment-score-calculation.md
  - 22-authorization-rbac.md
  - ../30-api/34-assessment-api.md
code_files:
  - app/Services/StateMachine/AssessmentStateMachine.php
  - app/Services/CommitteeMeetingAssessmentService.php
  - app/Services/Notification/CommitteeClarificationNotifier.php
  - app/Http/Controllers/Api/V1/AssessmentController.php
  - app/Http/Controllers/Api/V1/CommitteeMeetingController.php
last_updated: "2026-07-22"
version: "1.0"
---

# Assessment Lifecycle — End-to-End (Cross-Stack)

**Location**: `docs/20-features/assessment-lifecycle-end-to-end.md`
**Audience**: Anyone working on assessment, QC, Rating Committee, or certification — backend, web, or mobile.

This document is the **single source of truth** for how an assessment moves from creation to certification across the backend, web, and mobile stacks. It answers:

- What does each status mean?
- Which actor (role) drives each transition, and from which UI?
- What happens automatically as a side-effect of each transition (emails, pivot updates, audit rows)?
- Where does the cross-stack handoff happen (mobile ↔ web)?
- What design rules are non-negotiable, and why?

For the technical state-machine implementation details (`HasStateMachine` trait, guard syntax, `transitionTo` mechanics), see [13-state-machines.md](../10-architecture/13-state-machines.md). For RC score math, see [assessment-score-calculation.md](assessment-score-calculation.md). For role boundaries, see [22-authorization-rbac.md](22-authorization-rbac.md).

---

## 0. Scope

**This document covers both sectors.** Manufacturing is the reference flow described in §2–§8. Service-sector assessments run the **identical lifecycle** with exactly two deltas — online meeting, and applicant-supplied site photos the assessor selects from. See [§11](#11-service-sector--same-lifecycle-two-deltas).

## 1. Scope of each stack

| Stack | What it covers in the lifecycle |
|---|---|
| **Mobile** (`qci-samar-assessor-mobile`) | **Pre-submission, in-field work only.** Assessor uses it on-site: starting a scheduled assessment, performing the 7-step workflow (parameter allocation, site pictures, opening meeting, site tour, basic information, scoring questions with evidence, closing meeting), punch-in/out, then submitting for QC. **Mobile is not used after `submit_for_qc`.** |
| **Web** (`qci-samar-web`) | Everything else — application creation, allocation, QC review, Rating Committee meetings, certification, downstream visibility. Assessor's loop-back work (`address_qc_feedback`, `address_committee_feedback`) is **web only**. |
| **Backend** (`qci-samar-backend`) | The Laravel API + state machine that both clients call. Owns the source of truth for status, audit history, emails, certificates. |

This split is intentional. The mobile app deliberately scopes down to in-field assessor work; once submitted, the assessor switches to web for clarifications and certification follow-up. The web app's assessor sidebar (`coAssessor/manageAssessments/*`) carries the assessor through every post-submission state.

---

## 2. The 10 statuses

```
                                                                              ┌──────────────────────────┐
                                                                              ▼                          │
allocation_pending ──schedule──► scheduled ──start──► in_progress ──complete_mobile──► mobile_complete ──submit_for_qc──► submitted_for_qc
                                                                                                                                │
                                                                                      ┌───────────────────────┴────────────────┐
                                                                                      ▼                                        ▼
                                                                                qc_feedback ◄──qc_feedback──     ──qc_approve──► ready_for_committee
                                                                                      │                                          │
                                                                                      │ address_qc_feedback                      ▼ schedule_committee
                                                                                      └──────────────────────────────────────► committee_review
                                                                                                                                │  │  │
                                                                                                    ┌───────────────────────────┘  │  └────────────────┐
                                                                                                    ▼                              ▼                   ▼
                                                                                            committee_feedback         unschedule_committee     certified (terminal)
                                                                                                    │                  (back to ready_for_committee)
                                                                                                    ▼ address_committee_feedback
                                                                                            submitted_for_qc  (re-enters the QC loop)
```

Status enum (in `application_assessments.status`):

| # | Status | Meaning |
|---|---|---|
| 1 | `allocation_pending` | Assessment was auto-created when the parent application's payment completed. Waiting for ops_manager to assign a team and dates. |
| 2 | `scheduled` | Team allocated, dates set. Waiting for the lead assessor to start in-field. |
| 3 | `in_progress` | Assessor has started. All on-site work happens in this state (mobile). |
| 4 | `mobile_complete` | Every team member's mobile cutover is done (`complete_mobile`, gated on `isLeadAssessor` + all team members mobile-complete). Field work is finished; waiting for the lead to submit for QC. |
| 5 | `submitted_for_qc` | Lead assessor submitted for QC. Waiting for ops_manager QC review. |
| 6 | `qc_feedback` | QC sent it back with per-question feedback. Waiting for assessor to address. |
| 7 | `ready_for_committee` | QC approved. Waiting for ops_admin to attach to a Rating Committee meeting. |
| 8 | `committee_review` | Attached to an in-progress (or scheduled) meeting via the `committee_meeting_assessments` pivot. Waiting for committee decision. |
| 9 | `committee_feedback` | Committee sent it back with per-question feedback. Waiting for assessor to address. |
| 10 | `certified` | Terminal. Certificate row + PDF generated; emails sent. |

Backend guards for `submit_for_qc` (fired from `mobile_complete`, not directly from `in_progress`): `isLeadAssessor` + `allQuestionsAnswered` + `scoreCalculated`.

---

## 3. Cross-stack coverage matrix

For each transition: which role can fire it, and which UI exposes that action.

| Transition | From → To | Backend role guard | Web UI | Mobile UI | Notes |
|---|---|---|---|---|---|
| `schedule` | allocation_pending → scheduled | `ops_manager` OR `ops_admin` | `operationManager/manageAssessments/allocationPending/AllocationPendingDetails.jsx` → **Schedule Assessment** button → `OperationScheduleAssessmentModal` | — | **ops_admin is denied at the UI layer** — the modal is imported on the admin page but no button ever opens it (see §9 Known gaps). |
| `start` | scheduled → in_progress | team member (any) | — | `screens/user/Home.js` → **Start** button on a scheduled card | **Mobile-only by design.** Web has no Start UI. Gated to the lead assessor on mobile (`Home.js:241–263`) and only when all prior `in_progress` assessments for that assessor are 100% complete. |
| `complete_mobile` | in_progress → mobile_complete | any team member (per-member completion; transition itself requires `isLeadAssessor` + all team members mobile-complete) | — | Mobile app's offline outbox sync (`AssessmentService.completeMobile`, `useOutboxSync.js`) | Fired once every team member's mobile cutover is synced. Not a single "Submit" button — it is the outcome of the mobile offline-sync flow. |
| `submit_for_qc` | mobile_complete → submitted_for_qc | `lead_assessor` (pivot role) | `coAssessor/manageAssessments/inProgress/assessmentDetails/AssessmentDetails.jsx` → **Submit for QC** | `screens/user/assessment/AssessmentStepsList.js` → **Submit Assessment** | Both work and call the same endpoint. The lead can submit from either device. Backend gate: `isLeadAssessor` + `allQuestionsAnswered` + `scoreCalculated`. |
| `qc_feedback` | submitted_for_qc → qc_feedback | `ops_manager` | `operationManager/manageAssessments/qualityCheck/assessmentDetails/AssessmentDetails.jsx` → **Send Back** (with batched per-question comments via `AppOperationManagerQuestionModal`) | — | Backend body: `POST /assessments/{id}/qc-decision` `{action: 'provide_feedback', feedback: [{question_id, comment}, ...]}`. |
| `qc_approve` | submitted_for_qc → ready_for_committee | `ops_manager` | Same screen as above → **Approve** | — | Backend body: `POST /assessments/{id}/qc-decision` `{action: 'approve_for_committee'}`. |
| `address_qc_feedback` | qc_feedback → ready_for_committee | `lead_assessor` | `coAssessor/manageAssessments/qualityCheckFeedback/assessmentDetails/AssessmentDetails.jsx` → **Submit for Review** | — | **Web only.** Mobile does not surface QC-feedback assessments and has no resubmit flow. The assessor must use web for this. |
| `schedule_committee` | ready_for_committee → committee_review | `ops_manager` OR `ops_admin` | Implicit via `operationAdmin/ratingCommittee/Meetings/Meetings.jsx` → **Create Meeting** (`AddMeetingModal`) or **Edit Meeting** (`EditMeetingModal`). The pivot row is created by `CommitteeMeetingAssessmentService::attach`, which calls the transition in the same DB transaction. | — | There is a defined Redux thunk `scheduleCommitteeAction` for a hypothetical direct `POST /assessments/{id}/schedule-committee`, but it is never dispatched anywhere in the UI. All scheduling is pivot-driven. |
| `certify` | committee_review → certified | `ops_admin` | `operationAdmin/ratingCommittee/Meetings/ReviewAssessmentParameter.jsx` → **Certify** (flushes pending RC scores first via `PUT /assessments/{id}/rc-scores`, then `POST /assessments/{id}/committee-decision` `{action: 'certify'}`) | — | The decision is **recorded** here (pivot `decision = 'certified'`); the `certify` transition itself — Certificate row, PDF, certified-and-assessment-report email — is **applied when the meeting is closed** (`CommitteeMeetingController::complete`), keeping results hidden until then. |
| `committee_feedback` | committee_review → committee_feedback | `ops_admin` | Same screen → **Send Back** (with per-question feedback queued via `AppParameterQuestionsModal`, flushed on submit) | — | Backend body: `POST /assessments/{id}/committee-decision` `{action: 'provide_feedback', feedback: [...]}`. The decision is **recorded** here (pivot `decision = 'feedback'`); the `committee_feedback` transition and the clarification email to the assessor are **applied when the meeting is closed** (`CommitteeMeetingController::complete`). |
| `unschedule_committee` | committee_review → ready_for_committee | `ops_admin` | Implicit. Fires via: (a) `cancel` meeting (`Meetings.jsx` → `POST /committee-meetings/{id}/cancel`); (b) removing an assessment from an existing meeting (`EditMeetingModal` pivot detach). Both go through `CommitteeMeetingAssessmentService::detach` which calls the transition. | — | There is no standalone manual unschedule UI. |
| `address_committee_feedback` | committee_feedback → submitted_for_qc | `lead_assessor` | `coAssessor/manageAssessments/committeeReviewFeedback/assessmentDetails/AssessmentDetails.jsx` → **Submit for Review** | — | **Web only.** Same as `address_qc_feedback` — mobile does not surface these. Note the target: `submitted_for_qc`, not `ready_for_committee`. The assessor's response re-enters the QC loop, not the committee. |

---

## 4. Per-state walkthrough

For each state: how the assessment lands here, who acts on it, where they act, and what fires when they do.

### 4.1 `allocation_pending`

- **How we got here**: Application's `payment_completed` triggers `ApplicationStateMachine::syncToAssessment`, which creates the Assessment row. See `ApplicationStateMachine.php:285–329`.
- **Visible to**:
  - Web: `operations_manager` (sidebar entry "Allocation Pending"), `operations_admin` (read-only mirror), `drdo_admin` (read-only mirror)
  - Mobile: not surfaced (assessors aren't assigned yet)
- **Action**: `ops_manager` opens `AllocationPendingDetails` → **Schedule Assessment** → modal collects lead + co-assessors + start/end date → `POST /assessments/{id}/schedule`.
- **State machine transition**: `schedule` (allocation_pending → scheduled).
- **Side effects**: Creates `AssessmentTeamMember` rows (one `lead_assessor`, zero-or-more `co_assessor`). Audit history row written.
- **Emails**: Assessment-scheduled email to all team members.

### 4.2 `scheduled`

- **How we got here**: ops_manager allocated.
- **Visible to**:
  - Web: assessor sidebar entry "Scheduled" → list of their scheduled assessments; ops_manager/ops_admin/drdo_admin all have inspection screens
  - Mobile: Home screen "Scheduled" section (assessor only)
- **Action**: lead assessor opens mobile → Home screen → **Start** button on their next scheduled assessment.
- **State machine transition**: `start` (scheduled → in_progress).
- **Mobile gate**: Start is enabled only when (a) the user is the lead, (b) all of their `in_progress` assessments are 100% complete (one-at-a-time policy).
- **Side effects**: `started_at` timestamp recorded. Audit history row.
- **Emails**: none.

### 4.3 `in_progress`

- **How we got here**: assessor pressed Start on mobile.
- **Visible to**:
  - Web: assessor sidebar entry "In Progress" → assessment details + 7-step list. Web is **read-only** for the actual scoring (no per-question edit UI on web for in-progress).
  - Mobile: Home screen "In Progress" section
- **Where the work happens**: **mobile only**. The 7 in-field steps:
  1. **Parameter allocation** — lead assigns parameters to co-assessors via `POST /application-assessments/{id}/parameters/bulk-assign`.
  2. **Site pictures** — geo-tagged photos of the facility.
  3. **Opening meeting** — attendees, photos, comments.
  4. **Site tour** — geo-tagged tour photos.
  5. **Basic information** — masters (raw materials, products, customers, bought-out-parts, certifications).
  6. **Assessment parameters** — per-question scoring with `selectedOption`, `assessorRemarks`, evidence uploads. `PUT .../responses/{questionId}`. No auto-save — explicit Save & Next per question.
  7. **Closing meeting** — attendees, photos, comments.
- **When each team member's mobile work is synced**: the mobile app's offline outbox sync calls `completeMobile` (`AssessmentService.completeMobile`, `useOutboxSync.js`). Once **every** team member has synced, the backend fires `complete_mobile` (in_progress → **`mobile_complete`**), gated on `isLeadAssessor` + `allTeamMembersMobileComplete`. This is an intermediate status — no email fires on it.
- **Action when 100% complete**: from `mobile_complete`, lead presses **Submit Assessment** (mobile) OR **Submit for QC** (web `inProgress/AssessmentDetails`).
- **State machine transition**: `submit_for_qc` (mobile_complete → submitted_for_qc).
- **Backend guards**: `isLeadAssessor` AND `allQuestionsAnswered` (no null `selected_option`) AND `scoreCalculated` (assessment.total_score recomputed).
- **Side effects**: `submitted_at` timestamp. Audit row.
- **Emails**: "submitted for QC" to ops_manager.

### 4.4 `submitted_for_qc`

- **How we got here**: lead pressed Submit for QC.
- **Visible to**: ops_manager sidebar "Quality Check"; assessor sees their submission as read-only under "Quality Check"; ops_admin/drdo_admin inspection-only.
- **Action**: ops_manager opens the assessment → reviews per parameter/question via `AppOperationManagerQuestionModal` → marks individual questions as Approve or Send Back with comment → final **Approve** or **Send Back** button at the page level.
  - **Approve**: `POST /assessments/{id}/qc-decision` `{action: 'approve_for_committee'}` → transition `qc_approve` (→ ready_for_committee).
  - **Send Back**: `POST /assessments/{id}/qc-decision` `{action: 'provide_feedback', feedback: [...]}` → transition `qc_feedback` (→ qc_feedback).
- **Side effects**: ops_manager's review status (`qc_reviewed_by`, `qc_reviewed_at`) recorded. Per-question feedback rows in `application_assessment_question_feedbacks`. Audit history.
- **Emails**:
  - Approve (`qc_approve`): none — no email fires on QC approval (`AssessmentStatusChangedListener::mapToEmailEvent` has no mapping for `qc_approve`).
  - Send Back (`qc_feedback`): clarification email to the lead assessor + co-assessors.

### 4.5 `qc_feedback`

- **How we got here**: ops_manager sent back.
- **Visible to**: assessor sidebar "Quality Check Feedback" (highlighted entry); ops_manager (read-only awaiting response); others inspection-only.
- **Where the work happens**: **web only**. Mobile does not surface this state.
- **Action**: lead assessor opens the assessment → sees flagged questions → uses `AssessmentParameterDetails` to revise responses + post clarification replies (text + evidence) per flagged question → page-level **Submit for Review** when all flags are addressed.
  - Per-question reply: `POST /application-assessments/{id}/questions/{qid}/clarification` (or `PUT .../{feedbackId}` to update).
  - Page submit: `POST /assessments/{id}/address-qc-feedback` → transition `address_qc_feedback` (→ ready_for_committee).
- **Backend gate**: every flagged question has a clarification reply.
- **Side effects**: Question review statuses reset to `pending`. Audit row.
- **Emails**: notification to ops_manager that the assessor has resubmitted.

### 4.6 `ready_for_committee`

- **How we got here**: either (a) ops_manager approved at QC, or (b) ops_admin/ops_manager cancelled a meeting / removed this assessment from an in-progress meeting.
- **Visible to**: ops_admin sidebar "Ready for Committee Review"; others inspection-only.
- **Action**: ops_admin opens `Meetings.jsx` → **Create Meeting** or **Edit Meeting**. The `AddMeetingModal` pre-fetches available assessments via `GET /assessments?status=ready_for_committee`. The list is filtered server-side to exclude any assessment that already has a pending pivot row in a scheduled/in_progress meeting (defense against double-attachment — see [§6](#6-critical-design-rules)).
- **State machine transition**: `schedule_committee` (ready_for_committee → committee_review), fired by `CommitteeMeetingAssessmentService::attach` atomically with the pivot row creation.
- **Side effects**: New `committee_meeting_assessments` row with `decision = 'pending'`. Audit row.
- **Emails**: meeting-scheduled email to all members (with summary sheet PDF) when the meeting is created.

### 4.7 `committee_review`

- **How we got here**: ops_admin attached the assessment to a meeting.
- **Visible to**: ops_admin sidebar "Committee Review Scheduled"; assessor sees it as read-only; others inspection-only.
- **Where the work happens**: ops_admin's Rating Committee screens (`MeetingsDetails.jsx`, `AssessmentsTab.jsx`, `ReviewAssessmentParameter.jsx`).
- **Meeting lifecycle wrapping this state**:
  1. Meeting starts (`POST /committee-meetings/{id}/start`). On start, `CommitteeMeetingAssessmentService::ensureReadyToStart` repairs any pivot/status drift by re-scheduling any assessment that drifted back to `ready_for_committee` (this is the SAMAR-29-0526-sibling fix; see [§6](#6-critical-design-rules)).
  2. Per assessment, ops_admin opens `ReviewAssessmentParameter` → enters RC scores via `AppParameterQuestionsModal` → presses **Certify** or **Send Back**. Each **records** the committee's decision on the pivot row (`decision = 'certified'` / `'feedback'`, `decided_by`/`decided_at` stamped); the corresponding state-machine transition is **not** fired yet.
  3. When all pivot rows have `decision != 'pending'`, the **End Meeting** button enables on `MeetingsDetails.jsx`. `POST /committee-meetings/{id}/complete` finalizes — it **applies** each recorded decision (running the deferred `certify` / `committee_feedback` transitions), then sends the decision emails.
- **Side effects per action (at decision time — recorded only)**:
  - **Certify**: `PUT /assessments/{id}/rc-scores` flushes pending RC overrides → `POST /assessments/{id}/committee-decision` `{action: 'certify'}`. Records the decision (pivot row `decision = 'certified'`); does **not** transition the assessment or create a certificate yet.
  - **Send Back**: same flush, then `{action: 'provide_feedback', feedback: [...]}`. Records the decision (pivot row `decision = 'feedback'`); the `committee_feedback` transition and the clarification email are **deferred to meeting close**.
- **Side effects on meeting completion** (`CommitteeMeetingController::complete`):
  - Each recorded decision is applied: `certify` runs `AssessmentStateMachine::createCertificate` (validity months from `SystemSetting::getCertificateValidityYears() * 12`) and syncs the application to certified; `feedback` moves the assessment to `committee_feedback`.
  - MoM PDF generated and stored.
  - Decision emails sent (in the meeting-completion loop, `sendDecisionEmails`): for each `certified` pivot row, certified-and-assessment-report email with PDF attachments to enterprise/unit admins; for each `feedback` pivot row, the clarification email to lead + co-assessors via `CommitteeClarificationNotifier`.
  - Meeting status → `completed`.

### 4.8 `committee_feedback`

- **How we got here**: ops_admin sent the assessment back during committee review.
- **Visible to**: assessor sidebar "Committee Review Feedback"; ops_admin (read-only); others inspection-only.
- **Where the work happens**: **web only**. Mobile does not surface this state.
- **Action**: lead assessor opens the assessment → sees committee-flagged questions → revises responses + posts clarification replies → page-level **Submit for Review**.
  - Page submit: `POST /assessments/{id}/address-committee-feedback` → transition `address_committee_feedback` (→ submitted_for_qc).
- **Important**: the target is `submitted_for_qc`, not `ready_for_committee`. Committee-feedback responses re-enter the **QC loop**, so ops_manager reviews again before the assessment is eligible for the next committee meeting.
- **Note about meeting concurrency**: the assessor can submit this even while the parent committee meeting is still `in_progress` (the meeting that sent it back). The pivot row from that meeting stays as historical record (`decision = 'feedback'`); the assessment moves on. End Meeting reads from the pivot (not the live assessment status), so the meeting can still complete cleanly. This is the SAMAR-29-0526 fix in action.

### 4.9 `certified`

- **Terminal state.**
- **Visible to**: everyone — assessor "Certified" entry; ops_manager / ops_admin "Certified Vendors"; drdo_lab / drdo_admin / committee_member / system_admin (read-only "Certified Vendors").
- **Artifacts**:
  - `Certificate` row created with `certificate_number`, `valid_from`, `valid_until`, `grade` (computed from `Assessment::total_score`), PDF generated.
  - Certificate PDF + Assessment Report PDF downloadable from web certified-vendors screens.
- **Emails**: at meeting completion — certificate-and-assessment-report email to registered office, contact person, unit email, enterprise admins, and unit admins.

---

## 5. Mobile scope clarification (explicit)

**The mobile app is a pre-assessment in-field submission tool. It is intentionally not used after `submit_for_qc`.**

What this means concretely:

- The Home screen filters assessments to `status IN ('scheduled', 'in_progress')` only. Assessments in `submitted_for_qc`, `qc_feedback`, `committee_feedback`, `ready_for_committee`, `committee_review`, or `certified` will not appear on the mobile dashboard.
- The mobile app has no endpoints, actions, or screens for `address_qc_feedback` or `address_committee_feedback`. This is **by design**, not a missing feature.
- An assessor whose work is sent back from QC or the committee must switch to the web app (`coAssessor/manageAssessments/qualityCheckFeedback/*` or `.../committeeReviewFeedback/*`) to address it.

**Implications for design**: any new state introduced between `scheduled` and `submitted_for_qc` must consider whether mobile UI is needed. Any new state introduced after `submitted_for_qc` does not require mobile work.

---

## 6. Critical design rules

These are load-bearing. Violating them re-introduces known bugs.

### 6.1 The pivot is the source of truth for a meeting's view of an assessment

The `committee_meeting_assessments` pivot (with `decision` enum: `pending` | `certified` | `feedback`) records **what THIS meeting decided about THIS assessment**, regardless of where the assessment's global `status` has drifted to since.

- **End Meeting** is gated on all pivot rows having `decision != 'pending'`. It does NOT check `assessment.status`.
- **Per-assessment actions in the meeting view** are gated on `pivot.decision === 'pending'`. They do NOT check `assessment.status`.
- **`committeeDecision` controller** finds the pending pivot row + verifies its meeting is `in_progress`. It does NOT require `assessment.status === 'committee_review'`.

Why: the assessor can respond to a send-back BEFORE the meeting is formally ended, moving `assessment.status` from `committee_feedback` → `submitted_for_qc` → `ready_for_committee`. The meeting must still be able to close cleanly because its decision-of-record (the pivot) is already final. Reading `assessment.status` instead of the pivot is what caused the SAMAR-29-0526 stuck meeting.

### 6.2 Pivot lifecycle goes through `CommitteeMeetingAssessmentService`

Every attach (`schedule_committee` + create pivot row) and detach (`unschedule_committee` + delete pivot row) happens through `App\Services\CommitteeMeetingAssessmentService`, which performs both operations in one DB transaction. Controllers no longer write pivot rows directly.

Why: previously this was scattered across `store()`, `update()`, `cancel()`, each implementing part of the pattern. `update()` notoriously deleted pivot rows without rolling back assessment status, orphaning assessments in `committee_review` with no meeting backing them (no path forward). Centralizing prevents the next contributor from re-introducing a fourth variant of the same bug.

### 6.3 Committee decisions are recorded at decision time, applied at meeting close

When ops_admin presses Certify or Send Back during committee review, `committeeDecision()` **records** the decision on the `committee_meeting_assessments` pivot (`decision`, `decided_by`, `decided_at`) and stores any per-question feedback — but does **not** fire the state-machine transition or any email. The assessment stays in `committee_review` ("Committee Review Scheduled") and the result stays hidden. The deferred transitions (`certify` / `committee_feedback`) and the decision emails — certified-and-assessment-report for `certified` pivot rows, `App\Services\Notification\CommitteeClarificationNotifier` for `feedback` rows — all run from `CommitteeMeetingController::complete` when the meeting is ended.

Why: results (certificate, feedback, emails) must not leak to applicants or assessors before the committee has formally closed the meeting; recording-then-applying keeps every decision reversible until close and fires all outcomes at one atomic point. `committeeDecision()` still validates the transition up front (via `getTransitionBlockedReason`), so an illegal decision — e.g. the committee send-back limit already reached — is rejected immediately even though it is applied later.

### 6.4 RC scores override assessor scores in weighted calculation

When the Rating Committee enters an RC score on a response, `ApplicationAssessmentResponse::calculateScores()` uses `rc_score × weightage / 100` for `weighted_score`, not the assessor's `selected_score`. The RC score flows through to `Assessment::total_score` → `Certificate::final_score` → certificate grade.

Why: previously RC scores were stored but never aggregated, so the certificate always reflected the assessor's original score regardless of what the committee entered. RC adjustment was structurally non-functional.

Corollary: when an assessor edits a response (`setResponse`), `rc_score` is cleared so a stale RC override from a previous round doesn't shadow the new submission.

### 6.5 Status-history rows are written by the state machine, not the model observer

Status transitions write exactly one row to `application_assessment_status_histories`, from `AssessmentStateMachine::logStatusChange`. There is no `AssessmentObserver` writer (it was removed because it double-wrote every transition).

Why: each duplicate row carried partial context — the observer had auto-generated remarks but no caller context; the SM had caller remarks but no observer metadata. Reports double-counted; readers couldn't trust either row.

---

## 7. Notifications matrix

Triggered when the named transition fires (synchronously, best-effort).

| Transition | Email | Recipients |
|---|---|---|
| `schedule` | assessment-scheduled | All `AssessmentTeamMember`s for the assessment |
| `start` | (none) | — |
| `submit_for_qc` | submitted-for-qc | `ops_manager` users |
| `qc_feedback` | qc-clarification-required | Lead + co-assessors |
| `qc_approve` | (none) | — |
| `address_qc_feedback` | resubmitted-for-qc | `ops_manager` users |
| `schedule_committee` | (no per-transition email; covered by the meeting-scheduled email when the meeting is created) | — |
| `certify` | (fires at meeting completion, not here) | — |
| `committee_feedback` | (fires at meeting completion, not here — rc-clarification-required via `CommitteeClarificationNotifier`) | Lead + co-assessors |
| `unschedule_committee` | (none; covered by meeting-cancelled email when meeting is cancelled) | — |
| `address_committee_feedback` | (none) | — |

Only four transitions map to a transition-triggered email — `schedule`, `submit_for_qc`, `qc_feedback`, `address_qc_feedback` (`AssessmentStatusChangedListener::mapToEmailEvent`). The `certify` and `committee_feedback` outcomes are emailed from the meeting-completion loop, not the transition; every other transition sends nothing.

**Meeting lifecycle emails** (separate from assessment transitions):
- Meeting created → meeting-scheduled email (with Summary Sheet PDF attached) to all members.
- Meeting cancelled → meeting-cancelled email to all members.
- Meeting completed → MoM PDF email to all members + per-certified-assessment certificate-and-assessment-report email to enterprise/unit recipients.

---

## 8. Audit trail

Every transition writes one row to `application_assessment_status_histories` via `AssessmentStateMachine::logStatusChange`. The row captures:

| Column | Source |
|---|---|
| `assessment_id` | Subject |
| `from_status`, `to_status` | Transition source/target |
| `changed_by` | Authenticated user ID |
| `changed_by_role` | First active role slug of the user |
| `remarks` | Caller-provided `data['remarks']`, falling back to a descriptive default per target status (e.g. "Assessment submitted for QC review") |
| `metadata` | Caller-provided `data['metadata']`, nullable |
| `ip_address`, `user_agent` | Request context |
| `changed_at` | Now |

For the meeting side: meetings record `started_at`, `ended_at`, `cancelled_at`, `cancelled_by`. There is no dedicated meeting-status-history table; transitions are inferred from these columns.

For per-question feedback: `application_assessment_question_feedbacks` records QC and committee per-question comments with `feedback_type` discriminator.

---

## 9. Known gaps and open items

Current at: 2026-05-19.

| Severity | Area | Description |
|---|---|---|
| warning | Web — ops_admin scheduling | `operationAdmin/manageAssessments/allocationPending/AllocationPendingDetails.jsx` imports `OperationScheduleAssessmentModal` and wires `openScheduleModal` state, but **never renders a button to open it**. Backend allows ops_admin to schedule; web doesn't expose it. |
| warning | Web — status formatter chaos | Five copies of `formatAssessmentStatus` across role-specific assessor-details screens, each missing 3+ cases (`allocation_pending`, `scheduled`, `certified` fall through to raw snake_case). `getStatusLabel` produces "Qc" artefacts. |
| warning | Web — hard-coded badges | Every `*/assessmentDetails/AssessmentDetails.jsx` renders a literal badge matching the URL path, not bound to `assessmentData.status`. Badge drifts from real status if the assessment moves on while the user is on the page. |
| info | Web — dead code | `scheduleCommitteeAction` thunk (defined, never dispatched), `getAvailableTransitionsAction` (defined, never consumed), `EditAssessmentDateModal.jsx` (orphan), `LeadAssessorMenuItem.js` (dead config), `RejectedAssessments.jsx` (filters non-existent `'rejected'` status). |
| info | Mobile — step name casing drift | `AssessmentStepsList.js` uses snake_case (`parameter_allocation`), `getAssessmentPercentage.js` uses camelCase (`parameterAllocation`). Same logical model, two casings, two sources. |
| info | Mobile — dead SQLite layer | `src/services/database/assessment/assessmentQueries.js` references tables (`assessments`, `site_pictures`, `basic_information`) that `schema.js` never creates. Zero call sites; entire file is dead. |
| info | Web — tenant visibility | `enterprise_admin` and `unit_admin` see Application status only, never the underlying assessment lifecycle. May be intentional; worth a decision record. |
| info | Web — committee_member role | Recognized in `ReviewAssessmentParameter.jsx:117` `hasAnyRole` check, but `UserNavigator.jsx` only mounts the route element for `operations_admin`. Effectively unrouted for committee_member; works for ops_admin only. |
| info | Tests | A MySQL-backed `php artisan test` suite exists (`RefreshDatabase` against `qci_samar_test`, ~23 feature/unit test files). It does not yet cover every assessment transition, so lifecycle regression coverage is partial. |

---

## 11. Service sector — same lifecycle, two deltas

**Design rule: a service-sector assessment runs the identical lifecycle, state machine, statuses, transitions, QC → committee → certify tail, punch in/out, and opening/closing meetings as manufacturing.** Service is "manufacturing minus travel." There are exactly **two** behavioural differences:

1. **The assessment is conducted online.** A `meeting_link` (column on `application_assessments`) is required at scheduling for service (`AssessmentController::allocate`, validated `required` only when `isServiceSector()`), and surfaced to ops, assessors (mobile `MeetingLinkCard`), and the applicant. The assessor joins the meeting instead of visiting; punch in/out and opening/closing meetings stay, with meeting photos uploaded from the device gallery (service-only) rather than camera.

2. **Site pictures and site tour are applicant-supplied; the assessor selects from them.** Instead of the assessor capturing on-site, the **applicant** (the owning `unit_admin` / `enterprise_admin`) uploads a **pool** of site pictures + site tour photos via the applicant mobile app. The assessor then **selects** which photos become the assessment's official set — replacing capture, not the step itself.

### Picture-selection mechanics

- Applicant uploads go to the same `application_assessment_site_pictures` / `..._site_tour_pictures` tables, with `team_member_id = null`, `uploader_type = 'applicant'`, and **`is_selected = false`** (a pool candidate). See `2026_06_19_000001` (uploader columns) and `2026_06_20_000001` (selection columns).
- Manufacturing assessor captures land `is_selected = true` (selected on upload) — so the manufacturing flow and all existing data are unaffected.
- The assessor selects via `POST application-assessments/{id}/site-pictures/select` and `.../site-tour-pictures/select`, body `{ pictureIds: [...] }` (assessor role, service only). The submitted ids become the selected set (`is_selected = true`, `selected_by_team_member_id`, `selected_at` stamped); all others are deselected.
- **Step completion is driven by selection**: `Assessment::isSitePicturesComplete()` / `isSiteTourComplete()` count `is_selected = true` rows. For service this means the step completes only once an assessor has selected ≥1 photo; the applicant uploading the pool is not sufficient. These feed `recalculateStepProgress()` and the per-member `complete_mobile` gate exactly as before.
- The post-assessment summary / certified report (`ApplicationAssessmentSummaryController`) shows only the **selected** site-tour pictures, not the full applicant pool.
- The applicant site-tour upload is **not** gated on the assessor's opening meeting (the applicant supplies the pool ahead of the online assessment); the assessor-capture opening-meeting gate still applies in manufacturing.
- The applicant discovers the `assessmentId` to upload against from the application detail payload (`assessment_id`, exposed alongside `assessment_meeting_link`).

### Other per-sector branches (data, not lifecycle)

- **Basic information schema**: separate field sets — `svc_drdo_vendor_labs`, `svc_services`, `svc_key_processes`, `svc_key_resources` vs manufacturing `mfg_drdo_vendor_stores`, `mfg_products`, `mfg_key_processes`, `mfg_raw_materials`, `mfg_bought_out_parts`. `Assessment::isBasicInformationComplete()` branches on `application.sector` (~`Assessment.php:1143`).
- **Master data**: `vendor_categories` / labs / key-processes / key-resources selected per-sector.
- **Certificate**: `Certificate.scope` = `'Service'` for service, `'Manufacturing'` otherwise (`AssessmentStateMachine.php`).
- **Meeting summary PDF**: `MeetingSummarySheetService` has service-sector table/section branches.

The state machine, statuses, and transitions in §2–§8 apply unchanged to service. Sector value is the singular string `'service'` everywhere (DB enum `['manufacturing','service']`).

## 12. Where to look in the code

**Backend:**
- `app/Services/StateMachine/AssessmentStateMachine.php` — transition config, guards, hooks, certificate creation.
- `app/Services/CommitteeMeetingAssessmentService.php` — pivot lifecycle (attach/detach/ensureReadyToStart/detachAllPending).
- `app/Services/Notification/CommitteeClarificationNotifier.php` — immediate clarification email on send-back.
- `app/Http/Controllers/Api/V1/AssessmentController.php`:
  - `committeeDecision()` — Certify / Send Back from a committee meeting.
  - `qcDecision()` — Approve / Send Back at QC.
  - `updateRcScores()` — Bulk RC score flush before Certify/Send Back.
  - `addressCommitteeFeedback()`, `addressQcFeedback()` — Assessor loop-back endpoints.
  - `index()` — list endpoint; filters `ready_for_committee` to exclude assessments locked in active meetings.
- `app/Http/Controllers/Api/V1/CommitteeMeetingController.php` — meeting CRUD, `start`, `complete`, `cancel`.
- `app/Models/ApplicationAssessmentResponse.php` — `calculateScores()` (RC override), `setResponse()` (clears stale RC).

**Web (qci-samar-web):**
- `src/constants/assessmentStatus.js` — status enum constants.
- `src/utils/getStatusColors.js` — badge variant + label helpers (with known gaps; see §9).
- `src/redux/action/common/AssessmentAction.js` — every lifecycle thunk.
- `src/screens/user/coAssessor/manageAssessments/*` — assessor's full sidebar (Scheduled, In Progress, Quality Check, Quality Check Feedback, Ready for Committee Review, Committee Review Scheduled, Committee Review Feedback, Certified).
- `src/screens/user/operationManager/manageAssessments/*` — ops_manager allocation + QC review.
- `src/screens/user/operationAdmin/ratingCommittee/Meetings/*` — full committee meeting orchestration.

**Mobile (qci-samar-assessor-mobile):**
- `src/screens/user/Home.js` — Start button + dashboard.
- `src/screens/user/assessment/AssessmentStepsList.js` — 7-step workflow + Submit for QC.
- `src/screens/user/assessment/assessmentParameters/AssessmentParametersDetails.js` — per-question scoring.
- `src/redux/action/assessmentAction.js` — `startAssessmentAction`, `assessmentSubmitAction`.

---

## Change log for this doc

- **2026-05-19**: Initial version. Authored by Claude Code session covering SAMAR-29-0526 hotfix + Option A (`CommitteeMeetingAssessmentService`) + C-1/C-2/C-5 audit fixes. Supersedes the lifecycle narrative in `24-assessment-workflow.md` (which is left in place as a stale stub with a pointer to this doc).
- **2026-07-21**: Added the `mobile_complete` status and `complete_mobile` transition (in_progress → mobile_complete → submit_for_qc), which this doc previously omitted entirely — verified against `AssessmentStateMachine::getConfig()` and the mobile app's offline outbox sync.
