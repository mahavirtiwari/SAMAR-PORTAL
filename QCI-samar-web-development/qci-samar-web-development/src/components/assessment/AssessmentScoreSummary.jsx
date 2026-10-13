import { isServiceSector } from '../../utils/assessmentExecution';
import { formatParameterScore, formatRcParameterScore, isRcScoreApplicable } from '../../utils/assessmentScoreUtils';

// Assessment-level totals. `totalScore` is the RC-effective score
// (rc_score ?? assessor score) so it only reads as an RC Score once the
// committee has actually scored; the committee meeting screens override
// `rcScoreApplicable` (live-scoring context) and `rcScore` (optimistic
// preview of in-flight RC edits).
const AssessmentScoreSummary = ({ assessmentData, rcScoreApplicable = isRcScoreApplicable(assessmentData?.status), rcScore, className = '', boxClassName = 'details-level-box', children }) => (
  <div className={`d-flex align-items-center gap-8 flex-shrink-0 ${className}`.trim()}>
    <div className={`${boxClassName} flex-shrink-0`}>
      <p className="fs-14 fw-500 heading-color mb-0 text-end">{formatParameterScore(assessmentData?.assessorScore)}</p>
      <p className="fs-12 fw-500 text-3-color mb-0 text-end">{isServiceSector(assessmentData) ? 'RA Score' : 'SA Score'}</p>
    </div>
    <div className={`${boxClassName} flex-shrink-0`}>
      <p className="fs-14 fw-500 heading-color mb-0 text-end">{formatRcParameterScore(rcScore ?? assessmentData?.totalScore, rcScoreApplicable)}</p>
      <p className="fs-12 fw-500 text-3-color mb-0 text-end">RC Score</p>
    </div>
    {children}
  </div>
);

export default AssessmentScoreSummary;
