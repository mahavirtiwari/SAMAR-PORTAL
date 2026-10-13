const H = require(require("os").homedir() + "/.claude/skills/webority/scripts/helpers.js");
const path = require("path");
const DIAG = path.join(__dirname, "..", "diagrams");

module.exports = function integrations() {
  return [
    H.h1("9. External integrations"),
    H.p("SAMAR connects to four external systems."),
    H.makeTable(
      ["System", "Purpose", "Direction"],
      [
        ["ICICI EazyPay", "Collects the certification fee.", "Out to pay, back to confirm"],
        ["Microsoft Dynamics 365 Business Central", "Raises invoices and receipts against settled payments.", "Both ways"],
        ["Zoho Desk", "Holds support tickets.", "Out on demand"],
        ["Email service", "Delivers all system email.", "Out"],
      ],
      [3000, 4746, 2000]
    ),

    // ── 9.1 ────────────────────────────────────────────────
    H.h2("9.1 ICICI EazyPay"),
    H.p(
      "The certification fee is collected through ICICI EazyPay. When an applicant chooses to pay, the system assembles the payment request, encrypts it, and sends the applicant to the bank's hosted page. SAMAR never handles card or account details; they are entered on the bank's page."
    ),
    H.h3("What is sent"),
    H.p(
      "The request carries a fixed set of seventeen mandatory fields: the payment reference, the merchant identifiers, the amount, the applicant's contact details, their PAN, TAN and GST registration, the unit address, district, pin code, state and country, a description of what is being paid for, the contact person and the payment date."
    ),
    H.p(
      "Each of those fields is cleaned before it is sent. Line breaks and separator characters are removed and lengths are trimmed, because the gateway rejects the whole request if a field contains an embedded newline. In practice that mattered: applicants paste multi-line addresses."
    ),
    H.p(
      "The assembled request is encrypted with the merchant key and passed as an encrypted link. The plain request, the applicant's mobile number and the encrypted link are deliberately kept out of the logs."
    ),
    H.h3("How confirmation comes back"),
    H.p(
      "Confirmation arrives by two independent routes, and either is sufficient."
    ),
    H.makeTable(
      ["Route", "How it arrives", "What it does"],
      [
        ["Return", "The applicant's browser is redirected back carrying a signed result.", "Verifies the signature, records the outcome, and sends the applicant to the confirmation page. Sends the confirmation email."],
        ["Server notification", "The bank posts an encrypted message directly to the system.", "Decrypts, verifies, and records the outcome if it has not already been recorded."],
      ],
      [1800, 3400, 4546]
    ),
    H.p(
      "Both are signature-checked before anything is recorded. A successful result is only accepted with a valid signature. A failed or cancelled result is accepted without one, since there is nothing to protect. If a signature does not verify on a payment already recorded as successful, the payment is not downgraded; the discrepancy is recorded for investigation instead, because the money has already moved."
    ),
    H.p(
      "Where the amount the bank reports collecting differs from the amount billed, the payment is still accepted and the difference is flagged for manual attention. Refusing it would leave an applicant who has genuinely paid unable to proceed."
    ),

    // ── 9.2 ────────────────────────────────────────────────
    H.h2("9.2 Business Central"),
    H.p(
      "Invoicing is done in Microsoft Dynamics 365 Business Central rather than in SAMAR. When a payment settles, SAMAR asks Business Central to raise the invoice and the receipt. Business Central generates the documents and returns the files, which SAMAR stores against the payment and makes available to the applicant in the portal."
    ),
    H.image(path.join(DIAG, "05-erp-sequence.png"), { widthPct: 84 }),
    H.caption("Figure 8: Invoice and receipt exchange"),
    H.p(
      "The connection authenticates as an application against Microsoft's identity service, so there is no user password involved. Requests carry the portal identity, the board, the location and the ledger codes that Business Central needs to file the entry correctly; those values are configuration rather than code."
    ),
    H.p(
      "Two scheduled tasks keep the two systems aligned. One reads back document results hourly. The other retries pushes that failed, every half hour, so a temporary outage at either end resolves itself rather than needing manual repair."
    ),
    H.p(
      "Documents come back the other way through a dedicated machine account, the ERP Integration role, which has exactly one endpoint available to it and no interface. That account is the single exception to the one-session rule, because Business Central makes batched calls that would otherwise displace one another."
    ),
    H.p(
      "An ERP failure never rolls back a settled payment. The two are deliberately decoupled: if invoicing fails, the payment stands and the invoice is retried."
    ),

    // ── 9.3 ────────────────────────────────────────────────
    H.h2("9.3 Zoho Desk"),
    H.p(
      "Support tickets live in Zoho Desk. SAMAR holds no ticket records of its own; the portal is a one-way window that only creates them. Raising a ticket creates or reuses a contact in Zoho, creates the ticket, and uploads any attachments."
    ),
    H.p(
      "Alongside the subject and description, each ticket carries the raiser's role, the issue category, type and sub-category, and their organisation. The organisation is taken from the signed-in account rather than from the form, which is what allows a QCI agent to see which enterprise a ticket came from and what keeps one enterprise's tickets away from another's."
    ),
    H.p(
      "In the portal the Support screen is given to the Enterprise Admin and Unit Admin roles, and a ticket can carry up to five attachments. The portal does not list or display existing tickets. Everything after creation, viewing, replying, adding attachments and closing, happens in the Zoho Desk agent console. The API that receives a ticket does not itself restrict who may create one; the applicant-only rule is a portal convention, noted for QCI in the accompanying findings."
    ),

    // ── 9.4 ────────────────────────────────────────────────
    H.h2("9.4 Email"),
    H.p(
      "All system email is delivered through an external mail service over an authenticated connection. Email is the only notification channel; there is no SMS or push messaging, and one-time codes are therefore delivered by email."
    ),
    H.p(
      "Delivery is attempted as part of the request that triggers it. Where an email fails, the failure is recorded and the underlying action still completes: a registration is not lost because a message could not be sent, and a password reset still works even if the confirmation does not arrive."
    ),

    // ── 9.5 ────────────────────────────────────────────────
    H.h2("9.5 Configuration"),
    H.p(
      "Each integration is switched on or off independently and holds its own credentials. Turning one off degrades that capability without stopping the rest of the system: with the support desk unavailable, ticket raising reports itself as unavailable rather than failing obscurely."
    ),
    H.makeTable(
      ["Integration", "What has to be configured"],
      [
        ["ICICI EazyPay", "Merchant and sub-merchant identifiers, encryption key, the gateway addresses, and the return and notification addresses."],
        ["Business Central", "Tenant, application credentials, environment and company, plus the board, portal name, location and ledger codes, and the machine account used for the return path."],
        ["Zoho Desk", "Organisation and department identifiers, application credentials, and the regional endpoint."],
        ["Email", "Mail host, port, credentials, encryption, and the from name and address."],
      ],
      [2200, 7546]
    ),
  ];
};
