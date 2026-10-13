# -*- coding: utf-8 -*-
"""SAMAR Portal — Audit Log: Missing User Attribution. Analysis and determination.

Formal response to the query raised against the Activity Log screen on
21-Jul-2026, in which some entries showed no user and the IP address 127.0.0.1.

Reuses the document machinery in docs/user-manual/samar_common.py. Run from anywhere:

    python docs/reports/build_audit_attribution_analysis.py

Findings derived from a read of the implementation as at 22-Jul-2026:
HasAuditLog, AuditLog, TracksUserActions, ApplicationStateMachine,
ProvisionErpServiceAccount, BackfillUnitAdmins, scripts/manual-payment-complete.php,
scripts/icici-fix-mismarked-payments.php, routes/console.php, and the
audit_logs / users migrations.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "user-manual"))

from samar_common import Manual, GREY  # noqa: E402

OUT = r"C:\Users\WB0228-VIDUSHI\Downloads\SAMAR Portal - Audit Log Attribution Analysis.docx"
VERSION = "Version 1.0   ·   22-Jul-2026"

m = Manual("SAMAR Portal — Audit Log Attribution Analysis", VERSION)

# ================= COVER =================
m.cover("Audit Log Attribution",
        "SAMAR Portal — Analysis and Determination",
        "Entries recorded with no user and the IP address 127.0.0.1",
        VERSION + "   ·   Quality Council of India & DRDO, Ministry of Defence")

# ================= CONTENTS =================
m.contents([
    ("1 — The observation", ["What was reported", "The affected rows", "The two signals"]),
    ("2 — Determination", ["Conclusion", "Classification", "Severity"]),
    ("3 — Findings against each question",
     ["Which process generates these entries", "Whether the empty actor is intentional",
      "Whether a System, CLI or Operator actor is supported",
      "Whether the operator should be propagated", "What these rows should display",
      "Classification and reasoning"]),
    ("4 — Root cause in the code", ["The audit trait", "The affected scripts", "The related gap in the business records"]),
    ("5 — Recommended remedy", ["The approach recommended", "The approach to be avoided", "Correcting existing records"]),
    ("6 — A related finding", []),
    ("Appendix A — Verification queries", []),
    ("Appendix B — Index of code references", []),
])

# ================= PART 1 =================
m.divider("Part 1", "The observation", "What was reported and what the rows show")

m.banner("1.1  What was reported")
m.body("On the Activity Log screen, certain entries were observed to record the action successfully — the object, the event and "
       "the time are all present — but to show no user. The affected entries also carry the IP address 127.0.0.1. The question "
       "raised was whether this constitutes a defect or the intended behaviour of the system.")

m.banner("1.2  The affected rows")
m.body("The entries observed on 21-Jul-2026 at approximately 04:46 PM were as follows. For comparison, the rows immediately "
       "before and after them carry both a user and a public IP address.")
m.simple_table(["User", "Event", "Object", "Time", "IP address"], [
    ["—", "Created", "Assessment #173", "04:46 PM", "127.0.0.1"],
    ["—", "Updated", "Application #179", "04:46 PM", "127.0.0.1"],
    ["—", "Updated", "Application #179", "04:46 PM", "127.0.0.1"],
    ["—", "Created", "Assessment #172", "04:46 PM", "127.0.0.1"],
    ["—", "Updated", "Application #212", "04:46 PM", "127.0.0.1"],
    ["—", "Updated", "Application #212", "04:46 PM", "127.0.0.1"],
    ["Naman Lead Twenty Three", "Updated", "Assessment #171", "04:45 PM", "122.160.165.47"],
    ["Balakrishnan Iyer", "Updated", "Assessment #171", "04:43 PM", "122.160.165.47"],
], sizes=[4.4, 2.2, 3.6, 2.4, 3.0], fs=9.5)

m.banner("1.3  The two signals")
m.body("Each affected row carries two distinct indications, and they have a single common cause:")
m.bullets([
    "The user is absent. The stored user_id and user_email are empty; the stored user name is a single space character, which is "
    "not the same as an empty value, and this distinction has practical consequences set out in Part 4.",
    "The IP address is the loopback address. The action did not arrive over the network at all.",
])
m.note("Every entry bearing a public IP address carries a user name; every entry bearing 127.0.0.1 does not. The correlation is "
       "exact, and it is the starting point of the analysis.")

# ================= PART 2 =================
m.divider("Part 2", "Determination", "The conclusion reached, stated before the reasoning")

m.banner("2.1  Conclusion")
m.body("These entries were produced by a maintenance script executed on the server from the command line. In that context there "
       "is no logged-in user and no incoming web request, so the audit trail records no user and falls back to the loopback "
       "address.")
m.body("This is not the intended behaviour of the system. It is a defect, whose underlying cause is that the audit trail has no "
       "means of expressing an actor that is not an interactive, logged-in user. The action performed — the completion of a "
       "payment and the consequent creation of an assessment — is precisely the class of action an audit trail exists to attribute.")

m.banner("2.2  Classification")
m.simple_table(["Layer", "Item", "Classification"], [
    ["Underlying cause", "The audit trail has no concept of a System, CLI, service or operator actor.", "Design limitation"],
    ["Defect", "The stored user name is a single space rather than an empty value.", "Bug"],
    ["Defect", "Entries written from the command line record a web request method and address that never existed.", "Bug"],
    ["Gap", "The operator named when running the script is captured, but never reaches the audit trail.", "Implementation gap"],
    ["Symptom", "The Activity Log screen displays a dash.", "Consequence of the above"],
], sizes=[3.4, 9.6, 4.2], fs=9.5)
m.body("Taken together: a defect that should be corrected, whose root cause is a limitation of the original design.", space=8)

m.banner("2.3  Severity")
m.body("High, but not critical. No record has been lost and no action has gone unrecorded; what is missing is the attribution. "
       "The operator responsible for the entries in question can still be established today from the payment record, as set out "
       "in Appendix A. The severity arises from the nature of the action rather than its volume: a financial state change made "
       "by a person with access to the server, recorded as having no author, is an attribution failure in a trail maintained for "
       "compliance purposes.")

# ================= PART 3 =================
m.divider("Part 3", "Findings against each question", "Taken in the order in which they were put")

m.banner("3.1  Are these entries generated by a CLI script, a scheduled job, a state machine, or another server-side process?")
m.body("By a manually executed command-line script. Scheduled jobs are ruled out, and the state machine, although it is the "
       "immediate writer of two of the rows, is not the cause.")
m.body("The rows observed correspond exactly to the sequence of writes performed by scripts/manual-payment-complete.php: a "
       "direct update to the application, followed by a state-machine transition which updates the application a second time and "
       "creates the assessment. Two applications processed in a single run account for all six rows.")
m.simple_table(["Process", "Writes an audited record?", "Can produce these rows"], [
    ["scripts/manual-payment-complete.php", "Application, Assessment", "Yes — corresponds to the rows observed"],
    ["scripts/icici-fix-mismarked-payments.php", "Application, Assessment", "Yes — identical pattern"],
    ["erp:provision-service-account", "User", "Yes"],
    ["assessments:recalculate-scores, sitepictures:dedupe", "Records that are not audited", "No"],
    ["Scheduled tasks (error-log cleanup, expiring certificates)", "Records that are not audited", "No"],
], sizes=[6.8, 5.2, 5.2], fs=9.5)
m.note("The state machine faithfully carries whatever actor it is given. When the same transition runs from the web portal it "
       "carries the logged-in user; the scripts construct it without one.")

m.banner("3.2  Is the audit system intentionally designed to leave the user empty, or is this an implementation gap?")
m.body("It is an unhandled case rather than a designed one. Three considerations establish this:")
m.bullets([
    "The stored user name is a single space, produced by joining two empty values with a space. No design stores a space in a "
    "field intended to be empty; this is the signature of an unconsidered path rather than a deliberate one.",
    "The published documentation of the audit trail states, among its compliance features, that every action is linked to an "
    "authenticated user. Entries with no user contradict the stated requirement.",
    "The user column was made optional so that the removal of a user account would not delete the historical entry, not in "
    "order to represent an action with no author.",
])
m.body("A further indication: entries written from the command line record a web request method and address, both of which are "
       "fabricated by the framework in the absence of a real request. The entry positively asserts something that did not occur.")

m.banner("3.3  Does the system support recording a System, CLI, service account or operator actor?")
m.body("It does not. The facility is absent at every level, as established by an exhaustive search of the application:")
m.simple_table(["Facility", "Present?"], [
    ["A parameter by which an actor may be supplied when recording an entry", "No — the method resolves the actor internally"],
    ["Any use of that method anywhere in the application", "No — every entry arises from automatic record events"],
    ["Any detection of command-line execution", "No"],
    ["Any facility by which a script assumes the identity of a user", "No"],
    ["A designated System user or equivalent constant", "No"],
], sizes=[11.0, 6.2], fs=9.5)
m.body("An additional column intended for supplementary information does exist on the audit record and is presently unused. It "
       "is the natural place in which to record the script and the operator.")
m.note("The absence is not for want of recognition of the problem. A separate maintenance command takes deliberate trouble to "
       "establish the correct actor and to pass it onward, observing that this is the same path the ordinary flow would have "
       "taken. That actor nonetheless never reaches the audit trail, there being no parameter able to carry it.")

m.banner("3.4  Should the operator named when running the script be propagated to the audit trail?")
m.body("Yes. The omission is a gap rather than a decision.")
m.body("The script already treats the identification of the operator as an obligation. It accepts the operator's name, records "
       "it together with the reason, the time, the environment and the name of the script, and stores that block against the "
       "payment record. The intention is unmistakable; the information is simply written to a place that no one examining the "
       "Activity Log will open. It stops short of the audit trail only because, as set out in the preceding paragraph, there is "
       "no means of putting it there.")

m.banner("3.5  Should these entries display a dash, or a meaningful actor?")
m.body("A meaningful actor, composed of two parts:")
m.bullets([
    "An explicit label in place of the user name, such as 'System (CLI)', with the user identifier and email address left "
    "genuinely empty.",
    "The name of the script and the operator who executed it, recorded in the supplementary information column, together with "
    "the reason given.",
])
m.body("The request method and address should be left empty for entries written from the command line, rather than recording "
       "fabricated values.")

m.banner("3.6  Classification and reasoning")
m.body("A defect that should be corrected, whose underlying cause is a limitation of the design. It is not expected behaviour.")
m.body("It cannot be regarded as expected behaviour because the documented purpose of the trail includes attribution, and "
       "because a trail maintained for compliance cannot treat an unknown author as an acceptable resting state — least of all "
       "for a manual override of a payment, which is among the actions most requiring attribution.")
m.body("Nor is it merely cosmetic. Because the stored value is a space rather than an empty value, a search for entries having "
       "no user returns nothing, so the affected entries cannot readily be identified for review or reporting. The gap also "
       "extends beyond the audit trail into the business records themselves: the assessments created by the script carry no "
       "creator on the record.")

# ================= PART 4 =================
m.divider("Part 4", "Root cause in the code", "For the technical reader")

m.banner("4.1  The audit trait")
m.body("Every audited record writes an entry automatically when it is created, updated, deleted or restored. The actor is taken "
       "from the authentication session alone:")
m.code("$user = Auth::user();\n\n"
       "'user_id'        => $user?->id,\n"
       "'user_name'      => $user?->first_name.' '.$user?->last_name,\n"
       "'user_email'     => $user?->email,\n"
       "'ip_address'     => Request::ip(),\n"
       "'request_method' => Request::method(),\n"
       "'request_url'    => Request::fullUrl(),",
       caption="app/Traits/HasAuditLog.php, lines 69 to 90")
m.body("Where the write does not originate in a web request, the authentication session is empty, the address falls back to the "
       "loopback address, and the request method and address are fabricated. The expression forming the user name yields a "
       "single space, the join being performed regardless of whether either part is present.")

m.banner("4.2  The affected scripts")
m.body("The script boots the framework directly, without a session, and performs its writes inside a transaction:")
m.code("$locked->update([ ... ]);                       // application updated\n\n"
       "$sm = new ApplicationStateMachine($locked);     // constructed without an actor\n"
       "$sm->transition('payment_success');             // application updated again;\n"
       "                                                // assessment created",
       caption="scripts/manual-payment-complete.php, lines 144 to 157")
m.body("The operator is captured and recorded, but against the payment rather than the audit trail:")
m.code("$auditMeta = ['manual_override' => [\n"
       "    'reason'       => $reason,\n"
       "    'performed_by' => $operator,\n"
       "    'script'       => 'scripts/manual-payment-complete.php',\n"
       "]];",
       caption="scripts/manual-payment-complete.php, lines 117 to 126")

m.banner("4.3  The related gap in the business records")
m.body("The same absence of an actor affects the records themselves, not only the audit trail. The fields recording who created "
       "and who last amended a record are set only when a user is logged in, and the state machine records the creator of a new "
       "assessment from the actor it was given. The assessments created by the run in question therefore carry no creator.")
m.note("A screen or report displaying 'created by' for those assessments will likewise show nothing. Any correction should "
       "address both the audit trail and the records.")

# ================= PART 5 =================
m.divider("Part 5", "Recommended remedy", "And the approach that should be avoided")

m.banner("5.1  The approach recommended")
m.bullets([
    "Give the audit trail an explicit notion of a non-interactive actor. Where no user is logged in and the write originates "
    "from the command line, record an explicit label in place of the user name and leave the identifier and email address "
    "genuinely empty.",
    "Allow an entry point — a script or a command — to declare, once, the script name and the operator responsible, so that "
    "every write it subsequently performs carries them in the supplementary information column.",
    "Pass the operator already accepted by the payment scripts into that declaration.",
    "Correct the two defects: form the user name only when a user is present, and leave the request method and address empty "
    "for writes not arising from a web request.",
])

m.banner("5.2  The approach to be avoided")
m.note("The defect should not be remedied by having scripts log in as a real user in order to satisfy the existing code. That "
       "would render a server-side override indistinguishable from an action performed by that person in the portal. For a "
       "trail maintained for compliance, a misleading attribution is worse than an absent one.")

m.banner("5.3  Correcting existing records")
m.body("The entries already recorded can be corrected from information that still exists. The operator is recoverable from the "
       "payment record, and the timestamps tie the application and assessment entries to the same run. Any correction should be "
       "carried out deliberately and recorded as such, the audit trail being documented as immutable.")

# ================= PART 6 =================
m.divider("Part 6", "A related finding", "Of higher severity, encountered during this analysis")

m.banner("6.1  The ERP service account cannot presently be created")
m.body("While tracing which server-side processes write audited records, the command that provisions the Business Central "
       "service account was examined. It cannot succeed as written.")
m.body("The command supplies a field named 'name' when creating the account. The users table has no such column: it holds a "
       "first name and a last name, both of which are required and neither of which has a default value. The supplied field is "
       "silently discarded, and the insertion then fails because the required name fields have not been provided.")
m.simple_table(["Aspect", "Finding"], [
    ["Effect", "The ERP service account cannot be created. The inbound document interface cannot be authenticated against."],
    ["Consequence", "Every test case concerning provisioning, and every test requiring an ERP token, fails at the first step."],
    ["Corroboration", "The commit introducing the interface records that provisioning had not been run against a live database."],
    ["Correction", "Supply the first and last name fields in place of the single name field."],
], sizes=[3.4, 13.8], fs=9.5)
m.note("This finding is unrelated to the audit trail but is recorded here because it was established in the course of the same "
       "examination, and because it blocks the ERP integration entirely.")

# ================= APPENDIX A =================
m.page_break()
m.banner("Appendix A — Verification queries", align='center')
m.body("To be run against the environment in which the entries were observed.")
m.code("-- 1. The affected entries, showing the stored user name delimited\n"
       "SELECT id, auditable_type, auditable_id, event, user_id,\n"
       "       CONCAT('[', user_name, ']') AS user_name_raw,\n"
       "       ip_address, request_method, created_at\n"
       "FROM audit_logs\n"
       "WHERE created_at BETWEEN '2026-07-21 16:45:00' AND '2026-07-21 16:47:00'\n"
       "ORDER BY id;",
       caption="Confirm the origin")
m.code("-- 2. Confirm the stored value is a space, not an empty value\n"
       "SELECT COUNT(*) AS null_names, SUM(TRIM(user_name) = '') AS blank_names\n"
       "FROM audit_logs WHERE user_id IS NULL;",
       caption="Confirm the defect")
m.code("-- 3. Confirm the assessments carry no creator\n"
       "SELECT id, application_id, status, created_by, created_at\n"
       "FROM assessments WHERE id IN (172, 173);",
       caption="Confirm the related gap")
m.code("-- 4. Recover the operator for the entries in question\n"
       "SELECT id, application_id, gateway_payment_id,\n"
       "       JSON_EXTRACT(webhook_payload, '$.manual_override') AS manual_override\n"
       "FROM payments WHERE application_id IN (179, 212) ORDER BY id DESC;",
       caption="Establish who performed the action")

# ================= APPENDIX B =================
m.page_break()
m.banner("Appendix B — Index of code references", align='center')
m.simple_table(["File", "Lines", "Relevance"], [
    ["app/Traits/HasAuditLog.php", "61–93", "Records the entry; resolves the actor from the session alone"],
    ["app/Traits/HasAuditLog.php", "81", "Forms the user name; yields a space when no user is present"],
    ["app/Traits/HasAuditLog.php", "89–90", "Records a fabricated request method and address"],
    ["app/Models/AuditLog.php", "73–83", "Composes the description, including the empty user name"],
    ["app/Traits/TracksUserActions.php", "12–37", "Records the creator and amender only when a user is logged in"],
    ["app/Services/StateMachine/ApplicationStateMachine.php", "262–282", "Creates the assessment; records the creator from the actor supplied"],
    ["scripts/manual-payment-complete.php", "128–175", "The writes corresponding to the entries observed"],
    ["scripts/manual-payment-complete.php", "117–126", "Captures the operator; records it against the payment"],
    ["scripts/icici-fix-mismarked-payments.php", "96–132", "A second script producing the same pattern"],
    ["app/Console/Commands/BackfillUnitAdmins.php", "92–105", "Establishes an actor deliberately; it does not reach the trail"],
    ["app/Console/Commands/ProvisionErpServiceAccount.php", "46–56", "The finding recorded in Part 6"],
    ["database/migrations/…_create_audit_logs_table.php", "20–33", "The audit record, including the unused supplementary column"],
    ["docs/20-features/29-audit-trail.md", "—", "States that every action is linked to an authenticated user"],
], sizes=[7.6, 2.4, 7.2], fs=9)

m.save(OUT)
