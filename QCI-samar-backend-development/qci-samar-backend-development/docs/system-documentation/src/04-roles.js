const H = require(require("os").homedir() + "/.claude/skills/webority/scripts/helpers.js");
const { step } = require("./_step.js");

module.exports = function roles() {
  return [
    H.h1("4. Roles and access"),

    H.h2("4.1 How access is decided"),
    H.p(
      "Access is decided by role. There is no separate permission list to maintain: what a role can do is defined in the software, and a user gets it by holding that role. A role assignment can be scoped to an organisation and to a unit, can be switched off without being deleted, and can carry an expiry date."
    ),
    H.p("Three checks run on every request that changes something:"),
    ...step([
      "The endpoint itself is restricted to particular roles. A user without one of them is refused outright.",
      "The specific record is then checked. This is where ownership matters: whether the application belongs to your organisation, whether the unit is one of yours, whether you are on the assessment team, and whether the record is in a state that permits the action.",
      "A few areas apply their own additional checks, notably support tickets, which combine the requester's identity with their organisation.",
    ]),
    H.p(
      "The second check is the one that matters most. Being an Enterprise Admin does not let you see another enterprise's applications; being an assessor does not let you see an assessment you are not on."
    ),
    H.p(
      "The tables in this section describe what each role can do through the web portal, because that is how the roles are used in practice. The API behind the portal enforces its own role rules, and in a few places it will accept a request from a role that the portal gives no screen to. Those cases are noted where they matter; they do not change what a user can do by using the product."
    ),

    H.h2("4.2 The nine roles"),
    H.makeTable(
      ["Role", "Scope", "What it is for"],
      [
        ["System Admin", "Whole system", "Master data, the questionnaire, fee configuration, users across all organisations, and the audit trail."],
        ["DRDO Admin", "Whole system", "Approves or rejects submitted applications, and monitors the assessment pipeline read-only."],
        ["DRDO Lab", "Whole system, read only", "Consults the certified vendor register. Can open a certified vendor's assessment detail."],
        ["Operations Manager", "Whole system", "The only role that can allocate an assessment team. Performs quality check, and manages assessor accounts."],
        ["Operations Admin", "Whole system", "Processes applications, and owns the rating committee: schedules meetings, manages members, and records committee decisions."],
        ["Assessor", "Own assessments", "Conducts assessments. Sees only assessments they are a team member of."],
        ["Enterprise Admin", "Own organisation", "Creates and submits applications, pays, renews, assigns each unit's Unit Admin, and manages users in their organisation. Units come into being from the application address."],
        ["Unit Admin", "Assigned units", "Creates and updates applications for their units. Cannot delete or renew, and cannot create units."],
        ["ERP Integration", "One endpoint", "Machine account. Used by Business Central to return invoice and receipt files."],
      ],
      [2100, 1900, 5746]
    ),
    H.note("Committee members are people recorded against rating committee meetings. They are not a role and do not have accounts."),

    H.h2("4.3 What each role can do in the portal"),
    H.p(
      "The tables below summarise what each role can do through the web portal; Appendix C carries the full matrix. Own means the action is allowed but limited to the user's own organisation, unit or assessment."
    ),

    H.h3("Applications"),
    H.makeTable(
      ["Action", "Who can do it"],
      [
        ["View the list", "System Admin, DRDO Admin, Operations Manager, Operations Admin, Enterprise Admin, Unit Admin"],
        ["Create", "Enterprise Admin, Unit Admin"],
        ["Update", "Enterprise Admin (own), Unit Admin (own unit). Only while in draft, DRDO approval pending or payment pending."],
        ["Delete", "Enterprise Admin (own). Only while in draft."],
        ["Submit", "Enterprise Admin (own), Unit Admin (own unit). Only from draft."],
        ["Renew", "Enterprise Admin (own). Only once certified."],
        ["Approve or reject", "DRDO Admin only"],
      ],
      [2400, 7346]
    ),

    H.h3("Assessments"),
    H.makeTable(
      ["Action", "Who can do it"],
      [
        ["View the list", "DRDO Admin, Operations Manager, Operations Admin, Assessor"],
        ["View one", "As above (DRDO Admin read-only, Assessor only if on the team), plus DRDO Lab for a certified vendor's assessment"],
        ["Allocate a team", "Operations Manager only"],
        ["Conduct and submit", "Assessor, only for assessments they are on"],
        ["Quality check and approve", "Operations Manager only"],
        ["Schedule a committee meeting", "Operations Admin only"],
        ["Record the committee decision", "Operations Admin only"],
      ],
      [2900, 6846]
    ),

    H.h3("Certificates"),
    H.makeTable(
      ["Action", "Who can do it"],
      [
        ["View and download", "System Admin, DRDO Admin, Operations Manager, Operations Admin. Enterprise Admin and Unit Admin for their own."],
        ["Verify publicly", "Anyone, without signing in"],
        ["Issue", "Nobody directly. Issued automatically on certification."],
      ],
      [2400, 7346]
    ),

    H.h3("Master data and configuration"),
    H.makeTable(
      ["Action", "Who can do it"],
      [
        ["View reference lists and the questionnaire", "Every signed-in user"],
        ["Create or edit the questionnaire, parameters and disciplines", "System Admin"],
        ["Activate or deactivate questionnaire items", "System Admin"],
        ["Create, edit, and activate or deactivate every other reference list", "System Admin"],
        ["Fee configuration", "System Admin"],
        ["Feedback questions", "System Admin"],
        ["System settings", "System Admin"],
        ["Audit and activity logs", "System Admin"],
      ],
      [4200, 5546]
    ),
    H.note("Reference data is deliberately readable by every signed-in user, because applicants need to pick from those lists when building an application. Only changing it is restricted. Reference and questionnaire items are never deleted, only deactivated, so that historic applications and assessments keep resolving the values they were built with; there is no delete action and no delete endpoint for this data. In the portal, all configuration and master-data editing is a System Admin screen; the API additionally permits DRDO Admin to edit the questionnaire and Operations Admin to edit fee configuration and feedback questions, but the portal gives neither role a screen for it."),

    H.h2("4.4 Where each role starts"),
    H.makeTable(
      ["Role", "Landing screen"],
      [
        ["System Admin", "System dashboard"],
        ["DRDO Admin", "DRDO dashboard"],
        ["DRDO Lab", "Certified vendors"],
        ["Operations Manager", "Operations dashboard"],
        ["Operations Admin", "Operations dashboard"],
        ["Assessor", "Scheduled assessments"],
        ["Enterprise Admin", "Enterprise dashboard"],
        ["Unit Admin", "My applications"],
      ],
      [3400, 6346]
    ),
    H.p(
      "The menu each role sees is fixed to that role. A user holding more than one role is treated as holding the first one recorded against them, so overlapping roles are not combined."
    ),
  ];
};
