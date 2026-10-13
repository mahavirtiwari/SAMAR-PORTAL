import { useEffect, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import Icons from '../../constants/Icons';
import { getResponsesAction } from '../../redux/action/common/ApplicationAssessmentAction';
import { isServiceSector } from '../../utils/assessmentExecution';
import { formatParameterScore } from '../../utils/assessmentScoreUtils';
import AppButton from './AppButton';

const OperationsManagerAssessmentParameter = ({ mandatory, score, onClick }) => {
  const dispatch = useDispatch();
  const { id } = useParams();
  const [openParamId, setOpenParamId] = useState(null);
  const { responses, responsesLoading, responsesError } = useSelector(state => state.ApplicationAssessment);
  const { pendingQcActions = [], assessment } = useSelector(state => state.Assessment);
  const serviceSector = isServiceSector(assessment?.data?.assessment || assessment?.assessment || assessment);
  const allParams = responses?.parameters || [];
  useEffect(() => {
    if (id) {
      dispatch(getResponsesAction(id));
    }
  }, [dispatch, id]);
  if (allParams.length === 0) {
    return (
      <div className="text-center py-5">
        <p className="text-muted">No parameters allocated yet</p>
      </div>
    );
  }
  // 👇 track open parameter

  const parameterData = allParams?.map(param => {
    const questions = param.questions || [];
    const questionCount = questions.length || 0;
    const completedCount = questions.filter(q => q.response?.selectedOption).length || 0;

    const assigneeName = param.assignedAssessor?.name || param?.assignedTeamMember?.user?.firstName || '';
    const assigneeRoleRaw = param.assignedAssessor?.role || param.assignedTeamMember?.role || '';
    const assigneeRole = assigneeRoleRaw === 'lead_assessor' ? 'Lead Assessor' : assigneeRoleRaw === 'co_assessor' ? 'Co Assessor' : assigneeRoleRaw || 'Assessor';

    const assignedToTeamMemberId = param.assignedAssessor?.id || param.assignedToTeamMemberId || param.assignedTeamMember?.id;
    return {
      id: param.id,
      title: param?.name || param?.title,
      questionCount,
      completedCount,
      totalCount: questionCount,
      assignee: assigneeName,
      assigneeRole,
      assignedToTeamMemberId,
      status: assignedToTeamMemberId ? 'assigned' : 'pending',
      isMandatory: param.isMandatory,
    };
  });

  if (responsesLoading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner animation="border" />
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

  const assignedParams = parameterData?.filter(item => item.assignedToTeamMemberId);

  if (!assignedParams || assignedParams.length === 0) {
    return (
      <div className="text-center py-5">
        <p className="text-muted">No parameters assigned yet</p>
      </div>
    );
  }
  return (
    <div>
      {parameters
        .filter(param => param.assignedAssessor)
        .map(param => {
          const questions = param.questions || [];

          const _hasPendingQuestion = questions.some(q => q.committeeReviewStatus === 'pending');

          // A question needs clarification (red flag) when the lead assessor flagged it
          // (reviewStatus 'flagged') or a reviewer sent it back (committeeReviewStatus).
          const needsClarification = q => {
            const rs = String(q?.reviewStatus ?? q?.response?.reviewStatus ?? '').toLowerCase();
            const crs = String(q?.committeeReviewStatus ?? q?.response?.committeeReviewStatus ?? '').toLowerCase();
            return rs === 'flagged' || ['sent_back', 'send_back', 'clarification_required'].includes(crs);
          };
          const sendBackCount = questions.filter(needsClarification).length;

          const isOpen = openParamId === param.id;

          return (
            <div key={param.id} className="payment-allocation-container margin-bottom-16">
              {/* HEADER */}
              <div className="d-flex justify-content-between cursor-pointer align-items-start" onClick={() => handleToggle(param.id)}>
                <div className="d-flex align-items-start">
                  <div
                    className="status-icon-container margin-right-10"
                    style={{
                      backgroundColor: 'var(--background)',
                    }}>
                    <img src={Icons.twoNotesGrey} className="icon-24" alt="status" />
                  </div>

                  <div>
                    <h4 className="fs-16 fw-600 mb-1">{param?.name}</h4>
                    <div className="d-flex align-items-center">
                      <div>
                        <div className="d-flex align-items-center">
                          <span className="fs-12 fw-500 text-3-color">
                            {param.totalQuestions} Question{param.totalQuestions !== 1 ? 's' : ''}
                          </span>

                          <div className="dot-separator" />
                          <span className="fs-12 fw-500 text-3-color">{param.isMandatory ? 'Mandatory' : 'Optional'}</span>
                        </div>
                        <div className="margin-top-12">
                          <img src={Icons.blueUser} className="icon-18 margin-right-8" />
                          <span className="fw-500 fs-12 text-2-color">{param?.assignedAssessor?.name}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="d-flex align-items-center">
                    <div className="margin-right-24 gap-8">
                      {(() => {
                        const pendingForParamCount = Array.isArray(pendingQcActions)
                          ? pendingQcActions.filter(p => String(p.assessmentId) === String(id) && questions.some(q => String(q.id) === String(p.questionId) && p.type === 'markSendBack')).length
                          : 0;
                        const showClarification = pendingForParamCount > 0 || questions.some(needsClarification);
                        if (!showClarification) {
                          return null;
                        }
                        const displayCount = pendingForParamCount > 0 ? pendingForParamCount : sendBackCount;
                        return (
                          <div className="d-flex justify-content-end">
                            <div
                              className="response-container d-flex align-items-center margin-top-12"
                              style={{
                                backgroundColor: 'var(--danger-light)',
                                color: 'var(--danger-active)',
                              }}>
                              <div className="clarification-Number">{displayCount}</div>
                              <span className="fs-12 fw-500">Clarification Required</span>
                              <div className="response-icon-container margin-left-4">
                                <img src={Icons.redFlag} alt="response icon" className="icon-14" />
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      <div className="d-flex gap-8">
                        <div className="parameter-score-container d-flex gap-2 align-items-end">
                          <p className="fs-20 fw-500 primary-color mb-0 lh-1">{formatParameterScore(param.score)}</p>
                          <p className="fs-12 fw-500 text-2-color mb-0">{serviceSector ? 'RA Score' : 'SA Score'}</p>
                        </div>
                        <div className="parameter-score-container d-flex gap-2 align-items-end">
                          <p className="fs-20 fw-500 primary-color mb-0 lh-1">-</p>
                          <p className="fs-12 fw-500 text-2-color mb-0">{'RC Score'}</p>
                        </div>
                      </div>
                    </div>
                    <img src={isOpen ? Icons.topArrow : Icons.greyDownArrow} className="icon-24" alt="toggle" />
                  </div>
                </div>
              </div>
              {/* QUESTIONS */}

              {isOpen && (
                <div className="questions-wrapper">
                  {questions.map((question, index) => {
                    // Find pending QC item for this assessment+question
                    const pendingItem = Array.isArray(pendingQcActions) ? pendingQcActions.find(p => String(p.assessmentId) === String(id) && String(p.questionId) === String(question.id)) : undefined;

                    let iconSrc = pendingItem?.type === 'markSendBack' || needsClarification(question) ? Icons.redFlag : Icons.documentGrey;
                    const isLast = index === questions.length - 1;

                    return (
                      <div key={question.id || index} className={`question-container ${isLast ? '' : 'margin-bottom-20'}`}>
                        <div className="d-flex gap-10 align-items-start">
                          <img src={iconSrc} className="icon-20 padding-top-2" alt="status" />
                          <p className="fw-500 mb-0">{question.questionText}</p>
                        </div>

                        <AppButton variant="link" title="View" buttonPaddingX="0" onClick={() => typeof onClick === 'function' && onClick(param, questions, index)} customClass={'fs-12'} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
};

export default OperationsManagerAssessmentParameter;
