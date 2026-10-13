# -*- coding: utf-8 -*-
"""SAMAR Portal — ERP (Business Central) Integration Test Plan.

Reuses the document machinery in docs/user-manual/samar_common.py so every
SAMAR document shares one house style. Run from anywhere:

    python docs/test-plans/build_erp_test_plan.py

Content is derived from a read of the implementation as at 22-Jul-2026:
ErpDocumentController, ErpDocumentUploadRequest, BusinessCentralClient,
BusinessCentralOAuthService, InvoiceReferenceGenerator, DocumentService::storeRaw,
ProvisionErpServiceAccount, routes/api.php, AppServiceProvider (erp.ingest
limiter) and the invoices/invoice_sequences migrations.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "user-manual"))

from samar_common import Manual, GREY  # noqa: E402

OUT = r"C:\Users\WB0228-VIDUSHI\Downloads\SAMAR Portal - ERP Integration Test Plan.docx"
VERSION = "Version 1.0   ·   22-Jul-2026"

m = Manual("SAMAR Portal — ERP Integration Test Plan", VERSION)

RESULT_COLS = ["ID", "Test case", "Expected result", "Result"]
RESULT_SIZES = [2.6, 5.6, 7.0, 2.0]


def cases(rows):
    m.simple_table(RESULT_COLS, [[a, b, c, ""] for a, b, c in rows], sizes=RESULT_SIZES, fs=9)


# ================= COVER =================
m.cover("ERP Integration",
        "SAMAR Portal — Test Plan for the Business Central Integration",
        "Test cases, scenarios, and a statement of what is presently testable",
        VERSION + "   ·   Quality Council of India & DRDO, Ministry of Defence")

# ================= CONTENTS =================
m.contents([
    ("1 — Purpose and scope", []),
    ("2 — What can actually be tested",
     ["The two directions of the integration", "Component status", "Consequence for testing"]),
    ("3 — Blockers to be cleared", []),
    ("4 — Preparing the test environment",
     ["Provisioning the service account", "Obtaining an access token", "Seeding an invoice",
      "Constructing the payload"]),
    ("5 — Test cases",
     ["Authentication and authorisation", "Request validation", "PDF integrity",
      "Idempotency and replacement", "Persistence and storage", "Rate limiting and availability",
      "Outbound connectivity", "Service account provisioning", "Invoice reference generation"]),
    ("6 — End-to-end scenarios", []),
    ("7 — Observations", []),
    ("Appendix A — Request and response reference", []),
])

# ================= 1. PURPOSE =================
m.divider("Part 1", "Purpose and scope", "What this plan covers and what it does not")

m.banner("1.1  Purpose")
m.body("This plan sets out how the integration between the SAMAR Portal and QCI's Business Central ERP is to be tested. It states "
       "which parts of the integration are presently capable of being tested, prescribes the preparation of the test environment, "
       "and enumerates the test cases and the end-to-end scenarios to be executed before credentials are released to QCI.")

m.banner("1.2  Scope")
m.body("The integration comprises two directions, which are at materially different stages of completion. This plan covers both, "
       "but the reader's attention is drawn to Part 2, which sets out what is and is not testable at present. Executing the cases "
       "in Part 5 without first reading Part 2 will give a misleading impression of readiness.")

m.banner("1.3  Basis")
m.body("The contents are derived from an examination of the implementation as it stood on 22-Jul-2026. Where the plan records that "
       "a component is absent, this has been verified by tracing every reference to it in the application code.")
m.note("The commit that introduced the inbound document API records that the migration, the provisioning command and the "
       "end-to-end upload had not, at that time, been executed against a live MySQL database. That remains the position.")

# ================= 2. WHAT CAN BE TESTED =================
m.divider("Part 2", "What can actually be tested", "The single most important section of this plan")

m.banner("2.1  The two directions of the integration")
m.body("The integration is described in two directions. They are independent of each other and are at different stages:")
m.simple_table(["Direction", "Description", "State"], [
    ["Inbound  (ERP → SAMAR)",
     "Business Central pushes invoice and receipt PDFs to SAMAR, which stores them and links them to the invoice record.",
     "Implemented"],
    ["Outbound  (SAMAR → ERP)",
     "SAMAR generates an invoice, sends it to Business Central, and tracks the synchronisation state of each invoice.",
     "Not implemented"],
], sizes=[4.4, 9.6, 3.2], fs=10)

m.banner("2.2  Component status")
m.body("The following table states, component by component, what exists and whether it can be tested. It is to be read before any "
       "test case is executed.")
m.simple_table(["Component", "State", "Testable"], [
    ["POST /api/v1/erp/documents/upload  (inbound PDF push)", "Implemented", "Yes — a seeded invoice is required"],
    ["erp_integration role and service account provisioning", "Implemented", "Yes"],
    ["Business Central OAuth and the bc:test-connection command", "Implemented", "Yes — live credentials required"],
    ["invoices and invoice_sequences tables", "Migrated", "Yes"],
    ["InvoiceReferenceGenerator", "Written, but never called by the application", "In isolation only"],
    ["Creation of an invoice upon payment", "Not implemented", "No"],
    ["Transmission of an invoice to Business Central", "Not implemented", "No"],
    ["Synchronisation state and retry (bc_sync_status)", "Columns exist; no code operates on them", "No"],
], sizes=[8.0, 5.2, 4.0], fs=9.5)

m.banner("2.3  Consequence for testing")
m.body("Two consequences follow, and they govern the whole of this plan:")
m.bullets([
    "No part of the application creates an invoice record. The inbound endpoint matches the incoming document against an "
    "invoice by its reference; if no invoice exists, the upload is rejected. Every inbound test therefore requires an invoice "
    "to be inserted by hand, as prescribed in Part 4.",
    "The outbound direction cannot be tested beyond connectivity. The reference generator and the database columns exist, but "
    "nothing generates an invoice, transmits it, or records the outcome. Cases ERP-BC-01 to ERP-BC-04 verify only that SAMAR "
    "can authenticate to Business Central and reach the configured company.",
])
m.note("A successful pass of every case in this plan would demonstrate that the inbound endpoint behaves correctly. It would not "
       "demonstrate that the integration is complete, because the invoice that the endpoint matches against cannot yet be produced "
       "by the system.")

# ================= 3. BLOCKERS =================
m.divider("Part 3", "Blockers to be cleared", "Matters to be settled before the integration can be certified")

m.banner("3.1  Blockers")
m.simple_table(["#", "Blocker", "Effect if not cleared"], [
    ["1", "No code path creates an invoice record.",
     "The inbound endpoint can never match a genuine invoice in production. Testing is confined to hand-seeded data."],
    ["2", "The migration, the provisioning command and the upload have not been run against MySQL.",
     "Schema, provisioning or storage defects would first appear in the QCI environment."],
    ["3", "There is no invoice factory and no automated test for any part of the integration.",
     "Every regression must be found by hand; a change to the endpoint cannot be verified cheaply."],
    ["4", "The outbound direction is unimplemented.",
     "The commercial purpose of the integration — placing SAMAR invoices in the QCI ledger — is not met."],
], sizes=[1.0, 7.4, 8.8], fs=9.5)

# ================= 4. ENVIRONMENT =================
m.divider("Part 4", "Preparing the test environment", "To be completed before any case is executed")

m.banner("4.1  Provisioning the service account")
m.body("The ERP authenticates as an ordinary SAMAR user holding the erp_integration role. The account is created from "
       "configuration and the command may be run repeatedly; each run also re-applies the configured password, so rotation is a "
       "change of configuration followed by a re-run.")
m.code("# BC_INBOUND_PASSWORD must be set in the environment file first\nphp artisan erp:provision-service-account",
       caption="Command")
m.validation("Validation: the command aborts without creating anything if BC_INBOUND_PASSWORD is unset.")

m.banner("4.2  Obtaining an access token")
m.code("curl -X POST http://localhost:8000/api/v1/auth/login \\\n"
       "  -H \"Content-Type: application/json\" \\\n"
       "  -d '{\"email\":\"erp-integration@webority.dev\",\"password\":\"<BC_INBOUND_PASSWORD>\"}'",
       caption="Request")
m.body("The access token returned is used as a bearer token on every subsequent call. A refresh token will not be accepted.")

m.banner("4.3  Seeding an invoice")
m.body("This step is unavoidable. No screen and no API creates an invoice, so one must be inserted directly. The reference must be "
       "generated rather than invented, so that it conforms to the format and is recorded in the sequence table.")
m.code(">>> use App\\Services\\BusinessCentral\\InvoiceReferenceGenerator;\n"
       ">>> $reference = app(InvoiceReferenceGenerator::class)->generate();\n"
       "\n"
       ">>> App\\Models\\Invoice::create([\n"
       "      'application_id'    => 1,\n"
       "      'organization_id'   => 1,\n"
       "      'invoice_reference' => $reference,\n"
       "      'posting_date'      => now(),\n"
       "      'voucher_date'      => now(),\n"
       "      'base_amount'       => 32000,\n"
       "    ]);",
       caption="php artisan tinker")
m.note("The application_id and organization_id must refer to records that exist, as both carry foreign keys. Note the reference "
       "produced, in the form SAMAR/2026-27/00001; it is the value sent as invstr.")

m.banner("4.4  Constructing the payload")
m.code("base64 -w0 sample.pdf > pdf.b64\n\n"
       "curl -X POST http://localhost:8000/api/v1/erp/documents/upload \\\n"
       "  -H \"Authorization: Bearer <token>\" \\\n"
       "  -H \"Content-Type: application/json\" \\\n"
       "  -d \"{\\\"invstr\\\":\\\"SAMAR/2026-27/00001\\\",\\\"erp_invstr\\\":\\\"BC-INV-001\\\","
       "\\\"pdffor\\\":\\\"i\\\",\\\"pdfstr\\\":\\\"$(cat pdf.b64)\\\"}\"",
       caption="Upload")

# ================= 5. TEST CASES =================
m.divider("Part 5", "Test cases", "To be executed in the order given")

m.banner("5.1  Authentication and authorisation")
cases([
    ["ERP-AUTH-01", "Request without an Authorization header.", "401 Unauthenticated."],
    ["ERP-AUTH-02", "Request with an expired or malformed token.", "401 Unauthenticated."],
    ["ERP-AUTH-03", "Request presenting a refresh token in place of an access token.", "401. Only access tokens are accepted."],
    ["ERP-AUTH-04", "Valid token belonging to a System Admin.", "403. The route admits the erp_integration role alone."],
    ["ERP-AUTH-05", "Valid token belonging to an Enterprise Admin.", "403."],
    ["ERP-AUTH-06", "Valid token belonging to the ERP service account.", "201 and the document is stored."],
    ["ERP-AUTH-07", "Two concurrent logins as the service account, each then uploading.",
     "Both succeed. Single-session enforcement is disabled for this role so that concurrent batches do not displace one another."],
])
m.note("ERP-AUTH-07 is to be repeated after any change to role configuration. Were single-session enforcement to be enabled for "
       "this role, QCI's parallel batches would begin to invalidate each other's sessions, and the failure would appear "
       "intermittent and load-dependent.")

m.banner("5.2  Request validation")
cases([
    ["ERP-VAL-01", "invstr omitted.", "422."],
    ["ERP-VAL-02", "invstr that matches no invoice.", "422, 'No invoice found for the given invstr'."],
    ["ERP-VAL-03", "invstr longer than 20 characters.", "422."],
    ["ERP-VAL-04", "pdfstr omitted.", "422."],
    ["ERP-VAL-05", "pdffor omitted.", "422."],
    ["ERP-VAL-06", "pdffor given as 'x', 'I' or 'invoice'.",
     "422, \"pdffor must be 'i' (invoice) or 'r' (receipt)\". The comparison is case-sensitive."],
    ["ERP-VAL-07", "erp_invstr omitted.", "201. The stored bc_invoice_no is left unchanged."],
    ["ERP-VAL-08", "erp_invstr longer than 20 characters.", "422."],
    ["ERP-VAL-09", "Empty body, or a body that is not JSON.", "422."],
])

m.banner("5.3  PDF integrity")
m.note("Attention is drawn to ERP-PDF-04 below, that being the case most likely to arise in practice. Many encoders emit "
       "line-wrapped base64 by default, and the decoder used here rejects it. This is to be settled with QCI before the interface "
       "is released.")
cases([
    ["ERP-PDF-01", "A correctly encoded PDF.", "201."],
    ["ERP-PDF-02", "Base64 of an image or a Word document.", "422, 'pdfstr is not a valid base64-encoded PDF'."],
    ["ERP-PDF-03", "A string that is not valid base64.", "422."],
    ["ERP-PDF-04", "Base64 containing embedded line breaks or spaces.",
     "422. Decoding is strict. Whether QCI's client wraps its output is to be confirmed with them."],
    ["ERP-PDF-05", "Base64 of an empty string.", "422."],
    ["ERP-PDF-06", "A PDF exceeding the configured maximum of 50 MB.",
     "500, 'Failed to store document'. The response does not distinguish an oversized file from a transient fault."],
    ["ERP-PDF-07", "A file bearing the PDF signature but otherwise corrupt.",
     "201. Only the signature is verified; the document is not parsed."],
])

m.banner("5.4  Idempotency and replacement")
m.body("The endpoint is idempotent on the combination of invstr and pdffor. Re-uploading the same type of document for the same "
       "invoice replaces the stored file rather than adding a second one. This is the behaviour on which QCI's retries depend.")
cases([
    ["ERP-IDM-01", "First upload with pdffor = i.", "201, replaced = false, and invoice_document_id is set."],
    ["ERP-IDM-02", "The same invoice and type uploaded again with a different PDF.",
     "200, replaced = true, a new document reference, and the earlier record and file removed."],
    ["ERP-IDM-03", "Upload with pdffor = r after an invoice PDF has been received.",
     "201. receipt_document_id is set and the invoice PDF is unaffected."],
    ["ERP-IDM-04", "The identical payload replayed three times.",
     "The same final state, with exactly one document of each type and no orphaned files."],
    ["ERP-IDM-05", "Two uploads for the same invoice and type despatched simultaneously.",
     "No error, no orphaned file, and the invoice refers to exactly one document."],
    ["ERP-IDM-06", "Inspection of the storage disk after a replacement.", "The superseded file is no longer present."],
])

m.banner("5.5  Persistence and storage")
cases([
    ["ERP-STO-01", "Examine the document record created by an upload.",
     "mime_type application/pdf, extension pdf, size equal to the decoded length, uploaded_by the service account."],
    ["ERP-STO-02", "Examine the stored filename.",
     "Of the form invoice-SAMAR-2026-27-00001.pdf, the solidus having been replaced by a hyphen."],
    ["ERP-STO-03", "Attempt to reach the stored file without authentication.",
     "Not reachable. The file resides on the private documents disk."],
    ["ERP-STO-04", "Upload with erp_invstr supplied.", "The value is recorded in invoices.bc_invoice_no."],
    ["ERP-STO-05", "A second upload supplying a different erp_invstr.",
     "The recorded value is overwritten. Whether this is intended is to be confirmed with QCI."],
    ["ERP-STO-06", "Examine the audit record written for the upload.",
     "An entry is written, but with no actor recorded. See Part 7."],
])

m.banner("5.6  Rate limiting and availability")
cases([
    ["ERP-RL-01", "Sixty uploads within one minute.", "All succeed."],
    ["ERP-RL-02", "The sixty-first upload within the same minute.", "429, with a Retry-After header."],
    ["ERP-RL-03", "A second account uploading while the first is throttled.",
     "Unaffected. The limit is applied per account."],
    ["ERP-MNT-01", "Upload while maintenance mode is enabled.",
     "201. The route is deliberately placed outside maintenance handling so that scheduled ERP batches are not refused."],
    ["ERP-MNT-02", "Any other API call as an Enterprise Admin while maintenance mode is enabled.",
     "503. This confirms that the exemption is confined to the ERP route."],
])

m.banner("5.7  Outbound connectivity")
m.body("These cases verify only that SAMAR can authenticate to Business Central and reach the configured company. No invoice is "
       "transmitted, that function not having been implemented.")
cases([
    ["ERP-BC-01", "Run bc:test-connection with valid credentials.", "Success, and the configured company is found."],
    ["ERP-BC-02", "Run with an incorrect client secret.", "Failure, reporting that no access token could be obtained."],
    ["ERP-BC-03", "Run with valid credentials but an incorrect company name.",
     "Connected, reporting that the company was not found, and listing those available."],
    ["ERP-BC-04", "Run with the integration disabled in configuration.", "No outbound call is attempted."],
])

m.banner("5.8  Service account provisioning")
cases([
    ["ERP-PRV-01", "Run the provisioning command with no password configured.",
     "The command fails and creates neither the role nor the account."],
    ["ERP-PRV-02", "Run the provisioning command twice.",
     "One role and one account, with no duplicate assignment of the role."],
    ["ERP-PRV-03", "Change the configured password, re-run, and log in.",
     "The new password is accepted and the previous one refused."],
])

m.banner("5.9  Invoice reference generation")
m.body("The reference is the only safeguard against a duplicate entry in the QCI ledger, Business Central performing no "
       "de-duplication of its own. These cases are to be executed even though nothing presently calls the generator.")
cases([
    ["ERP-REF-01", "Generate in April and in March.",
     "The financial year advances correctly, 2026-27 and 2025-26 respectively."],
    ["ERP-REF-02", "Generate one hundred references in succession.",
     "Strictly increasing, zero-padded to five digits, with no gap and no repetition."],
    ["ERP-REF-03", "Generate concurrently from two processes.", "No duplicate is produced."],
    ["ERP-REF-04", "Advance the sequence beyond 99999 and generate.",
     "An error is raised rather than a reference being silently truncated to twenty characters."],
])

# ================= 6. SCENARIOS =================
m.divider("Part 6", "End-to-end scenarios", "For user acceptance testing with QCI")

m.banner("6.1  Scenarios")
m.body("Each scenario is to be executed against a seeded invoice, with QCI operating the ERP side wherever possible.")
m.simple_table(["#", "Scenario", "Expected outcome"], [
    ["1", "Invoice PDF followed by receipt PDF for the same invoice.",
     "Both are accepted and stored, each against its own field, and both may be retrieved and read."],
    ["2", "A corrected invoice PDF is pushed for a reference already sent.",
     "The response reports replacement, the superseded file is removed, and the corrected document is retrievable."],
    ["3", "A batch of fifty documents is pushed in one window.",
     "All are stored, none is lost, and the rate limit is not reached."],
    ["4", "A batch is pushed during a planned maintenance window.",
     "The uploads succeed notwithstanding the maintenance notice shown to other users."],
    ["5", "A document is pushed for an invoice reference unknown to SAMAR.",
     "A clear rejection is returned, upon which the ERP can act."],
    ["6", "The service account password is rotated.",
     "The ERP's next batch fails until it adopts the new password, and succeeds thereafter."],
    ["7", "The connection is interrupted during a batch and the ERP retries.",
     "No duplicate document is created and the final state is correct."],
], sizes=[1.0, 7.4, 8.8], fs=9.5)

# ================= 7. OBSERVATIONS =================
m.divider("Part 7", "Observations", "Matters identified during the examination of the code")

m.banner("7.1  Observations")
m.body("The following were noted while preparing this plan. They are recorded so that the tester may distinguish a defect from "
       "known behaviour, and so that they may be taken up separately.")
m.simple_table(["Severity", "Observation"], [
    ["Critical", "The invoice reference generator is not called from anywhere in the application, and no code path creates an "
                 "invoice. The inbound endpoint therefore cannot match a genuine invoice in production."],
    ["Warning", "There is no automated test of any part of the integration, notwithstanding that the endpoint is externally "
                "reachable, accepts arbitrary encoded payloads, and is exempt from maintenance mode."],
    ["Warning", "An oversized document is reported as a generic internal error, which does not permit the ERP to distinguish a "
                "permanent failure, which should not be retried, from a transient one, which should."],
    ["Warning", "The superseded document is deleted after the transaction has been committed. Should that deletion fail, the file "
                "remains on disk with no record referring to it."],
    ["Information", "Authorisation is enforced by the route alone; the request class permits all callers. Moving the route "
                    "without its middleware would open the endpoint."],
    ["Information", "The invoice is fetched outside the error-handling block, so a race between validation and retrieval would "
                    "produce a bare 404 rather than the error format used elsewhere."],
    ["Information", "Audit entries for ERP uploads are recorded without an actor, the upload being performed by a machine account "
                    "outside an interactive session. This is a known defect of the audit trail and is documented separately."],
], sizes=[2.6, 14.6], fs=9.5)

# ================= APPENDIX A =================
m.page_break()
m.banner("Appendix A — Request and response reference", align='center')
m.body("Endpoint: POST /api/v1/erp/documents/upload. Authentication is by bearer token belonging to the ERP service account. "
       "The field names follow QCI's existing vendor contract.")
m.simple_table(["Field", "Type", "Required", "Description"], [
    ["invstr", "string, max 20", "Yes", "The portal invoice reference, for example SAMAR/2026-27/00001."],
    ["erp_invstr", "string, max 20", "No", "The invoice number on the ERP side. Recorded against the invoice when supplied."],
    ["pdfstr", "string", "Yes", "The document, encoded as base64. Strictly decoded and verified to be a PDF."],
    ["pdffor", "'i' or 'r'", "Yes", "'i' for an invoice document, 'r' for a receipt document."],
], sizes=[3.0, 3.0, 2.0, 9.2], fs=9.5)

m.body("Responses:")
m.simple_table(["Status", "Meaning"], [
    ["201", "The document was attached for the first time."],
    ["200", "A document of this type already existed and has been replaced."],
    ["401", "No valid access token was presented."],
    ["403", "The token does not belong to the ERP service account."],
    ["422", "The request failed validation, or the payload was not a valid PDF."],
    ["429", "The rate limit of sixty requests per minute was exceeded."],
    ["500", "The document could not be stored."],
], sizes=[3.0, 14.2], fs=9.5)

m.note("The response carries the invoice reference, the identifier of the stored document, and a flag indicating whether an "
       "existing document was replaced. The ERP may rely on that flag to distinguish a first delivery from a retry.")

m.save(OUT)
