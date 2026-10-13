import { AppAvatarTooltip } from '../base';
import { FILTER_KEYS } from './AssessmentsListPage';

// Per-stage prop bundles for AssessmentsListPage. A stage looks the same in every role that can
// see it — same columns, same filters, same detail route — so the stage, not the role, is what
// varies. Role screens spread the bundle and only add what is genuinely theirs.

const assessmentDateColumn = {
  field: 'assessmentDate',
  headerName: 'Assessment Date',
  flex: 1.3,
  minWidth: 150,
  sortable: false,
  renderCell: params => (
    <span className="text-1-color fw-600">
      {params.row.startDate} - {params.row.endDate}
    </span>
  ),
};

const assessorsColumn = {
  field: 'assessors',
  headerName: 'Assessors',
  flex: 1,
  minWidth: 120,
  sortable: false,
  renderCell: params => <AppAvatarTooltip assessors={params.value} />,
};

const ratingColumn = {
  field: 'certificateLevel',
  headerName: 'Rating',
  flex: 1,
  minWidth: 120,
  sortable: false,
  renderCell: params => (
    <div className="double-content">
      <h4>{params.row.certificateLevel}</h4>
    </div>
  ),
};

const preferredAssessmentDateColumn = {
  field: 'preferredAssessmentDate',
  headerName: 'Preferred Assessment Date',
  flex: 1,
  minWidth: 220,
  sortable: false,
  renderCell: params => <span className="fs-12 fw-500 text-3-color mb-0">{params.row.preferredAssessmentDate}</span>,
};

const rejectedOnColumn = {
  field: 'rejectedOn',
  headerName: 'Rejected On',
  flex: 1,
  minWidth: 120,
  sortable: false,
  renderCell: params => (
    <div className="double-content">
      <h4 className="text-danger">{params.row.rejectedOn}</h4>
    </div>
  ),
};

const TEAM_FILTERS = [FILTER_KEYS.enterpriseSize, FILTER_KEYS.vendorCategory, FILTER_KEYS.assessmentStartDate, FILTER_KEYS.assessmentEndDate, FILTER_KEYS.leadAssessor, FILTER_KEYS.coAssessor];
const BASIC_FILTERS = [FILTER_KEYS.enterpriseSize, FILTER_KEYS.vendorCategory];
const DATE_RANGE_FILTERS = [FILTER_KEYS.enterpriseSize, FILTER_KEYS.vendorCategory, FILTER_KEYS.sector, FILTER_KEYS.assessmentStartDate, FILTER_KEYS.assessmentEndDate];

export const ASSESSMENT_STAGES = {
  allocationPending: {
    heading: 'Allocation Pending',
    status: 'allocation_pending',
    detailsPath: id => `/allocation-pending/allocation-pending-details/${id}`,
    filters: BASIC_FILTERS,
    extraColumns: [preferredAssessmentDateColumn],
    emptySubtitle: 'There are no allocation pending assessments to display.',
  },
  scheduled: {
    heading: 'Scheduled',
    status: 'scheduled',
    detailsPath: id => `/scheduled/assessment-details/${id}`,
    filters: TEAM_FILTERS,
    extraColumns: [assessmentDateColumn, assessorsColumn],
    emptySubtitle: 'There are no scheduled assessments to display.',
  },
  // Field work that is done on every device flips the assessment to mobile_complete; the lead
  // still works it here (and submits to QC), so the in-progress list spans both statuses.
  inProgress: {
    heading: 'In Progress',
    status: 'in_progress,mobile_complete',
    detailsPath: id => `/in-progress-assessment-details/${id}`,
    filters: TEAM_FILTERS,
    extraColumns: [assessmentDateColumn, assessorsColumn],
    emptySubtitle: 'There are no in-progress assessments to display.',
  },
  qualityCheck: {
    heading: 'Quality Check',
    status: 'submitted_for_qc',
    detailsPath: id => `/quality-check-assessment-details/${id}`,
    filters: TEAM_FILTERS,
    extraColumns: [assessmentDateColumn, assessorsColumn],
    emptySubtitle: 'There are no quality check assessments to display.',
  },
  qualityCheckFeedback: {
    heading: 'Quality Check Feedback',
    status: 'qc_feedback',
    detailsPath: id => `/quality-check-feedback-assessment-details/${id}`,
    filters: TEAM_FILTERS,
    extraColumns: [assessmentDateColumn, assessorsColumn],
    emptySubtitle: 'There are no quality check feedback items to display.',
  },
  readyForCommitteeReview: {
    heading: 'Ready for Committee Review',
    status: 'ready_for_committee',
    detailsPath: id => `/ready-for-committee-review-assessment-details/${id}`,
    filters: BASIC_FILTERS,
    extraColumns: [assessmentDateColumn, assessorsColumn],
    emptySubtitle: 'There are no ready for committee review assessments to display.',
  },
  committeeReviewScheduled: {
    heading: 'Committee Review Scheduled',
    status: 'committee_review',
    detailsPath: id => `/committee-review-scheduled-assessment-details/${id}`,
    filters: BASIC_FILTERS,
    extraColumns: [assessmentDateColumn, assessorsColumn],
    emptySubtitle: 'There are no committee review scheduled assessments to display.',
  },
  committeeReviewFeedback: {
    heading: 'Committee Review Feedback',
    status: 'committee_feedback',
    detailsPath: id => `/committee-review-feedback/assessment-details/${id}`,
    filters: DATE_RANGE_FILTERS,
    extraColumns: [assessmentDateColumn, assessorsColumn],
    emptySubtitle: 'There are no committee review feedback assessments to display.',
  },
  certified: {
    heading: 'Certified',
    status: 'certified',
    detailsPath: id => `/certified-assessment-details/${id}`,
    filters: [FILTER_KEYS.enterpriseSize, FILTER_KEYS.vendorCategory, FILTER_KEYS.assessmentStartDate, FILTER_KEYS.assessmentEndDate],
    extraColumns: [assessmentDateColumn, ratingColumn],
    emptySubtitle: 'There are no certified assessments to display.',
  },
  rejected: {
    heading: 'Rejected Assessments',
    status: 'rejected',
    detailsPath: id => `/rejected-assessments/assessment-details/${id}`,
    filters: DATE_RANGE_FILTERS,
    extraColumns: [assessmentDateColumn, assessorsColumn, rejectedOnColumn],
    emptyTitle: 'No Rejected Assessments',
    emptySubtitle: 'There are no rejected assessments to display.',
  },
};

// Operations Manager's Allocation Pending is the one screen that filters by sector as well.
export const ALLOCATION_PENDING_WITH_SECTOR_FILTERS = [...BASIC_FILTERS, FILTER_KEYS.sector];
