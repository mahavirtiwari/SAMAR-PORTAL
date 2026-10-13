# QCI SAMAR — Access and Dead-Code Findings

Companion to the Technical System Documentation. These are things the documentation work surfaced that are **code decisions for QCI and Webority to make**, not documentation errors. None was failing a test or throwing an error; they were sitting dormant. Each is stated with evidence so it can be verified, an honest severity, and a recommendation. Nothing here has been changed in the code — these are for a decision.

The recurring pattern behind most of them: the **web portal is uniformly narrower than the API**. The frontend only ever shows a role fewer capabilities than the backend would accept, and in a few places a Laravel *policy* names roles that no *route* actually calls. A policy that no route invokes is not enforcement.

Severity key: **High** = act before production. **Medium** = decide and schedule. **Low** = hygiene, fix when convenient.

---

## F-1 — Support ticket creation is not restricted on the API — Medium

_Tracked as **BUG-06351**._

**What.** `POST /api/v1/support/tickets` (and the list and detail GETs) carry no role middleware, so any authenticated principal can create, list and view tickets — including the `erp_integration` machine account and read-only roles like `drdo_lab`. The applicant-only rule that the product implies is applied only by the web portal, which shows the Support screen to Enterprise Admin and Unit Admin.

**Evidence.** `routes/api.php:851-857` — `store`, `index`, `show` have no `->middleware('role:...')`; only `update` is guarded (`role:system_admin,operations_manager,operations_admin`). List/detail are scoped by email + organisation for non-admins in `SupportTicketController` (`index`/`show`), which limits read exposure.

**Impact.** Low data-exposure risk (reads are org-scoped), but a role that should have no support surface can still open tickets against the desk. It is a server-side authorization gap masked by a UI convention.

**Recommendation.** Add `->middleware('role:enterprise_admin,unit_admin')` to the create route (and decide whether list/detail should be similarly scoped), so the rule holds regardless of client. If QCI wants staff to raise tickets too, widen the list deliberately rather than leaving it open to all.

---

## F-2 — Certificates cannot be suspended or revoked through the system — Medium

_Tracked as **TASK-05670**._

**What.** A certification body normally needs to withdraw a certificate (fraud found later, standards lapse). SAMAR has the `suspended` and `revoked` states in the schema and a policy that names who could set them, but **no screen and no API endpoint does**. Those states are reachable today only by editing the database directly.

**Evidence.** `CertificatePolicy.php` declares `issue`/`approve`/`suspend`/`revoke`, but `routes/api.php` exposes only certificate `index`, `show`, `verify`, `download` — no route calls those policy methods.

**Impact.** If suspension or revocation is a real business requirement, it is currently unbuilt. A public verification page will keep reporting a certificate as valid even after QCI has decided it should not be.

**Recommendation.** Confirm with QCI whether suspend/revoke is in scope. If yes, it needs endpoints, screens and a decision on who may act (the policy suggests System Admin / Operations roles). If no, drop the unused states and policy methods so the model does not imply a capability that does not exist.

---

## F-3 — Dead authorization on application approve/reject — Low

_Tracked as **TASK-05671**._

**What.** `ApplicationPolicy::approve()` and `reject()` grant Operations Manager and Operations Admin in addition to DRDO Admin, but the only approve/reject routes are guarded `role:drdo_admin` and never invoke the policy. The extra roles are dead — they cannot approve or reject anything.

**Evidence.** `routes/api.php:304-307` (`drdo-approve` / `drdo-reject`, both `role:drdo_admin`); `ApplicationPolicy.php` approve/reject methods list the ops roles but are not referenced by any controller.

**Impact.** No security impact (enforcement is correct at the route). It is misleading dead code — it is what led the first draft of the documentation to over-state who can approve applications.

**Recommendation.** Either wire the policy to the routes (if ops roles are meant to approve) or remove the extra roles from the policy so it matches enforcement. Decide the intent, then make code and doc agree.

---

## F-4 — API role guards broader than the portal — Medium, tighten to match

_Tracked as **TASK-05672**._

**What.** A full endpoint-by-endpoint audit (every route reconciled against the roles that reach the calling screen in the web + mobile frontends) confirmed a family of routes whose `role:` guard is broader than any UI that drives them. Each is unused authorization surface: a role that can never invoke the action from the product can still invoke it against the API. The frontend is the intended spec; these should be tightened unless a grant is deliberately reserved.

**Over-permissive writes.**

