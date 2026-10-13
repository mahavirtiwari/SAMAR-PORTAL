/**
 * Assessment lifecycle statuses. Mirrors the backend Assessment::STATUS_*
 * constants. Use these instead of raw strings so renames stay in one place.
 */
export const ASSESSMENT_STATUS = Object.freeze({
  ALLOCATION_PENDING: 'allocation_pending',
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  MOBILE_COMPLETE: 'mobile_complete',
  SUBMITTED_FOR_QC: 'submitted_for_qc',
  QC_FEEDBACK: 'qc_feedback',
  READY_FOR_COMMITTEE: 'ready_for_committee',
  COMMITTEE_REVIEW: 'committee_review',
  COMMITTEE_FEEDBACK: 'committee_feedback',
  CERTIFIED: 'certified',
});

// The scheduled assessment is conducted differently by sector: service-sector
// applications are assessed remotely, manufacturing on-site. Keep the label in
// one place so the two ScheduleAssessment flows never drift apart.
export const getAssessmentTypeLabel = sector => (sector === 'service' ? 'Remote Assessment' : 'Onsite Assessment');

// Renewal applications hide the Assessment section (Basic Info / Site Tour / Evidences)
// while the assessment sits in these pre-execution / review statuses. It reappears once
// the assessment is being executed on-site (in_progress / mobile_complete) or is certified.
export const RENEWAL_HIDDEN_ASSESSMENT_STATUSES = Object.freeze([
  ASSESSMENT_STATUS.ALLOCATION_PENDING,
  ASSESSMENT_STATUS.SCHEDULED,
  ASSESSMENT_STATUS.SUBMITTED_FOR_QC,
  ASSESSMENT_STATUS.QC_FEEDBACK,
  ASSESSMENT_STATUS.READY_FOR_COMMITTEE,
  ASSESSMENT_STATUS.COMMITTEE_REVIEW,
  ASSESSMENT_STATUS.COMMITTEE_FEEDBACK,
]);
