const H = require(require("os").homedir() + "/.claude/skills/webority/scripts/helpers.js");

module.exports = function glossary() {
  return [
    H.h1("10. Glossary"),
    H.p(
      "Terms as they are used in this document and in the system. Section 1.5 carries the acronyms."
    ),
    H.makeTable(
      ["Term", "Meaning"],
      [
        ["Allocation", "Naming the assessors who will conduct an assessment and setting its dates. Done by an Operations Manager."],
        ["Assessment", "The evaluation of one application against the questionnaire. One application has exactly one assessment."],
        ["Certificate number", "The identifier printed on a certificate and used for public verification. Formed from the issue date and part of the issuing user's SAMAR ID."],
        ["Committee member", "A person seated on a rating committee. Recorded against meetings, not a user account."],
        ["Discipline", "The top level of the questionnaire, grouping related parameters within one sector."],
        ["Draft", "An application still being prepared. The only state in which it can be edited or deleted."],
        ["Enterprise size", "One of five bands - startup, micro, small, medium or large - which together with the sector selects the fee rate card."],
        ["Evidence", "A photograph attached to an answer, to a site tour, or to the record of a site."],
        ["Field work", "The part of an assessment carried out on site in the assessor application, between punching in and punching out."],
        ["Lead assessor", "The assessor accountable for an assessment. Allocates parameters, runs the meetings and submits for quality check."],
        ["Option", "One of the five answers offered for a question, each carrying a score from 1 to 5."],
        ["Parameter", "A group of questions covering one subject. The unit of allocation to an assessor and the unit of scoring."],
        ["Parameter allocation", "Dividing an assessment's parameters among the team. Locks once saved."],
        ["Punch in and punch out", "The start and end of an assessor's on-site work, evidenced with a photograph and a location."],
        ["Quality check", "Review of a submitted assessment by an Operations Manager before it goes to committee."],
        ["Rating committee", "The panel that reviews a completed assessment and decides whether to certify it."],
        ["Rating level", "The published outcome, from Level 1 to Level 5, derived from the final score."],
        ["Rate card", "The fee configuration for one combination of sector and enterprise size."],
        ["Recertification window", "The period before a certificate expires during which the unit may apply again. Ninety days by default."],
        ["Reschedule counter", "A number incremented when an assessment's dates change, telling assessor devices to discard and re-download."],
        ["Response", "An assessor's answer to one question, together with its score and any committee override."],
        ["SAMAR ID", "The identifier every user signs in with, in the form SAMAR-DDMMYY-N."],
        ["Sector", "Whether an application is assessed as manufacturing or as a service."],
        ["Send-back", "Returning an assessment to the lead assessor with comments, from quality check or from committee. Committee send-backs are limited to two."],
        ["Service provider type", "For service applications only: annual maintenance contract, critical service provider, or civil works contractor."],
        ["Site tour", "The walk through the site during an assessment, recorded as titled photographs."],
        ["Unit", "A single site belonging to an enterprise. Certification is granted per unit."],
        ["Vendor category", "The classification of what the applicant supplies. Contributes to selecting the questionnaire."],
        ["Weighting", "A question's share of its parameter's score, as a percentage. The active questions in a parameter always total one hundred."],
      ],
      [2400, 7346]
    ),
  ];
};
