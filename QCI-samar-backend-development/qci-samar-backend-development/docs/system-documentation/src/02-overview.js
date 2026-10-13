const H = require(require("os").homedir() + "/.claude/skills/webority/scripts/helpers.js");
const path = require("path");
const DIAG = path.join(__dirname, "..", "diagrams");

module.exports = function overview() {
  return [
    H.h1("2. System overview"),

    H.h2("2.1 What SAMAR does"),
    H.p(
      "A vendor that wants to supply the defence and aerospace sector needs a credible, independent statement of how well it is run. SAMAR provides that. A vendor registers, describes the site it wants assessed, pays the certification fee, and is then visited by a QCI-appointed assessment team. The team scores the site against a published questionnaire. A rating committee reviews the result and, if satisfied, certifies the site at a rating level from 1 to 5."
    ),
    H.p(
      "The portal exists because that process has a lot of moving parts and several parties who each see a different slice of it. The applicant needs to submit and track. DRDO needs to approve who enters the scheme and to consult the register afterwards. QCI operations staff need to allocate assessors, run quality checks and convene committees. Assessors need to work on a factory floor where there is often no mobile signal. All of it has to be auditable, because a certificate carries weight."
    ),
    H.p(
      "Certification is granted to a unit, not to a company. An enterprise with four factories runs four assessments and holds four certificates. A certificate is valid for three years by default, and the system opens a recertification window before it expires."
    ),

    H.h2("2.2 The four applications"),
    H.p(
      "The system is one service with three front ends. Everything the front ends do goes through a single API, which owns the rules, the data and the connections to outside systems. Nothing writes to the database except the API."
    ),
    H.makeTable(
      ["Application", "Who uses it", "What it is for"],
      [
        ["SAMAR API", "No direct users", "Holds all business rules, workflow, scoring and data. Talks to the payment gateway, ERP, support desk and email service."],
        ["Web portal", "All eight staff and applicant roles", "The main working surface. Applications, approvals, allocation, quality check, committee meetings, certificates, master data and reporting."],
        ["Assessor mobile app", "Assessors", "Used on site to run the assessment. Works fully offline and synchronises when a connection returns."],
        ["Applicant mobile app", "Applicant staff", "Lets an applicant view their applications and supply site photographs."],
      ],
      [2000, 2400, 5346]
    ),
    H.image(path.join(DIAG, "01-system-context.png"), { widthPct: 78 }),
    H.caption("Figure 1: System context"),

    H.h2("2.3 Who uses the system"),
    H.p(
      "There are nine roles. Eight are held by people; the ninth is a machine account used by the ERP connection and is never signed into by a human. Section 4 sets out what each role can do."
    ),
    H.makeTable(
      ["Role", "Belongs to", "In one line"],
      [
        ["System Admin", "QCI", "Owns master data, the questionnaire, fee configuration and user administration across the whole system."],
        ["DRDO Admin", "DRDO", "Approves or rejects applications entering the scheme, and verifies organisations."],
        ["DRDO Lab", "DRDO", "Reads the certified vendor register. No write access anywhere."],
        ["Operations Manager", "QCI", "Allocates assessment teams and performs the quality check on completed assessments."],
        ["Operations Admin", "QCI", "Processes applications day to day, runs rating committee meetings and records committee decisions."],
        ["Assessor", "QCI panel", "Conducts assessments. Sees only the assessments they are assigned to."],
        ["Enterprise Admin", "Applicant", "The applicant's main account. Creates units, submits applications, pays, and manages its own users."],
        ["Unit Admin", "Applicant", "Works on applications for the specific units assigned to them."],
        ["ERP Integration", "Machine", "Used by Business Central to return invoice and receipt files. One endpoint, no interface."],
      ],
      [2100, 1500, 6146]
    ),
    H.p("Which role works in which application:"),
    H.makeTable(
      ["Role", "Web portal", "Assessor app", "Applicant app"],
      [
        ["System Admin", "Yes", "No", "No"],
        ["DRDO Admin", "Yes", "No", "No"],
        ["DRDO Lab", "Yes", "No", "No"],
        ["Operations Manager", "Yes", "No", "No"],
        ["Operations Admin", "Yes", "No", "No"],
        ["Assessor", "Yes", "Yes", "No"],
        ["Enterprise Admin", "Yes", "No", "Yes"],
        ["Unit Admin", "Yes", "No", "Yes"],
        ["ERP Integration", "No", "No", "No"],
      ],
      [3446, 2100, 2100, 2100]
    ),
    H.note("The ERP Integration role has no interface. It is used only by Business Central to return invoice and receipt files to the system."),

    H.h2("2.4 The certification journey end to end"),
    H.p(
      "The stages below are what an applicant experiences. Each is expanded in section 3."
    ),
    H.makeTable(
      ["Stage", "What happens", "Who acts"],
      [
        ["1. Register", "The vendor registers, confirms a one-time password sent by email, and receives a SAMAR ID and password.", "Applicant"],
        ["2. Set up the enterprise", "Company details, statutory documents and one or more units are recorded.", "Enterprise Admin"],
        ["3. Build the application", "A five-step form captures the unit, its products or services, processes, suppliers and declarations.", "Enterprise Admin or Unit Admin"],
        ["4. Submit", "The application is locked for editing and sent onward.", "Enterprise Admin or Unit Admin"],
        ["5. DRDO approval", "Where the scheme requires it, DRDO approves or rejects the application. Rejection is final.", "DRDO Admin"],
        ["6. Pay", "The system calculates the fee, the applicant pays through the gateway, and the ERP raises an invoice and receipt.", "Enterprise Admin or Unit Admin"],
        ["7. Allocate", "An assessment is created automatically on payment. A lead assessor, any co-assessors and the dates are set.", "Operations Manager"],
        ["8. Assess", "The team works through the site: parameter allocation, photographs, opening meeting, site tour, data capture, scoring and closing meeting.", "Assessors"],
        ["9. Quality check", "The completed assessment is reviewed. It is either approved or sent back with per-question comments.", "Operations Manager"],
        ["10. Rating committee", "The assessment is put before a committee, which may adjust scores, send it back, or certify.", "Operations Admin and committee"],
        ["11. Certify", "A certificate is generated with a rating level, a validity period and a publicly verifiable number.", "System"],
        ["12. Renew", "Before expiry the recertification window opens and the unit may apply again.", "Applicant"],
      ],
      [1500, 6246, 2000]
    ),

    H.h2("2.5 Two sectors, one process"),
    H.p(
      "An application is either manufacturing or service. Both follow the same lifecycle, the same fee model, the same quality check and the same committee. They differ in what is captured and what is asked."
    ),
    H.makeTable(
      ["", "Manufacturing", "Service"],
      [
        ["What is described", "Products, raw materials, bought-out parts, key processes, stores and production capacity.", "Services offered, key resources, outsourced components and key processes."],
        ["Extra classification", "None beyond vendor category.", "A service provider type: annual maintenance contract, critical service provider, or civil works contractor."],
        ["Questionnaire", "Selected by sector, enterprise size and vendor category.", "Selected by the same three, plus service provider type."],
        ["Assessment mode", "On-site visit.", "Conducted remotely, and a meeting link is mandatory when the assessment is scheduled."],
        ["Certificate scope", "Recorded as Manufacturing.", "Recorded as Service."],
      ],
      [1900, 3923, 3923]
    ),
  ];
};
