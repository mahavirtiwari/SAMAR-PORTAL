import { useEffect, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import Icons from '../../../constants/Icons';
import { getResponsesAction, getStepProgressAction } from '../../../redux/action/common/ApplicationAssessmentAction';
import { onActivate } from '../../../utils/a11y';
import { isServiceSector } from '../../../utils/assessmentExecution';
import { formatParameterScore, formatRcParameterScore } from '../../../utils/assessmentScoreUtils';
import { hasRole } from '../../../utils/roleUtils';
import { AppButton } from '../../base';

const AssessmentParameter = ({
  score,
  onClick,
  inProgress = false,
  qualityCheck = false,
  qualitycheckfeedback = false,
  readyforcommitteereview = false,
  committeeReviewScheduled = false,
  committeeReviewFeedback = false,
  certified = false,
  sendBack,
}) => {
  const dispatch = useDispatch();
  const { id } = useParams();
  const { user } = useSelector(state => state.Account);
  const { assessment } = useSelector(state => state.Assessment);
  const serviceSector = isServiceSector(assessment?.data?.assessment || assessment?.assessment || assessment);

  const [openParamId, setOpenParamId] = useState(null);
  const { responses, responsesLoading, responsesError } = useSelector(state => state.ApplicationAssessment);
  const allParams = responses?.parameters || [];
  useEffect(() => {
    if (id) {
      dispatch(getResponsesAction(id));
      // Step progress drives the assessor answering gate in the question modal.
      dispatch(getStepProgressAction(id));
    }
  }, [dispatch, id]);
  if (responsesLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (allParams.length === 0) {
    return (
      <div className="text-center py-5">
        <p className="text-muted">No parameters allocated yet</p>
      </div>
    );
  }

  if (responsesError) {
    return <div className="alert alert-danger">Failed to load parameters</div>;
  }

  const parameters = responses?.parameters || [];

  if (!parameters.length) {
    return <div className="text-center py-5 text-muted">No parameters allocated yet</div>;
  }

  const handleToggle = paramId => {
    setOpenParamId(prev => (prev === paramId ? null : paramId));
  };

  const assignedParams = allParams?.filter(param => (param.assignedAssessor || param.assignedToTeamMemberId || param.assignedTeamMember?.id) !== undefined);
  if (!assignedParams || assignedParams.length === 0) {
    return (
      <div className="text-center py-5">
        <p className="text-muted">No parameters assigned yet</p>
      </div>
    );
  }
  const isScoreVisible = !hasRole(user, 'assessor');
  // `committeeReviewScheduled` is the "meeting scheduled, committee hasn't
  // scored yet" stage — RC is not yet meaningful here. Only committee
  // feedback (sent back) and certified guarantee committee scoring.
  const rcScoreApplicable = committeeReviewFeedback || certified;

  return (
    <div>
      {parameters
        .filter(param => param.assignedAssessor)
        .map(param => {
          const questions = param.questions || [];

          const flaggedCommitteeCount = questions.filter(q => String(q.reviewStatus) === 'flagged' && String(q.reviewType) === 'committee').length;
          const flaggedQcCount = questions.filter(q => String(q.reviewStatus) === 'flagged' && String(q.reviewType) === 'qc').length;
          const clarifiedCommitteeCount = questions.filter(q => String(q.reviewStatus) === 'clarified' && String(q.reviewType) === 'committee').length;
          const clarifiedQcCount = questions.filter(q => String(q.reviewStatus) === 'clarified' && String(q.reviewType) === 'qc').length;
          // The QC reviewer sees every clarification flag raised so far, regardless of which stage raised it.
          const flaggedCount = questions.filter(q => String(q.reviewStatus) === 'flagged').length;
          const clarifiedCount = questions.filter(q => String(q.reviewStatus) === 'clarified').length;

          // Assessors in progress open a parameter straight into its questions modal.
          // Everyone else (Operations / DRDO viewers) gets the expandable question list
          // at every stage, like Quality Check, with a View per question.
          const expandable = !inProgress || isScoreVisible;
          const isOpen = expandable && openParamId === param.id;
          const openQuestionsModal = () => {
            if (typeof onClick === 'function' && questions.length > 0) {
              onClick(param, questions, 0);
            }
          };
          // A parameter with no questions is not "complete" — guard against 0===0.
          const isParamComplete = (param.totalQuestions ?? 0) > 0 && param.completedQuestions === param.totalQuestions;

          return (
            <div key={param.id} className="payment-allocation-container margin-bottom-16">
              {/* HEADER */}
              <div
                className="d-flex justify-content-between cursor-pointer"
                {...onActivate(() => (expandable ? handleToggle(param.id) : openQuestionsModal()))}
                aria-expanded={expandable ? isOpen : undefined}>
                <div className="d-flex align-items-start">
                  {inProgress && (
                    <div
                      className="status-icon-container margin-right-10"
                      style={{
                        backgroundColor: isParamComplete ? 'var(--success-light)' : 'var(--warning-light)',
                      }}>
                      <img src={isParamComplete ? Icons.greenTickCircle : Icons.yellowClock} className="icon-24" alt="status" />
                    </div>
                  )}
                  {(qualitycheckfeedback || readyforcommitteereview || committeeReviewScheduled || certified) && (
                    <div
                      className="status-icon-container margin-right-10"
                      style={{
                        backgroundColor: 'var(--background)',
                      }}>
                      <img src={Icons.twoNotesGrey} className="icon-24" alt="status" />
                    </div>
                  )}

                  <div>
                    <h4 className="fs-16 fw-600 mb-1">{param?.name}</h4>
                    <div className="d-flex align-items-center">
                      {inProgress && (
                        <div>
                          <div className="d-flex align-items-center">
                            <span className="fs-12 fw-500 text-3-color">
                              <span className="primary-color">{param.completedQuestions}</span>/{param.totalQuestions} completed
                            </span>

                            <div className="dot-separator" />
                            <span className="fs-12 fw-500 text-3-color">{param?.isMandatory ? 'Mandatory' : 'Optional'}</span>
                          </div>
                          <div className="margin-top-12">
                            <img alt="" src={Icons.blueUser} className="icon-18 margin-right-8" />
                            <span className="fw-500 fs-12 text-2-color">{param?.assignedAssessor?.name}</span>
                          </div>
                        </div>
                      )}
                      {(qualitycheckfeedback || readyforcommitteereview || committeeReviewFeedback || committeeReviewScheduled || certified || qualityCheck) && (
                        <div>
                          <div className="d-flex align-items-center">
                            <span className="fs-12 fw-500 text-3-color">
                              {param.totalQuestions} Question{param.totalQuestions !== 1 ? 's' : ''}
                            </span>

                            <div className="dot-separator" />
                            <span className="fs-12 fw-500 text-3-color">{param.isMandatory ? 'Mandatory' : 'Optional'}</span>
                          </div>
                          <div className="margin-top-12">
                            <img alt="" src={Icons.blueUser} className="icon-18 margin-right-8" />
                            <span className="fw-500 fs-12 text-2-color">{param?.assignedAssessor?.name}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="d-flex align-items-center">
                    <div className="margin-right-24 gap-8">
                      {committeeReviewFeedback && (
                        <div className="d-flex justify-content-end">
                          {flaggedCommitteeCount > 0 && (
                            <div className="response-container margin-top-12 align-items-end" style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger-active)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <div className="clarification-Number">{flaggedCommitteeCount > 0 ? flaggedCommitteeCount : null}</div>
                                <span className="fs-12">Clarification Required</span>
                                <div className="red-flag-container">
                                  <img alt="" src={Icons.redFlag} className="icon-14" />
                                </div>
                              </div>
                            </div>
                          )}
                          {clarifiedCommitteeCount > 0 && (
                            <div className="response-container margin-top-12 align-items-end" style={{ backgroundColor: 'var(--info-light)', color: 'var(--info-active)', marginLeft: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <div className="clarification-Number" style={{ backgroundColor: 'var(--primary)' }}>
                                  {clarifiedCommitteeCount > 0 ? clarifiedCommitteeCount : null}
                                </div>
                                <span className="fs-12">Responded</span>
                                <div className="red-flag-container">
                                  <img alt="" src={Icons.messageEdit} className="icon-14" />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {qualitycheckfeedback && (
                        <div className="d-flex justify-content-end">
                          {flaggedQcCount > 0 && (
                            <div className="response-container margin-top-12 align-items-end" style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger-active)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <div className="clarification-Number">{flaggedQcCount > 0 ? flaggedQcCount : null}</div>
                                <span className="fs-12">Clarification Required</span>
                                <div className="red-flag-container">
                                  <img alt="" src={Icons.redFlag} className="icon-14" />
                                </div>
                              </div>
                            </div>
                          )}
                          {clarifiedQcCount > 0 && (
                            <div className="response-container margin-top-12 align-items-end" style={{ backgroundColor: 'var(--info-light)', color: 'var(--info-active)', marginLeft: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <div className="clarification-Number" style={{ backgroundColor: 'var(--primary)' }}>
                                  {clarifiedQcCount > 0 ? clarifiedQcCount : null}
                                </div>
                                <span className="fs-12">Responded</span>
                                <div className="red-flag-container">
                                  <img alt="" src={Icons.messageEdit} className="icon-14" />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {qualityCheck && (
                        <div className="d-flex justify-content-end">
                          {flaggedCount > 0 && (
                            <div className="response-container margin-top-12 align-items-end" style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger-active)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <div className="clarification-Number">{flaggedCount}</div>
                                <span className="fs-12">Clarification Required</span>
                                <div className="red-flag-container">
                                  <img alt="" src={Icons.redFlag} className="icon-14" />
                                </div>
                              </div>
                            </div>
                          )}
                          {clarifiedCount > 0 && (
                            <div className="response-container margin-top-12 align-items-end" style={{ backgroundColor: 'var(--info-light)', color: 'var(--info-active)', marginLeft: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <div className="clarification-Number" style={{ backgroundColor: 'var(--primary)' }}>
                                  {clarifiedCount}
                                </div>
                                <span className="fs-12">Responded</span>
                                <div className="red-flag-container">
                                  <img alt="" src={Icons.messageEdit} className="icon-14" />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {isScoreVisible && (
                        <div className="d-flex gap-8 margin-top-12">
                          <div className="parameter-score-container d-flex gap-2">
                            <p className="fs-20 fw-500 primary-color mb-0 lh-1">{formatParameterScore(param.score)}</p>
                            <p className="fs-12 fw-500 text-2-color mb-0">{serviceSector ? 'RA Score' : 'SA Score'}</p>
                          </div>
                          <div className="parameter-score-container d-flex gap-4">
                            <p className="fs-20 fw-500 primary-color mb-0 lh-1">{formatRcParameterScore(param?.rcScore, rcScoreApplicable)}</p>
                            <p className="fs-12 fw-500 text-2-color mb-0">{'RC Score'}</p>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* In progress, a parameter opens straight into its questions modal (Next steps
                        through them); the other stages keep the expand/collapse question list. */}
                    {!expandable ? (
                      <AppButton
                        variant="link"
                        title="View"
                        buttonPaddingX="0"
                        customClass="fs-12"
                        onClick={event => {
                          event.stopPropagation();
                          openQuestionsModal();
                        }}
                      />
                    ) : (
                      <img src={isOpen ? Icons.topArrow : Icons.greyDownArrow} className="icon-24" alt="" />
                    )}
                  </div>
                </div>
              </div>
              {/* QUESTIONS */}
              {isOpen && (
                <div className="questions-wrapper">
                  {questions.map((qn, index) => (
                    <div key={qn.id || index} className={`question-container ${index !== questions.length - 1 ? 'margin-bottom-20' : ''}`}>
                      <div className="d-flex gap-10 align-items-start">
                        {inProgress && <img src={qn?.response ? Icons.greenTickCircle : Icons.yellowClock} className="icon-20 padding-top-2" alt={qn?.response ? 'Answered' : 'Not answered yet'} />}
                        {(readyforcommitteereview || certified) && <img src={Icons.documentGrey} className="icon-20 padding-top-2" alt="status" />}
                        {(committeeReviewFeedback || qualitycheckfeedback || qualityCheck) &&
                          (() => {
                            const isFlagged = String(qn.reviewStatus) === 'flagged';
                            const isClarified = String(qn.reviewStatus) === 'clarified';
                            const iconSrc = isFlagged ? Icons.redFlag : isClarified ? Icons.messageEdit : Icons.documentGrey;
                            return <img src={iconSrc} className="icon-20 padding-top-2" alt="status" />;
                          })()}

                        <p className="fw-500 mb-0">{qn.questionText}</p>
                      </div>

                      <AppButton variant="link" title="View" buttonPaddingX="0" onClick={() => typeof onClick === 'function' && onClick(param, questions, index)} customClass={'fs-12'} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
};

export default AssessmentParameter;
