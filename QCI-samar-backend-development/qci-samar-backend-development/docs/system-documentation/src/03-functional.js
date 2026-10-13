const H = require(require("os").homedir() + "/.claude/skills/webority/scripts/helpers.js");
const path = require("path");
const DIAG = path.join(__dirname, "..", "diagrams");
const { step } = require("./_step.js");

module.exports = function functional() {
  return [
    H.h1("3. Functional architecture"),
    H.p(
      "This section describes what the system does, module by module, in the order an application passes through them."
    ),

    // ── 3.1 ────────────────────────────────────────────────
    H.h2("3.1 Registration and onboarding"),
    H.p(
      "A vendor registers themselves. They supply an organisation name, a contact name, an email address and optionally a mobile number. No password is chosen at this point. The system creates the organisation and a first user, generates a six-digit one-time password and emails it."
    ),
    H.p(
      "When the code is confirmed, the system generates the account password, activates the user as Enterprise Admin for the new organisation, and emails the SAMAR ID together with the password. From then on the SAMAR ID is the login credential. Email addresses are not used to sign in and are not required to be unique."
    ),
    H.p(
      "A SAMAR ID looks like SAMAR-040226-1: a fixed prefix, the account creation date, and the account number. Every user in the system has one, including assessors and QCI staff, who are created by an administrator rather than self-registering and receive their credentials by email."
    ),
    H.p(
      "Before an organisation can submit anything it has to complete its profile. The system checks for the PAN, the GST registration and the certificate of incorporation, and refuses submission until all three are present."
    ),

    H.h3("Units"),
    H.p(
      "Certification applies to a unit. A unit is created from the address entered when an application is started: the system matches that address to an existing unit or creates a new one, so units come into being through the application rather than being registered separately beforehand. An Enterprise Admin assigns each unit's Unit Admin, and a Unit Admin sees only the units recorded against their account. A unit may hold only one live application at a time, which prevents duplicate assessments of the same site."
    ),

    // ── 3.2 ────────────────────────────────────────────────
    H.h2("3.2 Building an application"),
    H.p(
      "Applications are created through a five-step form. Manufacturing and service applications use different forms because they capture different things, but both produce the same kind of application record."
    ),
    H.makeTable(
      ["Step", "Manufacturing captures", "Service captures"],
      [
        ["1. Enterprise", "Organisation details, statutory registrations and the unit being assessed.", "Same."],
        ["2. Operations", "Key processes, outsourced processes, stores and production capacity.", "Key processes, outsourced processes and key resources."],
        ["3. Products or services", "Products, raw materials and bought-out parts.", "Services offered and outsourced components."],
        ["4. Declarations", "Vendor category, DRDO vendor stores, third-party certifications and customer references.", "Vendor category, service provider type, DRDO vendor labs and customer references."],
        ["5. Review", "A read-only summary before submission.", "Same."],
      ],
      [1700, 4023, 4023]
    ),
    H.p(
      "Work in progress is saved as a draft and can be returned to. Draft is the only state in which an application can be edited, and the only state from which it can be deleted."
    ),
    H.p(
      "Each application is given a number of the form SAMAR-482-0726, combining a sequence number with the month and year. The number is generated when the draft is created, not at submission, so it can be quoted in correspondence from the outset."
    ),

    // ── 3.3 ────────────────────────────────────────────────
    H.h2("3.3 The application lifecycle"),
    H.p(
      "An application moves through seven states. Two of them are final."
    ),
    H.makeTable(
      ["State", "What it means", "Editable"],
      [
        ["Draft", "Being prepared by the applicant. The only editable state.", "Yes"],
        ["DRDO approval pending", "Submitted and awaiting a DRDO decision.", "No"],
        ["Payment pending", "Cleared to pay, either because DRDO approved it or because approval is not required.", "No"],
        ["Payment completed", "Fee received. An assessment record now exists and awaits a team.", "No"],
        ["In progress", "The assessment has been scheduled. The whole assessment runs inside this one application state.", "No"],
        ["Certified", "Final. A certificate has been issued.", "No"],
        ["Rejected", "Final. DRDO declined the application.", "No"],
      ],
      [2400, 5946, 1400]
    ),
    H.image(path.join(DIAG, "02-application-lifecycle.png"), { widthPct: 62 }),
    H.caption("Figure 2: Application lifecycle"),

    H.p("Who can move an application, and what has to be true first:"),
    H.makeTable(
      ["From", "To", "Triggered by", "Conditions"],
      [
        ["Draft", "DRDO approval pending", "Enterprise Admin or Unit Admin", "Organisation profile complete, and the scheme requires DRDO approval."],
        ["Draft", "Payment pending", "Enterprise Admin or Unit Admin", "Organisation profile complete, and the scheme does not require DRDO approval."],
        ["DRDO approval pending", "Payment pending", "DRDO Admin", "Approval recorded, with remarks."],
        ["DRDO approval pending", "Rejected", "DRDO Admin", "Rejection recorded, with a reason. Final."],
        ["Payment pending", "Payment completed", "The system", "A payment has been confirmed as successful."],
        ["Payment completed", "In progress", "The system", "Follows automatically once the assessment is scheduled."],
        ["In progress", "Certified", "The system", "Follows automatically once the assessment is certified and a certificate exists."],
      ],
      [2100, 2100, 2200, 3346]
    ),
    H.note("Whether DRDO approval is required at all is a system-wide setting a System Admin controls, not a per-application choice."),
    H.p(
      "Every move is recorded with the previous state, the new state, who made it, the role they held, any remarks, and the time. That history is what an audit of a certificate decision would follow."
    ),

    // ── 3.4 ────────────────────────────────────────────────
    H.h2("3.4 DRDO approval"),
    H.p(
      "Where the scheme requires it, a submitted application waits for a DRDO Admin to approve or reject it. Approval releases the application for payment and stamps the approval time and remarks. Rejection is final: the application cannot be revived, and the applicant would have to start a new one. Both outcomes email the applicant."
    ),

    // ── 3.5 ────────────────────────────────────────────────
    H.h2("3.5 Fees and payment"),
    H.h3("How the fee is worked out"),
    H.p(
      "The fee depends on two things about the applicant: the sector and the size band of the enterprise. Together they select a rate card. Each rate card holds a base certification fee, a food and accommodation charge that covers the assessment visit, the GST rate, and whether that card permits a TDS deduction."
    ),
    H.p("The calculation runs in this order:"),
    ...step([
      "Take the base certification fee and add the food and accommodation charge. That is the amount payable.",
      "Apply GST to the amount payable.",
      "If the applicant has elected TDS and the rate card permits it, calculate TDS on the amount payable, before GST.",
      "The total is the amount payable, plus GST, less any TDS.",
    ]),
    H.p(
      "Only two TDS rates are accepted, 2% and 10%. Any other value is refused. If an applicant elects TDS on a rate card that does not permit it, the election is ignored rather than rejected."
    ),

    H.h3("The rate card"),
    H.p("The rates currently loaded are the same for both sectors:"),
    H.makeTable(
      ["Enterprise size", "Base certification fee", "Food and accommodation", "Amount payable", "GST at 18%", "Total"],
      [
        ["Startup", "₹30,000", "₹2,000", "₹32,000", "₹5,760", "₹37,760"],
        ["Micro", "₹35,000", "₹2,000", "₹37,000", "₹6,660", "₹43,660"],
        ["Small", "₹40,000", "₹2,000", "₹42,000", "₹7,560", "₹49,560"],
        ["Medium", "₹45,000", "₹2,000", "₹47,000", "₹8,460", "₹55,460"],
        ["Large", "₹50,000", "₹2,000", "₹52,000", "₹9,360", "₹61,360"],
      ],
      [1800, 1900, 2100, 1400, 1300, 1246]
    ),
    H.note("All amounts are excl. GST until the GST column, which applies GST at 18%. TDS is not enabled on any rate card as currently configured, so the total column is what an applicant pays today."),
    H.p(
      "A System Admin or Operations Admin can change the base fee, the food and accommodation charge, the GST rate and the TDS switch for any sector and size combination through the portal. The two sectors, the five size bands, the two permitted TDS rates and the calculation itself are fixed in the software and would need a change request."
    ),

    H.h3("Paying"),
    H.p(
      "The applicant is quoted the fee, confirms, and is sent to ICICI EazyPay. The system recalculates the fee at that moment rather than trusting the figure the browser holds, and stores the full breakdown against the payment. That snapshot is what appears on the invoice, so a later change to the rate card cannot alter a payment already made."
    ),
    H.image(path.join(DIAG, "04-payment-sequence.png"), { widthPct: 88 }),
    H.caption("Figure 3: Payment flow"),
    H.p(
      "Payment confirmation arrives twice: once when the applicant is returned to the portal, and once as a direct server-to-server message from the bank. Both are signature-checked, and either can complete the payment, so a customer who closes the browser mid-payment is still recorded correctly. Duplicate confirmations are ignored."
    ),
    H.p(
      "Once a payment succeeds the application moves to payment completed, an assessment record is created automatically, and an invoice and receipt are raised in the ERP. If a payment fails, only the payment record changes; the application stays where it is and the applicant can try again."
    ),
    H.p(
      "Fees are not refundable. The applicant's declaration states that the amount is non-refundable, non-adjustable and non-transferable regardless of the certification outcome, and the system has no refund function."
    ),

    // ── 3.6 ────────────────────────────────────────────────
    H.h2("3.6 Allocating the assessment"),
    H.p(
      "When payment completes, an assessment is created and waits for a team. An Operations Manager names a lead assessor, adds any co-assessors, and sets the start and end dates. For a service-sector assessment a meeting link is also required, because those are conducted remotely."
    ),
    H.p("The system refuses an allocation that would breach any of these:"),
    H.bullet("Every named person must actually hold the assessor role."),
    H.bullet("Every assessor must be approved for the state the unit is in. An assessment cannot be scheduled at all if the unit has no state recorded."),
    H.bullet("No assessor may already be booked on another assessment whose dates overlap."),
    H.bullet("The team cannot be changed once any part of the assessment has begun."),
    H.p(
      "Rescheduling reuses the same screen. Changing the dates of an already-scheduled assessment increments a reschedule counter, which is the signal an assessor's device uses to discard whatever it holds for that assessment and pull the server's copy down again. The server is authoritative: any local changes not yet synced give way to it. Rescheduling is therefore meant to happen before on-site work begins. Changing the team without changing the dates does not trigger the discard, but does re-notify the applicant."
    ),

    // ── 3.7 ────────────────────────────────────────────────
    H.h2("3.7 Conducting the assessment"),
    H.p(
      "The on-site work is done in the assessor mobile application, in seven steps. Some are the lead assessor's alone."
    ),
    H.makeTable(
      ["Step", "What happens", "Who"],
      [
        ["1. Parameter allocation", "The lead divides the assessment parameters among the team. Every team member must receive at least one.", "Lead only"],
        ["2. Site pictures", "Interior and exterior photographs of the site are captured.", "Any member"],
        ["3. Opening meeting", "The opening meeting is held and attendance recorded.", "Lead only"],
        ["4. Site tour", "Titled photographs are taken through the tour of the site.", "Any member"],
        ["5. Basic information", "Details of the unit are captured or confirmed against what was declared.", "Lead only"],
        ["6. Assessment parameters", "Each assessor answers the questions for the parameters allocated to them, with evidence photographs.", "Each member"],
        ["7. Closing meeting", "The closing meeting is held, comments recorded and attendance taken.", "Lead only"],
      ],
      [2100, 5646, 2000]
    ),
    H.p(
      "The assessment is bracketed by a punch-in and a punch-out. Punching in requires the assessor's location and takes a photograph of them where the camera allows; together these evidence attendance at the site. Every photograph taken during the assessment is stamped with the location and time it was captured."
    ),
    H.p(
      "Parameter allocation locks the first time it is saved. This is deliberate: once work has been divided and started, silently moving a parameter between assessors would orphan answers already given."
    ),
    H.p(
      "Co-assessors finish their own work first; the lead can only close the field work once every member has. Co-assessors then confirm their part on the web portal before the lead can submit the assessment for quality check."
    ),

    // ── 3.8 ────────────────────────────────────────────────
    H.h2("3.8 The assessment lifecycle"),
    H.p("An assessment moves through ten states."),
    H.makeTable(
      ["State", "What it means"],
      [
        ["Allocation pending", "Created on payment. Waiting for a team and dates."],
        ["Scheduled", "Team and dates set. Waiting for the assessor to start."],
        ["In progress", "Field work under way. All seven steps happen here."],
        ["Field work complete", "Every team member has finished on site."],
        ["Quality check", "With the Operations Manager for review."],
        ["Quality check feedback", "Sent back with comments against specific questions."],
        ["Ready for committee", "Passed quality check. Waiting to be put before a committee."],
        ["Committee review", "Attached to a rating committee meeting."],
        ["Committee feedback", "The committee has sent it back."],
        ["Certified", "Final. A certificate has been issued."],
      ],
      [2600, 7146]
    ),
    H.image(path.join(DIAG, "03a-assessment-field.png"), { widthPct: 56 }),
    H.caption("Figure 4: Assessment from allocation through quality check"),
    H.image(path.join(DIAG, "03b-assessment-review.png"), { widthPct: 58 }),
    H.caption("Figure 5: Committee review and certification"),

    H.p("The moves, and who makes them:"),
    H.makeTable(
      ["From", "To", "Triggered by", "Conditions"],
      [
        ["Allocation pending", "Scheduled", "Operations Manager", "Team and dates valid, no assessor clashes."],
        ["Scheduled", "In progress", "Any team member", "The assessor starts the assessment."],
        ["In progress", "Field work complete", "The system", "Every team member has finished their field work."],
        ["Field work complete", "Quality check", "Lead assessor", "Every question on every allocated parameter answered, and a score calculated."],
        ["Quality check", "Ready for committee", "Operations Manager", "Approved."],
        ["Quality check", "Quality check feedback", "Operations Manager", "Sent back with comments on named questions."],
        ["Quality check feedback", "Ready for committee", "Lead assessor", "The lead has responded to the comments."],
        ["Ready for committee", "Committee review", "Operations Admin", "Attached to a rating committee meeting."],
        ["Committee review", "Certified", "Operations Admin", "Recorded at the meeting, applied when the meeting is closed."],
        ["Committee review", "Committee feedback", "Operations Admin", "Recorded at the meeting. Limited to two send-backs."],
        ["Committee feedback", "Quality check", "Lead assessor", "The response re-enters the quality check loop, not the committee."],
      ],
      [2000, 2000, 2400, 3346]
    ),

    // ── 3.9 ────────────────────────────────────────────────
    H.h2("3.9 Quality check"),
    H.p(
      "The Operations Manager reviews the submitted assessment and either approves it or sends it back. Sending it back attaches a comment to each question in question, so the assessor sees exactly what needs attention rather than a general instruction."
    ),
    H.p(
      "When the lead responds, every question's review marker is cleared and the score is recalculated, so the second review starts clean rather than carrying stale flags."
    ),

    // ── 3.10 ───────────────────────────────────────────────
    H.h2("3.10 The rating committee"),
    H.p(
      "Assessments that pass quality check are grouped into a rating committee meeting. A meeting has a chair, a convenor and members, drawn from a register of committee members maintained in the portal. Committee members are people recorded against meetings; they are not user accounts and do not sign in."
    ),
    H.p("During the meeting the committee can:"),
    H.bullet("Adjust the score on any individual question. The committee's score overrides the assessor's for that question."),
    H.bullet("Send the assessment back with clarifications, at most twice."),
    H.bullet("Certify it."),
    H.p(
      "Decisions are recorded as the meeting proceeds but are not applied until the meeting is closed. Closing the meeting applies every recorded decision at once, issues certificates for those certified, generates the minutes and sends the notifications. That is a deliberate design point: it means a decision can be revised while the meeting is still running."
    ),

    // ── 3.11 ───────────────────────────────────────────────
    H.h2("3.11 Certificates"),
    H.p(
      "A certificate is created automatically when an assessment is certified. There is no manual issue function. Each certificate records the organisation, the unit, the scope as manufacturing or service, the final score, the rating level, and the period of validity."
    ),
    H.makeTable(
      ["Property", "How it is set"],
      [
        ["Certificate number", "The issue date followed by part of the issuing user's SAMAR ID. A suffix is added if the same person issues more than one on the same day."],
        ["Type", "Initial where the unit has never held a certificate, renewal where it has. Determined automatically."],
        ["Validity", "Three years by default, taken from a system setting a System Admin can change. A renewal continues from the previous certificate's expiry, so there is no gap."],
        ["Rating level", "Level 1 to 5, derived from the final score."],
        ["Status", "Active on issue. A renewed predecessor is marked as renewed."],
      ],
      [2200, 7546]
    ),
    H.p(
      "The certificate is produced as a two-sided PDF carrying a QR code. Scanning it opens the public verification page. Verification needs no login and returns the certificate number, the organisation and unit, the address, the rating level, the status, the validity dates and the scope. It does not disclose the score, the assessment, the internal identifiers, or the certificate file itself."
    ),
    H.p(
      "Before a certificate expires the recertification window opens, ninety days ahead by default. Only then can the unit apply again. Reminder emails are sent when the window opens, thirty days out, seven days out, and on expiry, each sent once."
    ),
    H.p(
      "A certificate is issued automatically and then either runs to expiry or is superseded by a renewal. There is no way in the application to suspend or revoke a certificate. The data model carries suspended and revoked states, and the authorisation layer names who would be allowed to set them, but no screen and no API endpoint does so; those states can be reached today only by a direct change to the database. If withdrawing a certificate is a real requirement for QCI, it is currently unbuilt, and is listed in the findings note."
    ),
    H.p(
      "Where QCI needs to stop a certified vendor, the lever the system provides is at the account level rather than the certificate. Deactivating the vendor's user account blocks it from signing in, and deactivating the organisation blocks every account under it; both are enforced at login. This restricts the vendor's access to the portal, but it does not change the certificate, and the public verification page will continue to report the certificate as valid until it expires."
    ),

    // ── 3.12 ───────────────────────────────────────────────
    H.h2("3.12 Notifications"),
    H.p(
      "The system sends email. There is no SMS, push or in-app messaging. Thirty-five templates cover the process, grouped as application, payment, assessment, certificate, committee, security and system messages. Each has a subject held in the database and a body held as a template file, and each is addressed either to a named role or directly to the person concerned."
    ),
    H.p(
      "Every email that is attempted is recorded, whether it succeeded or failed, together with the subject and body actually sent. Appendix E lists the full set."
    ),

    // ── 3.13 ───────────────────────────────────────────────
    H.h2("3.13 Support tickets"),
    H.p(
      "Applicants raise support tickets from the portal. The Support screen is given to the Enterprise Admin and Unit Admin roles, and a ticket can carry up to five attachments. Tickets are held in Zoho Desk rather than in SAMAR; the portal only creates them. It does not list or display existing tickets, so once a ticket is raised the conversation continues in Zoho Desk."
    ),
    H.p(
      "Everything after creation, viewing, replying, adding further attachments and closing, is done by QCI staff in the Zoho Desk agent console, not in the SAMAR portal. Each ticket carries the raiser's organisation, so a QCI agent can see which enterprise it came from and one organisation's tickets stay separate from another's."
    ),
    H.note("The API that receives a ticket does not itself restrict who may create one; the applicant-only rule is applied by the portal, which shows the Support screen to Enterprise Admin and Unit Admin only. Enforcing that rule on the API as well is noted in the accompanying findings for QCI."
    ),

    // ── 3.14 ───────────────────────────────────────────────
    H.h2("3.14 Audit trail"),
    H.p(
      "Changes to the entities that matter are recorded automatically: users, applications, assessments, units, roles, documents, organisations, committee members and committee meetings. Each entry keeps what changed, the values before and after, who did it, the role they held, their address and the request that carried it."
    ),
    H.p(
      "Sign-in activity is recorded alongside: successful sign-ins, failed attempts, account lockouts, password changes and resets, and role assignments. Passwords, tokens and one-time codes are replaced with a redaction marker before anything is stored."
    ),
    H.p(
      "Entries are never edited, only added. They are kept for two years by default and then removed. Where a change is made by a scheduled task rather than a person, it is attributed to a named system actor with the script that made it, so an unattributed change is a genuine anomaly rather than routine background work."
    ),

    // ── 3.15 ───────────────────────────────────────────────
    H.h2("3.15 Reports and dashboards"),
    H.p(
      "Five roles land on a dashboard scoped to what they are responsible for: System Admin, DRDO Admin, Operations Manager, Operations Admin and Enterprise Admin. An Enterprise Admin sees their own applications, payments and certificates. Operations roles see the pipeline: what is waiting for allocation, what is in the field, what is queued for quality check, what is awaiting committee. DRDO Admin sees approvals pending and the certified register. The System Admin sees system-wide counts, master data and the audit log. The other three roles open straight onto a work list instead of a dashboard: an assessor onto their scheduled assessments, a Unit Admin onto their applications, and a DRDO Lab onto the certified vendor register."
    ),
    H.p(
      "Assessment reports and committee minutes are generated as PDFs and attached to the relevant emails."
    ),

    // ── 3.16 ───────────────────────────────────────────────
    H.h2("3.16 What QCI can configure"),
    H.p(
      "A good deal of the system's behaviour is data rather than code, and can be changed in the portal without a software release."
    ),
    H.makeTable(
      ["Setting", "Effect", "Who can change it"],
      [
        ["DRDO approval required", "Whether submitted applications wait for DRDO approval or go straight to payment.", "System Admin"],
        ["Certificate validity", "How long a certificate lasts. Three years by default.", "System Admin"],
        ["Recertification window", "How far before expiry a unit may reapply. Ninety days by default.", "System Admin"],
        ["Application submission open", "Whether new applications may be submitted at all.", "System Admin"],
        ["Maintenance mode", "Blocks applicant access while work is carried out. Staff roles are unaffected.", "System Admin"],
        ["Fee configuration", "Base fee, food and accommodation, GST rate and TDS switch, per sector and size.", "System Admin"],
        ["Assessment questionnaire", "Disciplines, parameters, questions, answer options and their weightings.", "System Admin"],
        ["Reference lists", "Vendor categories, stores, raw materials, bought-out parts, key processes, service resources, vendor labs, assessor domains, third-party certifications.", "System Admin"],
        ["Feedback questions", "The questions applicants are asked about the assessment experience.", "System Admin"],
      ],
      [2200, 5246, 2300]
    ),
  ];
};
