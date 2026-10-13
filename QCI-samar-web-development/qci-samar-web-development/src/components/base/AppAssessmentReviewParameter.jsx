import { useState } from 'react';
import { useSelector } from 'react-redux';
import Icons from '../../constants/Icons';
import { isServiceSector } from '../../utils/assessmentExecution';
import { formatParameterScore, formatRcParameterScore } from '../../utils/assessmentScoreUtils';
import AppButton from './AppButton';

const AppAssessmentReviewParameter = ({
  title,
  questionCount,
  question,
  rcScore,
  rcScoreApplicable = false,
  questionNumbers,
  completedNumbers,
  completedCount,
  totalCount,
  onClick,
  mandatory,
  handleViewClick,
  score,
}) => {
  const [collapse, setCollapse] = useState(false);
  const handleToggle = () => {
    setCollapse(prev => !prev);
    if (onClick) {
      onClick();
    }
  };
  const hasPendingQuestion = Array.isArray(question) && question.some(q => q?.reviewStatus === 'pending');
  const sendBackCount = Array.isArray(question) ? question.filter(q => q?.reviewStatus === 'flagged').length : 0;
  const { pendingQcActions = [], assessment } = useSelector(state => state.Assessment || {});
  const serviceSector = isServiceSector(assessment?.data?.assessment || assessment?.assessment || assessment);
  const pendingForParamCount = Array.isArray(pendingQcActions) ? pendingQcActions.filter(p => p.type === 'markSendBack' && question.some(q => String(q.id) === String(p.questionId))).length : 0;

  return (
    <div className="payment-allocation-container  margin-bottom-16">
      <div className={`rowBetween cursor-pointer`} onClick={handleToggle}>
        <div className="d-flex align-items-center">
          <div
            className="status-icon-container  margin-right-10"
            style={{
              backgroundColor: 'var(--background)',
            }}>
            <img src={Icons.twoNotesGrey} alt={hasPendingQuestion ? 'pending' : 'completed'} className="icon-24" />
          </div>

          <div className="lh-normal-18">
            <div className="d-flex align-items-center">
              <h4 className="fs-16 fw-600 heading-color margin-bottom-2 mb-0">{title}</h4>
            </div>
            {questionNumbers && (
              <div className="d-flex align-items-center">
                <span className="fs-12 fw-500 text-3-color">
                  {questionCount} Question{questionCount !== 1 ? 's' : ''}
                </span>

                <div className="dot-separator" />
                <span className="fs-12 fw-500 text-3-color">{mandatory ? 'Mandatory' : 'Optional'}</span>
              </div>
            )}
            {completedNumbers && (
              <span className="fs-12 fw-500 text-3-color">
                <span className="primary-color">{completedCount}</span>/{totalCount} completed
              </span>
            )}
          </div>
        </div>

        <div className="d-flex align-items-center ">
          {(pendingForParamCount > 0 || sendBackCount > 0) && (
            <div
              className="response-container d-inline-flex align-items-center margin-left-8 margin-right-8"
              style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger-active)', marginLeft: 8 }}>
              <div className="clarification-Number">{pendingForParamCount > 0 ? pendingForParamCount : sendBackCount}</div>
              <span className="fs-12 fw-500 margin-left-8">Clarification Required</span>
              <div className="response-icon-container margin-left-4">
                <img src={Icons.redFlag} alt="response icon" className="icon-14" />
              </div>
            </div>
          )}
          <div className="parameter-score-container margin-right-20">
            <p className="fs-20 fw-500 primary-color mb-0">{formatParameterScore(score)}</p>
            <p className="fs-12 fw-500 text-2-color mb-0">{serviceSector ? 'RA Score' : 'SA Score'}</p>
          </div>
          <div className="parameter-score-container margin-right-20">
            <p className="fs-20 fw-500 primary-color mb-0">{formatRcParameterScore(rcScore, rcScoreApplicable)}</p>
            <p className="fs-12 fw-500 text-2-color mb-0">{'RC Score'}</p>
          </div>
          <div>
            <img src={collapse ? Icons.topArrow : Icons.greyDownArrow} alt="arrow" className="icon-24" />
          </div>
        </div>
      </div>
      {/* open */}
      {collapse && (
        <div className="questions-wrapper">
          {question.map((qn, index) => {
            const pendingItem = Array.isArray(pendingQcActions) ? pendingQcActions.find(p => String(p.questionId) === String(qn.id) && p.type === 'markSendBack') : undefined;
            const isFlaggedOrSentBack = String(qn.reviewStatus) === 'flagged' || String(qn.reviewStatus) === 'sent_back';
            const isClarified = String(qn.reviewStatus) === 'clarified';
            const iconSrc = pendingItem?.type === 'markSendBack' ? Icons.redFlag : isFlaggedOrSentBack ? Icons.redFlag : isClarified ? Icons.messageEdit : Icons.documentGrey;
            return (
              <div className={`question-container ${index !== question.length - 1 ? 'margin-bottom-20' : ''}`} key={index}>
                <div className="d-flex align-items-start gap-10">
                  <img src={iconSrc} alt="question icon" className="icon-20" />
                  <p className="fw-500 fs-14 text-1-color mb-0">{qn?.questionText}</p>
                </div>
                <AppButton size="medium" variant="link" title={'View'} buttonPaddingX="0" customClass="fs-12" onClick={() => handleViewClick(qn)} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default AppAssessmentReviewParameter;
