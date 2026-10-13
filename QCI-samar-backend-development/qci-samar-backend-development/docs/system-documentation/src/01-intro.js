const H = require(require("os").homedir() + "/.claude/skills/webority/scripts/helpers.js");
const { CONTENT_W } = H;

module.exports = function intro() {
  return [
    H.h1("1. Introduction"),

    H.h2("1.1 Purpose"),
    H.p(
      "This document describes the SAMAR Certification Portal as it is built. It records what the system does, how it is put together, how the certification workflow runs from a vendor's first registration through to an issued certificate, and how it connects to the payment gateway, the ERP and the support desk."
    ),
    H.p(
      "It is written so that a reader who has never seen the source code can understand the system's behaviour, and so that a technically fluent reader can follow its architecture and data model without opening a repository. Where a rule is enforced by the software rather than by policy, this document says so, because those are the rules that cannot be varied without a change request."
    ),

    H.h2("1.2 Scope"),
    H.p("The document covers:"),
    H.bullet("The business context of the SAMAR scheme and the four applications that deliver it."),
    H.bullet("Every functional module, including the application and assessment lifecycles, fee calculation, on-site assessment execution, quality check, rating committee, and certificate issuance."),
    H.bullet("The nine user roles and what each can do."),
    H.bullet("Technical architecture of the API, the web portal and both mobile applications, including the offline design used by assessors in the field."),
    H.bullet("The data model and the assessment scoring method."),
    H.bullet("Authentication, authorisation and the wider security design."),
    H.bullet("The API surface and its conventions."),
    H.bullet("The four external systems SAMAR integrates with."),

    H.h2("1.3 Out of scope"),
    H.p(
      "Hosting, server infrastructure, environments, deployment procedure, release pipelines and day-to-day operations are not covered here. Those remain with Webority Technologies under the ongoing engagement and are documented separately. This document describes what the software is and does, not where it runs."
    ),
    H.p(
      "Commercial terms, project plans and support arrangements are likewise out of scope."
    ),

    H.h2("1.4 Intended audience"),
    H.p(
      "Two readers are assumed. A QCI project owner who needs to understand what the system does, who uses it and how the certification process is enforced will find that in sections 2 to 4. A technical reviewer who needs architecture, data design, security posture and integration behaviour will find that in sections 5 to 9. Each section opens in plain language before going into detail, so the first reader can stop where the second one starts."
    ),

    H.h2("1.5 Definitions and acronyms"),
    H.makeTable(
      ["Term", "Meaning"],
      [
        ["SAMAR", "The certification scheme this system administers. Vendors supplying the defence and aerospace sector are assessed against a published questionnaire and awarded a rating level."],
        ["QCI", "Quality Council of India, the body that owns and runs the SAMAR scheme."],
        ["DRDO", "Defence Research and Development Organisation. Approves applications and consumes the certified vendor register."],
        ["Applicant", "The vendor organisation seeking certification."],
        ["Enterprise", "An applicant organisation as recorded in the system. One enterprise may hold several units."],
        ["Unit", "A single site or facility belonging to an enterprise. Certification is granted per unit, not per enterprise."],
        ["Assessor", "A qualified individual who conducts the on-site or remote assessment."],
        ["Lead assessor", "The assessor accountable for an assessment. Allocates parameters, runs the meetings and submits the assessment."],
        ["Co-assessor", "A further assessor on the team, responsible for the parameters allocated to them."],
        ["Rating committee", "The panel that reviews a completed assessment and decides whether to certify."],
        ["Parameter", "A group of assessment questions covering one subject. The unit of allocation to an assessor and the unit of scoring."],
        ["Discipline", "The top level of the questionnaire. Groups related parameters."],
        ["SAMAR ID", "The identifier every user signs in with. Email addresses are not login credentials."],
        ["Sector", "Whether an application is assessed as manufacturing or as a service. The two follow the same lifecycle with different questionnaires."],
        ["API", "Application Programming Interface. The service the web portal and mobile applications call to do everything."],
        ["JWT", "JSON Web Token. The signed credential a client presents on each request after signing in."],
        ["OTP", "One-time password. A six-digit code sent by email to confirm identity."],
        ["ERP", "Enterprise Resource Planning. Here, Microsoft Dynamics 365 Business Central, which raises invoices and receipts."],
        ["GST", "Goods and Services Tax, applied to the certification fee."],
        ["TDS", "Tax Deducted at Source, which an applicant may elect where the fee configuration permits it."],
      ],
      [2400, 7346]
    ),

    H.h2("1.6 A note on precision"),
    H.p(
      "Every behaviour described here was verified against the running source code rather than taken from earlier design notes. Where an older internal document described something that the software does differently, this document follows the software. Numbers such as fee rates, validity periods and attempt limits are the values the system actually applies; several are configurable by a System Admin, and those are identified where they appear."
    ),
  ];
};