| Capability | API allows (bold = no UI) | Portal exposes to | Route |
|---|---|---|---|
| Edit disciplines | System Admin, **DRDO Admin** | System Admin | `routes/api.php:775-782` |
| Edit assessment parameters | System Admin, **DRDO Admin** | System Admin | `routes/api.php:799-801` |
| Edit questionnaire questions / options | System Admin, **DRDO Admin** | System Admin | `routes/api.php:814-824` |
| Fee configuration create/update | System Admin, **Operations Admin** | System Admin | `routes/api.php:748,750` |
| Feedback question create/update | System Admin, **Operations Admin** | System Admin | `routes/api.php:733,736` |
| Organisation activate/deactivate | System Admin, **Operations Admin** | System Admin | `routes/api.php:223,225` |
| Committee members / meetings write (create, update, start, complete, members) | **Operations Manager**, Operations Admin | Operations Admin | `routes/api.php:531-563` |
| Committee delete (members, meetings) | Operations Admin, **Operations Manager, System Admin, DRDO Admin** | Operations Admin | `routes/api.php:535, 547` |

**Over-permissive reads.**

| Capability | API allows | Portal exposes to | Route |
|---|---|---|---|
| List organisations + export | System Admin, Operations Admin, Operations Manager, DRDO Admin, DRDO Lab | System Admin | `routes/api.php:218, 220` |
| Committee reads (members, meetings) | System Admin, DRDO Admin, Operations Manager, Operations Admin | Operations Admin | `routes/api.php:528, 540` |

**Not a real gap.** `GET /assessments` and its detail routes carry no route `role:` middleware, but `AssessmentController` calls `Gate::authorize('viewAny'/'view')`, so the effective set is the policy's six roles, which matches frontend reachability. Optional defence-in-depth (add route middleware), not an over-grant.

**Recommendation.** Tighten each route above to the portal's role set (the exact target roles are in TASK-05672). Where a grant is deliberately reserved for a future screen or another client, keep it and record why.

---

## F-5 — Dead ticket service methods and duplicated service in the web app — Low

_Tracked as **TASK-05673**._

**What.** The web app defines `listSupportTickets`, `getSupportTicket` and `updateSupportTicket` in a support service that no screen calls, in two near-identical copies (Enterprise Admin and Unit Admin). The portal only ever calls create.

**Evidence.** `qci-samar-web/src/services/api/enterpriseAdmin/SupportService.js` and `.../unitAdmin/SupportService.js`.

**Impact.** None functional. Dead code that implies a ticket-management UI that does not exist.

**Recommendation.** Remove the unused methods, or build the ticket list/detail UI if QCI wants ticket handling inside the portal rather than only in Zoho Desk.

---

## F-6 — Web app calls API routes that do not exist — Medium

_Tracked as **BUG-06352**._

**What.** The full audit found web service methods and Redux thunks that call routes the backend does not define. They return **404, not 403** — the action fails silently rather than being rejected.

**Cases.** `POST /units` and `PUT /units/{id}` (the add-unit and edit-unit screens); `PUT` and `DELETE /applications/{id}`; the whole `GET/POST/PUT /users/{id}/domains` cluster; `POST /users/{id}/assessor-districts`; and `DELETE` on `/documents/{id}`, `/fee-configurations/{id}`, `/assessment-parameters/{id}`, `/assessment-questions/{id}` and question options.

**Impact.** Units are in fact created and updated inside the application flow (`UnitService::findOrCreateByAddress`), so the standalone unit-management screens are the clearest broken flow. The DELETE calls on reference/questionnaire data align with there being no delete for that data by design, so those callers are simply dead. The `/users/{id}/domains` cluster has live Redux slices behind it and is the most likely genuinely-broken feature.

**Recommendation.** Per feature: add the missing route with the correct guard, or remove the dead caller.

---

## F-7 — Orphan admin endpoints with no UI — Low

**What.** `GET/PATCH/POST /admin/error-logs/*` and `GET/PATCH /admin/error-groups/*` are defined (`role:system_admin`) but no frontend calls them — the error-log administration UI was never built.

**Recommendation.** Build the screen if error-log administration is wanted in-product, or leave the endpoints as an operator-only API and note it. Low priority; not exposed to non-admins.

---

## Already actioned during this work (for completeness)

These were found in the same pass and have been fixed in code (committed), not left for a decision:

- Applicant mobile release builds were signed with the debug keystore; now use the release keystore.
- `FeeConfigurationController` filtered on a non-existent `is_active` column (would error if used); filter removed.
- `CertificateController` read `suspended_at` (no such column), always returning null; now reads `suspended_from` / `suspended_until`.
- The backend `docs/` described refunds, payment/certificate number formats, endpoints and states the code does not have; corrected across 15 files.

## Noted separately, outside this document's scope

- `deploy/zed-staging-server-2026.pem` — the staging VM SSH private key — is committed to the repository and not gitignored. Rotate and purge before any wider repository access. _Tracked as **BUG-06350**._
