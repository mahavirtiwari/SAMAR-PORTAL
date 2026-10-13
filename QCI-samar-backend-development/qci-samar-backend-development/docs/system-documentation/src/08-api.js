const H = require(require("os").homedir() + "/.claude/skills/webority/scripts/helpers.js");

module.exports = function api() {
  return [
    H.h1("8. The API"),

    H.h2("8.1 Conventions"),
    H.p(
      "Everything the portal and the mobile applications do goes through one versioned REST interface. It is worth understanding its conventions, because they are applied uniformly and explain the shape of every response."
    ),
    H.makeTable(
      ["Convention", "Detail"],
      [
        ["Versioning", "All endpoints sit under a version prefix, so a future revision can run alongside the current one."],
        ["Format", "JSON in and out. A version header is returned on every response."],
        ["Naming", "Clients send and receive camelCase. The API converts to and from its internal naming automatically."],
        ["Authentication", "A bearer token on every protected call. Access tokens and refresh tokens are not interchangeable and are rejected if presented in the wrong place."],
        ["Envelope", "Responses carry a success flag, a message and a data payload."],
        ["Errors", "A failure returns the flag as false, a message, and where relevant a map of field names to the problems found."],
        ["Paging", "List endpoints take a page number and a page size, capped to protect the service, plus search and filter terms."],
        ["Dates", "Machine-readable timestamps are returned in a consistent format; user-facing times are rendered in IST."],
      ],
      [2200, 7546]
    ),

    H.h2("8.2 Authentication endpoints"),
    H.makeTable(
      ["Purpose", "Notes"],
      [
        ["Register", "Creates the organisation and first user, and sends a verification code."],
        ["Verify code", "Confirms registration, generates the password and emails the credentials."],
        ["Resend code", "Issues a fresh verification code."],
        ["Sign in", "Returns tokens, or a pending session when two-factor is enabled."],
        ["Verify sign-in code", "Completes a two-factor sign-in and returns tokens."],
        ["Resend sign-in code", "Limited to three per attempt."],
        ["Check active session", "Reports whether the account is already signed in on another device of the same class. Requires the password, so it cannot be used anonymously."],
        ["Refresh", "Exchanges a refresh token for a new pair. Single use."],
        ["Sign out", "Ends all sessions for the user and withdraws the token."],
        ["Current user", "Returns the signed-in user with their roles."],
        ["Change password", "Requires the current password."],
        ["Forgot and reset password", "Code-based reset. Completing it ends every session."],
        ["Two-factor status, enable, disable", "Disabling requires the current password."],
      ],
      [3000, 6746]
    ),

    H.h2("8.3 Endpoints by module"),
    H.p(
      "The interface exposes roughly 294 endpoints. Grouped by what they serve:"
    ),
    H.makeTable(
      ["Module", "What it covers"],
      [
        ["Organisations and units", "Organisation profile, verification, status, and unit management."],
        ["Users", "Account creation, update, status changes and role assignment, scoped by the caller's own role."],
        ["Applications", "Draft creation for both sectors, update, submission, DRDO approval and rejection, renewal, listing by lifecycle stage, and the detail view."],
        ["Fees and payments", "Fee quotation, payment initiation, payment history, invoices and receipts, and the two gateway callbacks."],
        ["Assessments", "Allocation and scheduling, starting, step progress, parameter allocation, responses and evidence, meetings, attendance, site pictures, site tour, submission, quality check, and committee actions."],
        ["Committee", "Meetings, members, participants, assessment attachment, decisions, scores and minutes."],
        ["Certificates", "Listing, detail, download, and public verification."],
        ["Master data", "The questionnaire, disciplines, parameters, questions and options, fee configuration, vendor categories, stores, raw materials, bought-out parts, key processes, service resources, vendor labs, assessor domains, third-party certifications, countries, states, districts and pin codes."],
        ["Support", "Raising and listing tickets and viewing one."],
        ["System", "Health, status, settings, audit and activity logs, error logs, and user guides."],
        ["ERP", "A single endpoint used by Business Central to return invoice and receipt files."],
      ],
      [2200, 7546]
    ),
    H.note("Appendix A groups the endpoints by module with their methods. The live specification is generated from the code and is the authoritative reference for exact request and response shapes."),

    H.h2("8.4 Public endpoints"),
    H.p(
      "Four things are reachable without signing in, and it is worth being explicit about them:"
    ),
    H.makeTable(
      ["Endpoint", "Why it is public", "What it exposes"],
      [
        ["Certificate verification", "QR codes on certificates must work for anyone.", "Certificate number, organisation, unit, address, rating level, status, validity and scope. Not the score, not the assessment, not the file."],
        ["System status", "Lets the clients detect maintenance mode before signing in.", "Service status only."],
        ["Health", "Service monitoring.", "Service and database availability."],
        ["Payment callbacks", "The bank must be able to reach them.", "Nothing. They accept signed notifications and are signature-checked."],
      ],
      [2200, 3200, 4346]
    ),

    H.h2("8.5 Error handling"),
    H.p(
      "Validation failures return the offending fields and the reason for each, which is what lets the portal put an error next to the right box rather than showing a general message. Authorisation failures distinguish between not being signed in and not being permitted. Session failures carry a specific code so the client can explain that the user was signed out by another sign-in rather than showing a generic error."
    ),
    H.p(
      "Server errors are recorded internally with the context needed to diagnose them, grouped so that a recurring fault is visible as one problem rather than a thousand entries."
    ),
  ];
};
