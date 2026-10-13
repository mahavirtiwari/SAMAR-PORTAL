const H = require(require("os").homedir() + "/.claude/skills/webority/scripts/helpers.js");

module.exports = function appendices() {
  return [
    H.h1("Appendix A: API endpoints by module"),
    H.p(
      "Grouped by module, with the operations each supports. The generated specification remains the authoritative reference for exact request and response shapes."
    ),
    H.makeTable(
      ["Module", "Operations"],
      [
        ["Authentication", "Register, verify code, resend code, sign in, verify sign-in code, resend sign-in code, check active session, refresh, sign out, current user, change password, forgot password, reset password, resend reset code, two-factor status, enable and disable."],
        ["Organisations", "List, view, create, update, verify, change status, profile completeness."],
        ["Units", "List, view, change spoke, list unit users. Units are created and their address updated through the application flow, not a standalone unit endpoint."],
        ["Users", "List, view, create, update, change status, assign roles, list by role."],
        ["Applications", "List, list by lifecycle stage, view, create manufacturing draft, create service draft, update, delete, submit, DRDO approve, DRDO reject, renew, fee quote, progress, feedback."],
        ["Payments", "Fee quote, initiate, list, view, invoices, receipts, gateway return callback, gateway server notification."],
        ["Assessments", "List, view, schedule and reschedule, start, step progress, parameter list, my assignments, bulk assign parameters, responses, response evidence, punch in, punch out, opening meeting, closing meeting, meeting comments, meeting participants, attendance, site pictures, site tour pictures, basic information, co-assessor submit, submit for quality check, quality check decision, address quality check feedback, committee decision, committee scores, address committee feedback, report download."],
        ["Committee", "Meetings list, view, create, update, cancel, complete, members list and management, participants, attach and detach assessments, decisions, minutes."],
        ["Certificates", "List, view, download, public verification."],
        ["Questionnaire", "Disciplines, parameters, parameter detail, questions, question options, each with list, view, create, update and status change (activate/deactivate). There is no delete."],
        ["Fee configuration", "List, view, create, update."],
        ["Manufacturing reference data", "Vendor categories, stores, raw materials, bought-out parts, key processes."],
        ["Service reference data", "Vendor categories, vendor labs, key resources, outsourced components, key processes."],
        ["Common reference data", "Assessor domains, third-party certifications, feedback questions, countries, states, districts, pin codes."],
        ["Support", "List tickets, raise ticket, view ticket, update ticket."],
        ["System", "Health, status, settings list and update, audit logs, activity logs, error logs, error groups, user guides."],
        ["ERP", "Document upload."],
      ],
      [2400, 7346]
    ),

    H.h1("Appendix B: Core entities"),
    H.p("The principal entities and the fields that carry meaning outside the software."),
    H.makeTable(
      ["Entity", "Key fields"],
      [
        ["Organisation", "Name, PAN, GST registration, incorporation certificate, verification status, profile completion, status."],
        ["Unit", "Organisation, name, address, district, state, pin code, contact person, status."],
        ["User", "SAMAR ID, first and last name, email, mobile, organisation, status, last sign-in, two-factor flag, password changed date."],
        ["Role assignment", "User, role, organisation, unit, active flag, assigned date, expiry."],
        ["Application", "Application number, organisation, unit, sector, enterprise size, vendor category, service provider type, declared operational detail, status, submitted date, DRDO approval date and remarks, rejection reason, payment status, certificate expiry."],
        ["Assessment", "Application, status, lead assessor, scheduled start and end, meeting link, reschedule counter, step progress, started and completed dates, total score, quality check reviewer and date."],
        ["Assessment team member", "Assessment, user, lead or co-assessor, field work completion, web submission."],
        ["Assessment parameter", "Assessment, discipline name, code, name, mandatory flag, allocated team member."],
        ["Assessment question", "Assessment, parameter, code, text, category, weighting, five option texts and scores, review status and type."],
        ["Response", "Assessment, question, option chosen, assessor score, committee score, weighted score."],
        ["Payment", "Payment reference, application, amount, net amount, status, gateway references, fee breakdown, verification and reconciliation flags, failure reason."],
        ["Certificate", "Number, application, organisation, unit, type, scheme, scope, final score, grade, issue date, valid from, valid until, validity months, status, public and verification flags, PDF path, renewal links, reminders sent."],
        ["Committee meeting", "Title, date, chair, convenor, members, attached assessments, decisions, minutes, status."],
        ["Audit entry", "Entity type and identifier, event, custom event, actor, actor name and roles, values before and after, changed fields, address, user agent, request method and address, description."],
      ],
      [2200, 7546]
    ),

    H.h1("Appendix C: Role capability matrix"),
    H.p(
      "This matrix describes what each role can do through the web portal. Yes means the role may perform the action. Own means it is limited to the user's own organisation, unit or assessment. A blank cell means the portal does not offer the action to that role. Where the API permits a role something the portal does not surface, it is noted rather than shown as a capability."
    ),
    H.h2("Applications and certificates"),
    H.makeTable(
      ["Action", "Sys Admin", "DRDO Admin", "DRDO Lab", "Ops Mgr", "Ops Admin", "Assessor", "Ent Admin", "Unit Admin"],
      [
        ["List applications", "Yes", "Yes", "", "Yes", "Yes", "", "Yes", "Yes"],
        ["View application", "Yes", "Yes", "", "Yes", "Yes", "", "Own", "Own"],
        ["Create application", "", "", "", "", "", "", "Yes", "Yes"],
        ["Update application", "", "", "", "", "", "", "Own", "Own"],
        ["Delete application", "", "", "", "", "", "", "Own", ""],
        ["Submit application", "", "", "", "", "", "", "Own", "Own"],
        ["Renew application", "", "", "", "", "", "", "Own", ""],
        ["Approve or reject", "", "Yes", "", "", "", "", "", ""],
        ["List certificates", "Yes", "Yes", "", "Yes", "Yes", "", "Yes", "Yes"],
        ["View certificate", "Yes", "Yes", "", "Yes", "Yes", "", "Own", "Own"],
        ["Download certificate", "Yes", "Yes", "", "Yes", "Yes", "", "Own", "Own"],
      ],
      [2246, 1000, 1100, 950, 900, 1000, 900, 900, 750]
    ),
    H.h2("Assessments"),
    H.makeTable(
      ["Action", "Sys Admin", "DRDO Admin", "DRDO Lab", "Ops Mgr", "Ops Admin", "Assessor"],
      [
        ["List assessments", "", "Yes", "", "Yes", "Yes", "Own team"],
        ["View assessment", "", "Yes", "Certified only", "Yes", "Yes", "Own team"],
        ["Allocate team", "", "", "", "Yes", "", ""],
        ["Conduct", "", "", "", "", "", "Own team"],
        ["Submit for quality check", "", "", "", "", "", "Own team"],
        ["Quality check review", "", "", "", "Yes", "", ""],
        ["Quality check approve", "", "", "", "Yes", "", ""],
        ["Schedule committee", "", "", "", "", "Yes", ""],
        ["Record committee decision", "", "", "", "", "Yes", ""],
      ],
      [2646, 1200, 1300, 1500, 1100, 1000, 1000]
    ),
    H.note("System Admin has no assessment screens in the portal, so it does not appear above; the API would return assessment data to it, but there is no screen. Operations Admin can also change organisation status through the API, but the portal offers that screen to System Admin only."),
    H.h2("Organisations, units and users"),
    H.makeTable(
      ["Action", "Sys Admin", "DRDO Admin", "Ops Mgr", "Ops Admin", "Ent Admin", "Unit Admin"],
      [
        ["View organisations", "Yes", "Yes", "Yes", "Yes", "Own", "Own"],
        ["Create organisation", "Yes", "", "", "", "", ""],
        ["Update organisation", "Yes", "", "", "", "Own", ""],
        ["Verify organisation", "Yes", "Yes", "", "", "", ""],
        ["Change organisation status", "Yes", "", "", "", "", ""],
        ["Create a unit (from an application address)", "", "", "", "", "Yes", ""],
        ["Assign or change a unit's Unit Admin", "", "", "", "", "Yes", ""],
        ["List users", "Yes", "", "Yes", "Yes", "Yes", ""],
        ["Create user", "Yes", "", "Yes", "Yes", "Yes", ""],
        ["Update user", "Yes", "", "Assessors", "Assessors", "Own org", "Self"],
        ["Change user status", "Yes", "", "Assessors", "Assessors", "Own org", ""],
      ],
      [2846, 1200, 1300, 1200, 1200, 1100, 900]
    ),
    H.h2("Master data and system"),
    H.makeTable(
      ["Action", "System Admin", "All signed-in users"],
      [
        ["View questionnaire and reference lists", "Yes", "Yes"],
        ["Create or update questionnaire, parameters, disciplines", "Yes", ""],
        ["Activate or deactivate questionnaire items (no delete)", "Yes", ""],
        ["Create, edit, activate or deactivate every other reference list (no delete)", "Yes", ""],
        ["Fee configuration", "Yes", ""],
        ["Feedback questions", "Yes", ""],
        ["System settings", "Yes", ""],
        ["Audit and activity logs", "Yes", ""],
        ["Error logs", "Yes", ""],
      ],
      [6746, 1500, 1500]
    ),
    H.note("In the portal, all configuration and master-data editing is a System Admin screen. The API additionally permits DRDO Admin to edit the questionnaire and Operations Admin to edit fee configuration and feedback questions, but neither role is given a screen for it."),

    H.h2("Support tickets"),
    H.makeTable(
      ["Action", "Who can do it in the portal"],
      [
        ["Raise a ticket", "Enterprise Admin, Unit Admin"],
        ["List or view tickets", "Nobody. The portal does not display tickets; they are handled in Zoho Desk."],
        ["Reply, add attachments later, close", "Nobody in the portal. QCI staff do this in the Zoho Desk agent console."],
      ],
      [3000, 6746]
    ),
    H.note("The API accepts a new ticket from any signed-in account and does not itself limit creation to applicants; the applicant-only rule is applied by the portal. The findings note for QCI recommends enforcing it on the API too."),

    H.h1("Appendix D: Screens"),
    H.h2("Web portal"),
    H.makeTable(
      ["Area", "Screens"],
      [
        ["Public", "Sign in, register, forgot password, reset link sent, set new password, maintenance, public certificate verification."],
        ["Account", "Change password, edit profile."],
        ["Applications", "All applications, drafts, active, in progress, payment pending, DRDO approval pending, pending approval, application detail, manufacturing five-step wizard, service five-step wizard, draft continuation."],
        ["Assessment workflow", "One list and one detail screen for each stage: allocation pending, scheduled, in progress, quality check, quality check feedback, ready for committee review, committee review scheduled, committee review feedback, certified, rejected. Most stages also carry a parameter detail screen."],
        ["Rating committee", "Meetings, meeting detail, review assessment parameter, view assessment parameter, members."],
        ["Payments", "Payment history, make payment, payment callback, payment successful."],
        ["Certificates", "Certified vendors, certified vendor detail, certificates and reports, verify certificate."],
        ["Enterprise", "Enterprise details, organisation profile, manage units, add unit, edit unit, unit users, support, rating feedback."],
        ["Assessors", "Assessor list, assessor detail, set unavailability."],
        ["User administration", "DRDO admins, DRDO labs, operations admins, operations managers, assessors, enterprises, enterprise detail."],
        ["Master data", "Manufacturing vendor categories, stores, raw materials, bought-out parts, key processes; service vendor categories, vendor labs, key resources, outsourced components, key processes; assessor domains, third-party certificates."],
        ["Assessment configuration", "Manufacturing and service disciplines, parameters, parameter detail and fee configuration."],
        ["System", "Feedback configuration, system settings, user guides, audit logs."],
        ["Dashboards", "Five: System Admin, DRDO Admin, Operations Manager, Operations Admin, Enterprise Admin. Assessor, Unit Admin and DRDO Lab open onto a work list instead."],
      ],
      [2400, 7346]
    ),
    H.h2("Assessor mobile application"),
    H.makeTable(
      ["Area", "Screens"],
      [
        ["Access", "Sign in with one-time code, maintenance."],
        ["Home", "Assessment list with calendar."],
        ["Assessment", "Step list, varying by sector and by whether the user is lead or co-assessor."],
        ["Parameter allocation", "Allocate parameters, select parameters, assigned parameters."],
        ["Assessment work", "Parameter list, parameter detail with answers and evidence."],
        ["Site information", "Basic information and its sub-forms for customers, products, raw materials, bought-out parts and key resources."],
        ["Meetings", "Opening meeting, closing meeting, all comments."],
        ["Evidence", "Site pictures, site tour."],
        ["Profile", "Profile, change password, support, guide book, about."],
      ],
      [2400, 7346]
    ),
    H.h2("Applicant mobile application"),
    H.makeTable(
      ["Area", "Screens"],
      [
        ["Access", "Sign in with one-time code."],
        ["Applications", "Application list, application detail."],
        ["Evidence", "Site pictures, site tour."],
        ["Profile", "Profile, support."],
      ],
      [2400, 7346]
    ),

    H.h1("Appendix E: Email templates"),
    H.p("Thirty-five templates, grouped by what they concern."),
    H.makeTable(
      ["Category", "Template", "Sent to"],
      [
        ["Security", "Registration one-time code", "The registrant"],
        ["Security", "Registration successful, with credentials", "The registrant"],
        ["Security", "Sign-in one-time code", "The account holder"],
        ["Security", "Password reset code", "The account holder"],
        ["Security", "Password changed confirmation", "The account holder"],
        ["Application", "Application received", "Enterprise Admin, Unit Admin"],
        ["Application", "DRDO approved", "Enterprise Admin, Unit Admin"],
        ["Application", "Application rejected", "Enterprise Admin, Unit Admin"],
        ["Application", "Contact person authorised", "Unit Admin"],
        ["Application", "Spoke changed", "Unit Admin"],
        ["Payment", "Payment confirmation", "Enterprise Admin, Unit Admin"],
        ["Assessment", "Assessment scheduled", "Enterprise Admin, Unit Admin"],
        ["Assessment", "Assessor assigned", "Assessor"],
        ["Assessment", "Co-assessor assigned", "Assessor"],
        ["Assessment", "Quality check review required", "Operations Manager"],
        ["Assessment", "Quality check clarification sought", "Assessor"],
        ["Assessment", "Quality check clarification submitted", "Operations Manager"],
        ["Assessment", "Committee clarification sought", "Assessor"],
        ["Assessment", "Assessor clarification submitted", "Operations Admin"],
        ["Assessment", "Feedback request on the assessment", "Enterprise Admin, Unit Admin"],
        ["Certificate", "Certificate and report issued", "Enterprise Admin, Unit Admin"],
        ["Certificate", "Certificate expiring", "Enterprise Admin"],
        ["Certificate", "Recertification window open", "Enterprise Admin, Unit Admin"],
        ["Committee", "Committee member onboarded", "Committee member"],
        ["Committee", "Meeting scheduled", "Participants"],
        ["Committee", "Meeting updated", "Participants"],
        ["Committee", "Meeting cancelled", "Participants"],
        ["Committee", "Meeting closed, minutes for approval", "Participants"],
        ["System", "User created", "The new user"],
        ["System", "User invitation", "The invited user"],
        ["System", "Assessor invitation", "Assessor"],
        ["System", "DRDO admin invitation", "DRDO Admin"],
        ["System", "DRDO lab invitation", "DRDO Lab"],
        ["System", "Operations admin invitation", "Operations Admin"],
        ["System", "Operations manager invitation", "Operations Manager"],
      ],
      [1700, 5046, 3000]
    ),

    H.h1("Appendix F: Reference data"),
    H.p(
      "Lists maintained in the portal and drawn on when an application is built or an assessment is configured."
    ),
    H.makeTable(
      ["List", "Used for", "Maintained by"],
      [
        ["Manufacturing vendor categories", "Classifying a manufacturing applicant. Five categories covering fabrication, manufacturing and distribution, production, and development and production agencies.", "System Admin"],
        ["Service vendor categories", "Classifying a service applicant. Twenty-four categories, eight for each of the three service provider types.", "System Admin"],
        ["Manufacturing stores", "Declaring the stores a manufacturing unit operates.", "System Admin"],
        ["Raw materials", "Declaring key raw materials.", "System Admin"],
        ["Bought-out parts", "Declaring bought-out parts.", "System Admin"],
        ["Manufacturing key processes", "Declaring key manufacturing processes.", "System Admin"],
        ["Service key processes", "Declaring key service processes.", "System Admin"],
        ["Service key resources", "Declaring the resources a service provider relies on.", "System Admin"],
        ["Service outsourced components", "Declaring outsourced service components.", "System Admin"],
        ["Service vendor labs", "Declaring DRDO vendor labs for service applicants.", "System Admin"],
        ["DRDO vendor stores", "Declaring DRDO vendor stores for manufacturing applicants.", "System Admin"],
        ["Assessor domains", "Recording the domains an assessor is competent in.", "System Admin"],
        ["Third-party certifications", "Declaring certifications the applicant already holds.", "System Admin"],
        ["Feedback questions", "The questions applicants answer about the assessment experience.", "System Admin"],
        ["Countries, states, districts, pin codes", "Address capture, and matching assessors to the states they are approved for.", "System Admin"],
      ],
      [2600, 5146, 2000]
    ),

    H.h1("Appendix G: State reference"),
    H.h2("Application states"),
    H.makeTable(
      ["State", "Reached from", "Leads to"],
      [
        ["Draft", "Created by the applicant", "DRDO approval pending, or payment pending"],
        ["DRDO approval pending", "Draft", "Payment pending, or rejected"],
        ["Payment pending", "Draft, or DRDO approval pending", "Payment completed"],
        ["Payment completed", "Payment pending", "In progress"],
        ["In progress", "Payment completed", "Certified"],
        ["Certified", "In progress", "Final"],
        ["Rejected", "DRDO approval pending", "Final"],
      ],
      [2600, 3600, 3546]
    ),
    H.h2("Assessment states"),
    H.makeTable(
      ["State", "Reached from", "Leads to"],
      [
        ["Allocation pending", "Created on payment", "Scheduled"],
        ["Scheduled", "Allocation pending", "In progress"],
        ["In progress", "Scheduled", "Field work complete"],
        ["Field work complete", "In progress", "Quality check"],
        ["Quality check", "Field work complete, or committee feedback", "Ready for committee, or quality check feedback"],
        ["Quality check feedback", "Quality check", "Ready for committee"],
        ["Ready for committee", "Quality check, or quality check feedback", "Committee review"],
        ["Committee review", "Ready for committee", "Certified, committee feedback, or back to ready for committee"],
        ["Committee feedback", "Committee review", "Quality check"],
        ["Certified", "Committee review", "Final"],
      ],
      [2600, 3600, 3546]
    ),
    H.h2("Payment states"),
    H.makeTable(
      ["State", "Meaning"],
      [
        ["Initiated", "Record created."],
        ["Pending", "Sent to the gateway, awaiting the outcome."],
        ["Processing", "Instrument clearing, for payment methods that clear rather than settle immediately."],
        ["Success", "Confirmed and signature-verified."],
        ["Failed", "Declined, cancelled or abandoned. The applicant may retry."],
      ],
      [2600, 7146]
    ),
    H.h2("Certificate states"),
    H.makeTable(
      ["State", "Meaning"],
      [
        ["Active", "Issued and within its validity period. The state every certificate starts in."],
        ["Expired", "Past its valid-until date."],
        ["Renewed", "Superseded by a later certificate, and linked to it."],
        ["Suspended", "Temporarily withdrawn. Defined in the data model but not reachable through the application (see 3.11)."],
        ["Revoked", "Permanently withdrawn. Defined in the data model but not reachable through the application (see 3.11)."],
      ],
      [2600, 7146]
    ),
    H.note("Active, expired and renewed are set by the application in normal operation. Suspended and revoked are valid values the schema allows, but no screen or API endpoint sets them today."),
  ];
};
