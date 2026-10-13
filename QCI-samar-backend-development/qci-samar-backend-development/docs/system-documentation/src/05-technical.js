const H = require(require("os").homedir() + "/.claude/skills/webority/scripts/helpers.js");
const path = require("path");
const DIAG = path.join(__dirname, "..", "diagrams");

module.exports = function technical() {
  return [
    H.h1("5. Technical architecture"),

    H.h2("5.1 Shape of the system"),
    H.p(
      "One service holds the rules and the data. Three clients call it. Nothing else touches the database, and no business rule lives in a client, so the web portal and the two mobile applications cannot disagree about what is allowed."
    ),
    H.p(
      "The API is organised in layers. A request arrives at a route, passes through a chain of checks, reaches a controller, and is handed to a service that does the actual work. Data access is through a model layer. Workflow rules are held in state machines rather than scattered through controllers, which is why the transition tables in section 3 can be stated so precisely: they are configuration, not prose."
    ),
    H.makeTable(
      ["Layer", "Responsibility"],
      [
        ["Routing", "Maps each URL to a controller and declares which roles may reach it."],
        ["Middleware", "Authentication, token type, session validity, maintenance mode, request and response formatting, file safety, rate limiting and security headers."],
        ["Controllers", "Validate the request, check the caller may act on this particular record, and delegate."],
        ["Services", "The business logic: authentication, fee calculation, payment gateway, ERP, email, state machines, PDF generation."],
        ["Policies", "Decide whether a given user may perform a given action on a given record."],
        ["Models", "Data access, relationships, derived values and per-record rules."],
        ["Database", "Storage, referential integrity and indexing."],
      ],
      [2000, 7746]
    ),

    H.h2("5.2 The API"),
    H.p(
      "The API is built on Laravel 12 running PHP 8.4, with MySQL 8 behind it. It exposes roughly 294 endpoints under a single version prefix. Sixty-one controllers, thirty-three services, twenty-five policies and sixty-seven models make up the codebase, over a schema of 117 migrations."
    ),
    H.p("Two design choices are worth drawing out because they shape everything else."),
    H.h3("State machines"),
    H.p(
      "Application and assessment workflow are each defined as a state machine: a list of states, the moves permitted between them, who may make each move, and what must be true first. A move that is not in the table cannot happen, whatever screen it is attempted from. Each move writes a history entry and may fire follow-on work, such as creating the assessment when payment completes, or creating the certificate when an assessment is certified."
    ),
    H.h3("Immutable questionnaire snapshots"),
    H.p(
      "When an assessment is created, the applicable parameters, questions and answer options are copied into the assessment rather than referenced. Editing the master questionnaire afterwards has no effect on assessments already under way. Without this, changing a question's weighting would silently rewrite the score of every historic assessment, and a certificate could no longer be defended."
    ),

    H.h2("5.3 The web portal"),
    H.p(
      "The portal is a React 19 single-page application built with Vite. It holds no business rules; it renders what the API allows and calls the API for everything."
    ),
    H.makeTable(
      ["Concern", "Approach"],
      [
        ["Structure", "Screens per role, shared components, and a service layer wrapping every API call."],
        ["State", "Redux Toolkit, with slices organised per role and per domain."],
        ["Routing", "Over 100 routes. Each route maps a role to the screen that role should see."],
        ["Navigation", "A fixed menu per role."],
        ["Forms", "Formik with schema validation, and server-side validation errors mapped back onto the offending fields."],
        ["Session", "Tokens held in browser session storage, encrypted. Closing the browser ends the session."],
        ["Inactivity", "The user is warned at fifty-nine minutes idle and signed out at sixty."],
        ["Version awareness", "The application checks its own build against the server and reloads if the user is running a stale copy."],
      ],
      [2000, 7746]
    ),

    H.h2("5.4 The assessor mobile application"),
    H.p(
      "This is the most demanding part of the system. Assessors work inside factories where there is frequently no signal, for hours at a time, capturing photographs and answers that must not be lost. The application is therefore built to work with no connection at all, and to treat connectivity as an occasional bonus rather than a precondition."
    ),
    H.p("It is a React Native application. Four mechanisms make the offline behaviour dependable."),

    H.h3("Everything needed is downloaded first"),
    H.p(
      "Before the visit the application pulls the whole assessment down into a local database: the parameters, the questions, the answer options, any answers already given, and the reference lists the forms need. A co-assessor who has never opened the assessment online can still complete it offline."
    ),

    H.h3("Reads are served locally during the assessment"),
    H.p(
      "Between punching in and punching out, the assessment's own working data, the responses, the evidence, the meetings and the site photographs, is read only from the local database, with no server call attempted. That removes the class of failure where a weak signal produces a slow request, a timeout and a confusing error in the middle of an assessment. Two reads are deliberately left online because they are shared across the team rather than owned by one device: the parameter allocation, which the lead authors, and the team-wide comment view. Both fetch when there is a connection and are otherwise served from what was last downloaded."
    ),

    H.h3("Writes go to a queue"),
    H.p(
      "Every action, from a punch-in to an answer to a photograph, is written to a local queue first and confirmed to the assessor immediately. A background process drains that queue to the server whenever there is a connection, in the order the actions were taken."
    ),
    H.image(path.join(DIAG, "06-offline-sync.png"), { widthPct: 86 }),
    H.caption("Figure 6: How offline work reaches the server"),
    H.p(
      "Each queued item carries a client-generated identifier, so if a confirmation is lost and the item is sent twice, the server recognises the duplicate rather than recording the work twice. Failures are separated into those worth retrying, such as a dropped connection, and those that are not, such as a rejected value; only the second kind is abandoned, and it is surfaced to the assessor."
    ),

    H.h3("Punch-out waits for everything else"),
    H.p(
      "The punch-out is deliberately held back until every earlier item for that assessment has reached the server. This makes the record trustworthy: if the server shows an assessor punched out, all the field data up to that point is present. Without the rule, a punch-out could arrive over a brief signal while the photographs behind it were still queued."
    ),

    H.h3("Rescheduling"),
    H.p(
      "A reschedule is meant to happen before on-site work begins, and when it does the server's version is authoritative. The reschedule carries a version marker; when the device sees a newer one it discards the assessment it holds and downloads the server's copy afresh. Anything captured locally for that assessment and not yet synced is lost in the process. There is one narrow safety valve: the automatic discard is skipped while unsynced items are still queued, so those rows are not silently deleted before a sync is attempted. It is not a guarantee that the work survives. If an assessment is rescheduled after work has started, the server is treated as final and the device's changes give way to it on the next sync."
    ),

    H.h3("Photographs"),
    H.p(
      "A photograph is written to durable storage the moment it is taken, and only then stamped with location and time. The two steps are separate because waiting for a location fix before saving risked losing the image if the operating system reclaimed the camera's temporary file."
    ),

    H.h2("5.5 The applicant mobile application"),
    H.p(
      "The applicant application is much smaller. It lets an applicant sign in, see their applications, and supply site photographs and site-tour images for a scheduled assessment. It uses the same account model, the same token handling and the same queue-then-send approach for the photographs it captures, but it has no assessment execution, no scoring and no meeting handling. Its offline behaviour covers the four photograph operations and nothing more, because that is all it does."
    ),

    H.h2("5.6 Patterns used across the system"),
    H.makeTable(
      ["Pattern", "Where it is used", "Why"],
      [
        ["State machine", "Application and assessment workflow", "Keeps the permitted moves in one place, with history written automatically."],
        ["Policies", "Every record-level access decision", "Separates the question of whether a user may act on a record from the handling of the request."],
        ["Snapshotting", "Questionnaire copied per assessment, fee breakdown stored per payment", "Protects completed work from later configuration changes."],
        ["Adapter", "Payment gateway", "The gateway sits behind a common interface, so a second gateway would not disturb the callers."],
        ["Outbox queue", "Both mobile applications", "Lets a client accept work with no connection and reconcile later."],
        ["Case conversion", "Every request and response", "The API speaks camelCase to clients and snake_case internally, converted automatically."],
        ["Soft deletion", "Most records", "Records are marked deleted rather than removed, so history stays intact."],
      ],
      [1800, 3400, 4546]
    ),

    H.h2("5.7 Technology"),
    H.makeTable(
      ["Component", "Technology", "Version"],
      [
        ["API framework", "Laravel", "12"],
        ["Language", "PHP", "8.4"],
        ["Database", "MySQL", "8"],
        ["Authentication", "JSON Web Tokens", "-"],
        ["Web portal", "React with Vite", "19 and 7"],
        ["Portal state", "Redux Toolkit", "2"],
        ["Portal interface", "Material UI 7, and React Bootstrap 2 on Bootstrap 5.3", "-"],
        ["Mobile", "React Native", "0.85"],
        ["Mobile storage", "SQLite, with the device keychain for credentials", "-"],
        ["PDF generation", "wkhtmltopdf, with a second engine for simple documents", "-"],
        ["Spreadsheets", "PhpSpreadsheet", "5"],
        ["Images", "Intervention Image", "3"],
        ["API documentation", "OpenAPI", "3.1"],
      ],
      [2800, 5546, 1400]
    ),
  ];
};
