const H = require(require("os").homedir() + "/.claude/skills/webority/scripts/helpers.js");

module.exports = function security() {
  return [
    H.h1("7. Security"),

    H.h2("7.1 Signing in"),
    H.p(
      "Users sign in with a SAMAR ID and password, not an email address. The identifier is case-insensitive. A wrong password returns the same message whether or not the account exists, so the sign-in page cannot be used to discover which accounts are real."
    ),
    H.p(
      "Where two-factor authentication is switched on for an account, the password check is followed by a six-digit code sent by email. No token is issued until the code is confirmed. The pending sign-in is valid for fifteen minutes, deliberately longer than the code itself so a user can request a fresh code without starting again. A code may be resent up to three times."
    ),
    H.p("Password and code rules:"),
    H.makeTable(
      ["Control", "Setting"],
      [
        ["Minimum password length", "Seven characters"],
        ["Password storage", "Hashed. Passwords are never stored or transmitted in readable form after issue."],
        ["One-time code length", "Six digits, stored hashed"],
        ["Code validity", "Two minutes"],
        ["Code attempts", "Five, then a thirty-minute lock"],
        ["Failed sign-in attempts", "Ten, then a thirty-minute lock on the account"],
        ["Code resends", "Three per sign-in attempt"],
      ],
      [3400, 6346]
    ),
    H.note("Password length is the only complexity rule applied. Composition rules are not enforced."),

    H.h2("7.2 Sessions and tokens"),
    H.p(
      "After a successful sign-in the client receives two credentials: a short-lived access token used on every request, and a longer-lived refresh token used only to obtain a new access token."
    ),
    H.makeTable(
      ["Property", "Setting"],
      [
        ["Access token lifetime", "Fifteen minutes"],
        ["Refresh token lifetime", "Two hours"],
        ["Signing", "HMAC SHA-256"],
        ["Withdrawal", "Tokens can be blacklisted, with no grace period"],
        ["Refresh behaviour", "One use only. Refreshing retires the token presented and issues a new pair."],
        ["Idle timeout", "Sixty minutes"],
        ["Liveness window", "Thirty minutes"],
      ],
      [3400, 6346]
    ),
    H.p(
      "Refresh tokens are single-use. Presenting one retires it immediately and issues a fresh pair, so a captured refresh token cannot be replayed after the legitimate client has used it."
    ),
    H.p(
      "Every session is recorded with the device type, device name, address and last activity. A request bearing a token whose session has been ended is refused with a message explaining why, so a user displaced by another sign-in is told what happened rather than seeing an unexplained error."
    ),

    H.h3("One session at a time"),
    H.p(
      "All eight human roles are limited to one active session, but the limit is applied per class of device rather than globally. A browser session and a mobile application session can be live at the same time; a second browser sign-in ends the first. This is deliberate: an assessor needs the mobile application signed in while also using the portal."
    ),
    H.p(
      "The ERP Integration account is the single exception and may hold concurrent sessions, because the ERP makes batched calls that would otherwise displace one another."
    ),

    H.h3("Idle handling"),
    H.p(
      "Web sessions are ended after sixty minutes without activity. Mobile sessions are deliberately exempt from that check, because an assessor working offline inside a factory legitimately makes no server calls for hours while queuing work locally. Ending their session for inactivity would lose the assessment. A scheduled sweep closes genuinely abandoned sessions every fifteen minutes, and the ERP account is excluded from that too."
    ),

    H.h2("7.3 Resetting a password"),
    H.p(
      "There is no emailed reset link. A user asks for a reset against their SAMAR ID, receives a six-digit code by email, and sets a new password with it. Completing a reset ends every session that user holds, on every device, which is the correct behaviour if the reset was prompted by a suspected compromise."
    ),
    H.p(
      "Changing a password while signed in does not end other sessions, since the user is already proven."
    ),

    H.h2("7.4 Protecting data in transit"),
    H.p(
      "All traffic is over HTTPS. The assessor mobile application additionally pins the certificate authority it will accept, so a device that has been fitted with an intercepting certificate cannot silently read or alter assessment traffic. That is a meaningful control for an application carrying defence-sector assessment evidence over networks the operator does not control."
    ),
    H.p(
      "Responses carry a standard set of security headers covering transport security, content type handling, framing, referrer policy and content security."
    ),

    H.h2("7.5 Protecting data at rest"),
    H.makeTable(
      ["Data", "Protection"],
      [
        ["Passwords", "Hashed, never reversible."],
        ["One-time codes", "Hashed before storage."],
        ["Web session tokens", "Encrypted in browser session storage, cleared when the browser closes."],
        ["Mobile session tokens", "Held in the device keychain, protected by the operating system."],
        ["Evidence photographs", "Stored privately and served only to callers entitled to them."],
        ["Certificate files", "Stored privately. Downloading one requires an authenticated, entitled caller."],
        ["Audit entries", "Passwords, tokens and codes redacted before the entry is written."],
      ],
      [2600, 7146]
    ),

    H.h2("7.6 Limiting abuse"),
    H.p(
      "Sign-in, registration, password reset and token refresh are rate limited. Account lockout applies on top, so a distributed attempt is slowed by the rate limit while a focused attempt on one account is stopped by the lockout."
    ),
    H.p(
      "Uploads are constrained by type and size, and are checked before being stored. Support ticket attachments are limited to five files of ten megabytes each, in a fixed set of document and image formats."
    ),

    H.h2("7.7 Traceability"),
    H.p(
      "The audit trail described in section 3.14 is the security record as well as the operational one. Sign-ins, failed attempts, lockouts, password changes and resets, and role assignments are all recorded with the actor, the address and the time. Entries are added and never edited."
    ),
    H.p(
      "Because certification decisions carry weight, the trail is designed so that a specific question can be answered afterwards: who moved this application, when, holding what role, and what did the record look like before and after."
    ),
  ];
};
