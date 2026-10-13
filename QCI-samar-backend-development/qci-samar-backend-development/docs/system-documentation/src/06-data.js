const H = require(require("os").homedir() + "/.claude/skills/webority/scripts/helpers.js");
const path = require("path");
const DIAG = path.join(__dirname, "..", "diagrams");

module.exports = function data() {
  return [
    H.h1("6. Data architecture"),

    H.h2("6.1 The core entities"),
    H.p(
      "An organisation holds units and employs users. A unit applies for certification. An application is assessed once, may be paid for more than once if earlier attempts failed, and results in a certificate. The assessment carries the parameters and questions copied for it, and the answers given against them."
    ),
    H.image(path.join(DIAG, "07-data-model.png"), { widthPct: 52 }),
    H.caption("Figure 7: Core entity relationships"),
    H.makeTable(
      ["Entity", "What it holds"],
      [
        ["Organisation", "The applicant company: name, statutory registrations, verification and profile status."],
        ["Unit", "A site belonging to an organisation, with its address, district, state and pin code. Certification is per unit."],
        ["User", "An account, identified by SAMAR ID, belonging to an organisation where applicable."],
        ["Role", "One of the nine roles. Assigned to a user through a link that may be scoped to an organisation and unit, switched off, or given an expiry."],
        ["Application", "The certification request: sector, enterprise size, vendor category, the declared operational detail, and its position in the lifecycle."],
        ["Assessment", "The assessment of one application: the team, the dates, the step progress, the score and its position in the lifecycle."],
        ["Assessment parameter", "A parameter copied into an assessment, with the team member it is allocated to."],
        ["Assessment question", "A question copied into an assessment, with its weighting and its five answer options flattened onto the record."],
        ["Response", "The answer to one question: the option chosen, its score, any committee override, and the weighted result."],
        ["Payment", "A payment attempt, its gateway references, its status and the frozen fee breakdown."],
        ["Certificate", "An issued certificate: number, type, scope, score, rating level, validity and status."],
        ["Committee meeting", "A rating committee sitting, its chair, convenor, members and the assessments put before it."],
        ["Audit entry", "One recorded change or security event."],
      ],
      [2600, 7146]
    ),

    H.h2("6.2 The questionnaire"),
    H.p(
      "The questionnaire has four levels. A discipline is a subject area. A parameter is a group of questions within it, and is the unit both of allocation to an assessor and of scoring. A question sits under a parameter and carries a weighting. Each question offers five answer options, each worth a score."
    ),
    H.makeTable(
      ["Level", "Holds", "Example"],
      [
        ["Discipline", "A subject area, tied to one sector.", "Quality Management System"],
        ["Parameter", "A group of questions. Allocated to one assessor and scored as a unit.", "Document Control"],
        ["Question", "A question with a weighting expressed as a percentage of its parameter.", "Are all quality documents properly controlled and versioned?"],
        ["Option", "One of five answers, each carrying a score from 1 to 5.", "Yes, fully implemented with documented evidence"],
      ],
      [1700, 4400, 3646]
    ),
    H.p(
      "Which parameters apply to a given assessment is decided by the sector, the enterprise size, the vendor category and, for service applications, the service provider type. A manufacturing application is matched on the first three; a service application on all four."
    ),
    H.p(
      "The weightings of the active questions within a parameter must total exactly one hundred per cent. If they do not, the system takes the parameter out of use automatically rather than letting it distort a score. That rule is what keeps every parameter's score on the same one-to-five scale."
    ),
    H.p("The six disciplines currently loaded:"),
    H.makeTable(
      ["Sector", "Discipline", "Parameters"],
      [
        ["Manufacturing", "Quality Management System", "Document Control, Process Management, Internal Audit"],
        ["Manufacturing", "Production Management", "Production Planning, Equipment Maintenance"],
        ["Manufacturing", "Safety and Environment", "Workplace Safety, Environmental Compliance"],
        ["Service", "Service Quality Management", "Service Standards, Customer Satisfaction, Quality Monitoring and Improvement"],
        ["Service", "Service Delivery", "Service Operations, Service Level Agreements"],
        ["Service", "Service Safety and Compliance", "Workforce Safety and Training, Regulatory and Contractual Compliance"],
      ],
      [1900, 3000, 4846]
    ),
    H.note("A parameter exists once per applicable combination, so the fourteen parameter names above are held as 140 records across the size bands and service provider types."),

    H.h2("6.3 How an assessment is scored"),
    H.p("Scoring runs in three steps."),
    H.h3("Step one, per question"),
    H.p(
      "The option the assessor chose carries a score from 1 to 5. If the rating committee has overridden that question, the committee's score is used instead. The result is multiplied by the question's weighting to give a weighted score."
    ),
    H.h3("Step two, per parameter"),
    H.p(
      "The weighted scores of the answered questions in a parameter are added together. Because the weightings within a parameter total one hundred per cent, the result sits on the same one-to-five scale as the individual answers."
    ),
    H.h3("Step three, the assessment"),
    H.p(
      "The parameter scores are averaged. Every parameter counts equally; parameters are not themselves weighted. The result, to two decimal places, is the assessment's final score."
    ),
    H.p("The final score maps to a rating level:"),
    H.makeTable(
      ["Final score", "Rating level"],
      [
        ["Above 4.5", "Level 5"],
        ["Above 3.5 and up to 4.5", "Level 4"],
        ["Above 2.5 and up to 3.5", "Level 3"],
        ["Above 1.5 and up to 2.5", "Level 2"],
        ["Up to 1.5", "Level 1"],
      ],
      [4400, 5346]
    ),
    H.p(
      "The rating level is what appears on the certificate and on public verification. The numeric score is held internally and is not disclosed publicly."
    ),
    H.p(
      "There is no not-applicable answer. A parameter that does not apply is simply not allocated to anyone, and then plays no part in the score. Once a parameter is allocated, every question in it must be answered before the assessment can be submitted."
    ),
    H.p(
      "Where the committee overrides scores, the system keeps both figures: the effective total including the overrides, and the assessor's original total. Both appear in the minutes, so the committee's effect on the outcome is visible. If an assessor later revises an answer, any committee override on that question is cleared, so a stale override cannot mask a new answer."
    ),

    H.h2("6.4 Keeping organisations apart"),
    H.p(
      "Applicant data is separated by organisation, and within an organisation by unit. That separation is applied by the checks described in section 4.1 rather than by a blanket database filter, which means it is enforced deliberately at each point rather than assumed."
    ),
    H.p(
      "Records also carry the organisation they belong to automatically when created, taken from the account creating them, so a record cannot be filed against the wrong organisation by accident."
    ),

    H.h2("6.5 Retention and deletion"),
    H.makeTable(
      ["Data", "Retention"],
      [
        ["Applications, assessments, certificates, payments", "Kept indefinitely. Deletions are marks rather than removals, so history and audit remain intact."],
        ["Audit entries", "Two years by default, then removed."],
        ["Error records", "Archived after ninety days, removed after a year."],
        ["Email records", "Kept with the subject and body actually sent."],
        ["Expired login sessions", "Cleared automatically."],
        ["Evidence photographs and documents", "Held against the assessment for as long as the assessment is held."],
      ],
      [3200, 6546]
    ),
    H.p(
      "Certificates are never deleted. A superseded certificate is marked renewed and linked to the one that replaced it, so the chain from a unit's first certificate to its current one can be followed."
    ),
  ];
};
