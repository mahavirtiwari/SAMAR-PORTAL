import { ASSESSMENT_STATUS } from '../constants/assessmentStatus';

// RC score is only meaningful once the committee has actually scored the
// assessment. `committee_review` covers both the scheduled and in-meeting
// phases — the committee hasn't necessarily acted yet — so it's excluded
// here. Only `committee_feedback` (sent back) and `certified` (approved)
// guarantee that committee scoring has happened. The rating-committee
// meeting screens themselves opt in by passing rcScoreApplicable={true}
// explicitly since they are the live-scoring context.
const RC_VISIBLE_STATUSES = new Set([ASSESSMENT_STATUS.COMMITTEE_FEEDBACK, ASSESSMENT_STATUS.CERTIFIED]);

export const isRcScoreApplicable = assessmentStatus => RC_VISIBLE_STATUSES.has(String(assessmentStatus || '').toLowerCase());

export const formatRcScore = (rcScore, rcScoreApplicable) => {
  if (!rcScoreApplicable) {
    return '-';
  }
  if (rcScore === null || rcScore === undefined || rcScore === '') {
    return '-';
  }
  return rcScore;
};

// Question-level scores are integer (1–5) by data definition (see
// AddAssessmentQuestionModal — option `Score: idx + 1`). The backend
// sometimes serialises them as decimal strings ("1.00"); coerce to a
// number so React renders "1" instead of "1.00". Parameter-level totals
// go through formatParameterScore below.
export const formatQuestionScore = score => {
  if (score === null || score === undefined || score === '') {
    return '-';
  }
  const numeric = Number(score);
  if (Number.isNaN(numeric)) {
    return '-';
  }
  return numeric;
};

// Parameter-level scores are averages of question scores and may be decimals.
// Always render with 2 decimal places (e.g., 4 -> "4.00", 3.666 -> "3.67").
// Question-level scores stay integer and bypass this helper.
export const formatParameterScore = score => {
  if (score === null || score === undefined || score === '') {
    return '-';
  }
  const numeric = Number(score);
  if (Number.isNaN(numeric)) {
    return '-';
  }
  return numeric.toFixed(2);
};

export const formatRcParameterScore = (rcScore, rcScoreApplicable) => {
  if (!rcScoreApplicable) {
    return '-';
  }
  return formatParameterScore(rcScore);
};

// Resolve which option should be shown as selected for a question.
//
// System-wide invariant (enforced at option creation, verified in dev+staging data):
// option position N has integer score N (1-5). So the committee's option pick can be
// derived from rc_score directly: option = Number(rc_score). When the RC has acted
// (rcScoreApplicable) we prefer that; otherwise show the assessor's selectedOption.
// Returns a string for direct use as MUI RadioGroup value.
export const resolveDisplayedSelectedOption = (response, rcScoreApplicable) => {
  if (rcScoreApplicable) {
    const rcScore = response?.rcScore;
    if (rcScore !== null && rcScore !== undefined && rcScore !== '') {
      const n = Number(rcScore);
      if (!Number.isNaN(n)) {
        return String(Math.round(n));
      }
    }
  }
  const assessorPick = response?.selectedOption;
  if (assessorPick === null || assessorPick === undefined || assessorPick === '') {
    return '';
  }
  return String(assessorPick);
};
