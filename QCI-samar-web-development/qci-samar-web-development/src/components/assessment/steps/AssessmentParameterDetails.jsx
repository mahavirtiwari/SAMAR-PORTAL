import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ASSESSMENT_STATUS } from '../../../constants/assessmentStatus';
import Icons from '../../../constants/Icons';
import { getResponsesAction } from '../../../redux/action/common/ApplicationAssessmentAction';
import { isMemberExecutionLocked, isServiceSector } from '../../../utils/assessmentExecution';
import { formatParameterScore, formatRcParameterScore, isRcScoreApplicable } from '../../../utils/assessmentScoreUtils';
import { getBadgeVariantByLabel, getStatusLabel } from '../../../utils/getStatusColors';
import { hasRole } from '../../../utils/roleUtils';
import { AppAssessmentParameterQuestion, AppAvatar, AppBadge } from '../../base';
import AppIconButton from '../../base/AppIconButton';
import { Layout } from '../../layout';

const AssessmentParameterDetails = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const params = useParams();
  const location = useLocation();
  const parameterId = location?.state?.parameterId;
  const _inProgress = location?.state?.InProgress || false;

  const assessmentId = params.id;
  const { responses } = useSelector(state => state.ApplicationAssessment);
  const { assessment } = useSelector(state => state.Assessment);
  const [status, _setStatus] = useState('completed');
  const { user } = useSelector(state => state.Account);
  const assessmentData = assessment?.data?.assessment || assessment?.assessment || assessment;
  const serviceSector = isServiceSector(assessmentData);
  const assessmentStatus = assessmentData?.status;
  const rcScoreApplicable = isRcScoreApplicable(assessmentStatus);
  // Editable while the assessment is running, but locked once this member has
  // submitted their own field work (per-member cutover, not the whole-assessment
  // status which lags until every member is done).
  const isAssessorEditing = (assessmentStatus === ASSESSMENT_STATUS.IN_PROGRESS || assessmentStatus === ASSESSMENT_STATUS.MOBILE_COMPLETE) && !isMemberExecutionLocked(assessmentData, user?.id);
  const displayedParameter = responses?.parameters?.find(p => (parameterId ? String(p.id) === String(parameterId) : true));

  // Status can be 'pending' or 'completed' - this would typically come from props or API
  // Set to 'completed' to show the image design

  useEffect(() => {
    // Reset selected answers when status changes
    dispatch(getResponsesAction(assessmentId));
  }, [status]);

  // if (responsesLoading) {
  //   return (
  //     <div className="d-flex justify-content-center align-items-center py-5">
  //       <Spinner animation="border" variant="primary" />
  //     </div>
  //   );
  // }
  const isAssessor = hasRole(user, 'assessor');
  const isScoreVisible = !isAssessor;

  const path = location?.pathname || '';
  const statusLabel = path.includes('quality-check-feedback')
    ? 'Quality Check Feedback'
    : path.includes('committee-review-feedback')
      ? 'Committee Review Feedback'
      : path.includes('committee-review-scheduled')
        ? 'Committee Review Scheduled'
        : path.includes('ready-for-committee-review')
          ? 'Ready for Committee Review'
          : path.includes('quality-check')
            ? 'Quality Check'
            : path.includes('certified')
              ? 'Certified'
              : 'In Progress';
  const rootLabel = hasRole(user, 'operations_admin') || hasRole(user, 'operations_manager') ? 'Manage Assessments' : hasRole(user, 'drdo_admin') ? 'View Assessments' : null;

  return (
    <Layout
      subHeader={
        <div className="subHeaderWrapper">
          <div className="subHeaderLeft">
            <div className="subHeaderLeftBox">
              <AppIconButton icon={Icons.back} label="Go back" iconClassName="icon-24" onClick={() => navigate(-1)} />
              <div className="heading-seperator"></div>
              <h1 className="heading-createApp">Parameter Details</h1>
            </div>
            <div className="subHeaderRightBx">
              <ul className="breadCrumbHeader">
                {rootLabel ? (
                  <>
                    <li className="margin-left-30">{rootLabel}</li>
                    <div className="dot-separator" />
                    <li>{statusLabel}</li>
                  </>
                ) : (
                  <li className="margin-left-30">{statusLabel}</li>
                )}
                <div className="dot-separator" />
                <li>Assessment Details</li>
                <div className="dot-separator" />
                <li>Parameter Details</li>
              </ul>
              <AppBadge variant={getBadgeVariantByLabel(assessmentStatus)} label={getStatusLabel(assessmentStatus)} className="margin-left-30" />
            </div>
          </div>
        </div>
      }>
      <div className="main-content-inner">
        <div className="container">
          <div className="row">
            {/* Header Card - Process Control and Assessor Info - Always full width */}
            <div className="col-12">
              <div className="details-card">
                <div className="assessment-header-section">
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                      <div className="process-control-icon-wrapper margin-right-16">
                        <img src={Icons.twoNotes} alt="Process Control" className="icon-40" />
                      </div>
                      <div>
                        {responses && Array.isArray(responses.parameters) && responses.parameters.length > 0 ? (
                          responses.parameters
                            .filter(param => (parameterId ? param.id === parameterId : true))
                            .map((param, idx) => (
                              <div key={param.id || idx}>
                                <h1 className="fs-24 fw-600 heading-color mb-2">{param?.name || 'Unnamed Parameter'}</h1>
                                <div className="margin-top-2 d-flex align-items-center">
                                  <p className="fs-16 fw-500 text-3-color mb-0">
                                    <span className="primary-color">{param?.completedQuestions ?? 0}</span>/{param?.totalQuestions ?? 0} Question
                                    {(param?.totalQuestions ?? 0) !== 1 ? 's' : ''} Completed
                                  </p>
                                </div>
                              </div>
                            ))
                        ) : (
                          <h1 className="fs-24 fw-600 heading-color mb-2">Parameter Details</h1>
                        )}
                      </div>
                    </div>
                    {isScoreVisible && (
                      <div className="d-flex gap-3">
                        <div className="score-box">
                          <p className="score-value text-primary fw-500 fs-20 mb-0">{formatParameterScore(displayedParameter?.score)}</p>
                          <span className="score-label fs-16 fw-500 text-2-color">{serviceSector ? 'RA Score' : 'SA Score'}</span>
                        </div>
                        <div className="score-box">
                          <p className="score-value text-primary fw-500 fs-20 mb-0">{formatRcParameterScore(displayedParameter?.rcScore, rcScoreApplicable)}</p>
                          <span className="score-label fs-16 fw-500 text-2-color">{'RC Score'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="d-inline-block margin-top-20">
                  <div className="d-flex user-profile-container">
                    {responses && Array.isArray(responses.parameters) && responses.parameters.length > 0 ? (
                      responses.parameters
                        .filter(param => (parameterId ? param.id === parameterId : true))
                        .map((param, idx) => (
                          <div className="d-flex align-items-center" key={param.id || idx}>
                            <AppAvatar alt={param.assignedAssessor?.name} size="24" role={param.assignedAssessor?.role}>
                              {param.assignedAssessor?.name}
                            </AppAvatar>
                            <div className="lh-normal-18 margin-left-8">
                              <h3 className="fs-14 fw-500 text-1-color mb-0">{param.assignedAssessor?.name || 'N/A'}</h3>
                              <span className="fs-12 fw-400 text-2-color">{param.assignedAssessor?.role || ''}</span>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="d-flex align-items-center">
                        <AppAvatar alt="-" size="24" role={''}>
                          -
                        </AppAvatar>
                        <div className="lh-normal-18 margin-left-8">
                          <h3 className="fs-14 fw-500 text-1-color mb-0">N/A</h3>
                          <span className="fs-12 fw-400 text-2-color">&nbsp;</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <AppAssessmentParameterQuestion
            propParameter={displayedParameter}
            editComment={isAssessor && user.id === displayedParameter?.assignedAssessor?.id}
            assessmentId={assessmentId}
            isScoreVisible={isScoreVisible}
            InProgress={isAssessorEditing}
            rcScoreApplicable={rcScoreApplicable}
          />
        </div>
      </div>
    </Layout>
  );
};

export default AssessmentParameterDetails;
