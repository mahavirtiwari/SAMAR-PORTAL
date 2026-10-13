import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { AppAvatar, AppButton } from '../../../../../../../components/base';
import { CustomerDetailModal } from '../../../../../../../components/modals';
import AllocatedParametersModal from '../../../../../../../components/modals/AllocatedParametersModal';
import AppAssessorParameterQuestionsModal from '../../../../../../../components/modals/AppAssessorParameterQuestionsModal';
import AppModal from '../../../../../../../components/modals/AppModal';
import KeyRawMaterialModal from '../../../../../../../components/modals/KeyRawMaterialModal';
import ProductDetailModal from '../../../../../../../components/modals/ProductDetailModal';
import PunchModal from '../../../../../../../components/modals/PunchModal';
import Icons from '../../../../../../../constants/Icons';
import {
  bulkAssignParametersAction,
  getAttendanceAction,
  getFieldCompletionStatusAction,
  getMyPunchStatusAction,
  getParametersAction,
  getStepProgressAction,
} from '../../../../../../../redux/action/common/ApplicationAssessmentAction';
import {
  areRoleStepsComplete,
  getNextIncompleteStep,
  getRoleRequiredSteps,
  getStepStatus,
  isMemberExecutionLocked,
  isParameterAssignedToUser,
  isServiceSector,
  resolveTeamRole,
  STEP_STATUS,
} from '../../../../../../../utils/assessmentExecution';
import { fetchAuthenticatedImageUrl } from '../../../../../../../utils/FileUtils';
import { formatDate, formatTime } from '../../../../../../../utils/formatters';
import { hasRole } from '../../../../../../../utils/roleUtils';
import AssessmentParameter from './assessmentSteps/AssessmentParameter';
import BasicInformation from './assessmentSteps/BasicInformation';
import ClosingMeeting from './assessmentSteps/ClosingMeeting';
import OpeningMeeting from './assessmentSteps/OpeningMeeting';
import SitePictures from './assessmentSteps/SitePictures';
import SiteTour from './assessmentSteps/SiteTour';

const sidebarSteps = [
  // { number: 1, label: 'Parameter Allocation', key: 'parameter_allocation' },
  { number: 2, label: 'Site Pictures', key: 'site_pictures' },
  { number: 3, label: 'Opening Meeting', key: 'opening_meeting' },
  { number: 4, label: 'Site Tour', key: 'site_tour' },
  { number: 5, label: 'Basic Information', key: 'basic_information' },
  { number: 6, label: 'Assessment Parameter', key: 'assessment_parameters' },
  { number: 7, label: 'Closing Meeting', key: 'closing_meeting' },
];

// onPunchInSuccess lets the Scheduled screen start the assessment (scheduled →
// in_progress) off the punch-in; on the In-Progress screen it is a no-op.
const AssessmentTab = ({ assessment, onPunchInSuccess }) => {
  const [assignments, setAssignments] = useState({});

  const { bulkAssignLoading } = useSelector(state => state.ApplicationAssessment);
  const dispatch = useDispatch();
  const { id } = useParams();
  const { user } = useSelector(state => state.Account);
  const { stepProgress, punchStatus, parameters, attendance, responses } = useSelector(state => state.ApplicationAssessment);

  // Step locking + the punch-in gate apply only to a service-sector assessor
  // actively executing on web. Manufacturing assessors and read-only viewers keep
  // the existing free navigation (no regression).
  const { isLead, isTeamMember, teamMemberId } = resolveTeamRole(assessment, user?.id);
  const serviceExecution = isServiceSector(assessment) && isTeamMember;
  const roleRequiredSteps = useMemo(() => getRoleRequiredSteps(isLead), [isLead]);
  const isPunchedIn = !!(punchStatus?.isPunchedIn ?? punchStatus?.is_punched_in);
  // Once this member has submitted their field work, or finished all their steps
  // and punched out, they are done — no re-punch-in (mirrors the mobile app,
  // where the punch card disappears after the cutover).
  const executionLocked = isMemberExecutionLocked(assessment, user?.id);
  const roleStepsComplete = areRoleStepsComplete(stepProgress, roleRequiredSteps);
  const canPunchIn = serviceExecution && !isPunchedIn && !executionLocked && !roleStepsComplete;

  useEffect(() => {
    if (id && serviceExecution) {
      dispatch(getMyPunchStatusAction(id));
      dispatch(getAttendanceAction(id));
      dispatch(getParametersAction(id));
    }
  }, [dispatch, id, serviceExecution]);

  // Sequencing keys off the steps this role actually works in the sidebar —
  // parameter_allocation is a lead-required step but is driven from the punch
  // card, not a tab, so including it would lock every tab until it completes.
  const gatedStepKeys = useMemo(() => sidebarSteps.map(step => step.key).filter(key => roleRequiredSteps.includes(key)), [roleRequiredSteps]);
  const nextIncompleteStep = getNextIncompleteStep(stepProgress, gatedStepKeys);
  // Manufacturing has no team-role split or punch-in, so it gates on the full
  // sidebar order: the first not-yet-completed step is the only actionable one.
  const sidebarStepKeys = useMemo(() => sidebarSteps.map(step => step.key), []);
  const nextIncompleteSidebarStep = getNextIncompleteStep(stepProgress, sidebarStepKeys);

  const getStepState = step => {
    const completed = getStepStatus(stepProgress, step.key) === STEP_STATUS.COMPLETED;
    if (!serviceExecution) {
      // Manufacturing: sequential gating (no punch-in). A completed step stays
      // reviewable (green); only the first not-yet-completed step is actionable;
      // everything after it stays locked (grey), never pending/yellow.
      const actionable = completed || step.key === nextIncompleteSidebarStep;
      return { completed, locked: !actionable };
    }
    // The on-site steps stay locked until the assessor punches in, unless
    // the step is already completed and should remain reviewable.
    if (!isPunchedIn && !completed) {
      return { completed, locked: true };
    }
    // One step is open at a time: the role's first not-yet-completed step. A
    // completed step stays reachable for review; everything after the open one
    // waits its turn. The member cutover closes editing for good.
    const actionable = completed || (isPunchedIn && !executionLocked && step.key === nextIncompleteStep);
    return { completed, locked: !actionable };
  };

  const [activeTab, setActiveTab] = useState(2);
  const activeStep = sidebarSteps.find(step => step.number === activeTab);
  // Save & Next advances to the following step this role actually owns — a co-assessor
  // skips the lead-only steps rather than landing on a panel they cannot open.
  const goToNextStep = () => {
    const currentIndex = sidebarSteps.findIndex(step => step.number === activeTab);
    const nextStep = sidebarSteps.slice(currentIndex + 1).find(step => !serviceExecution || roleRequiredSteps.includes(step.key));
    if (nextStep) {
      setActiveTab(nextStep.number);
    }
  };

  // The closing meeting is the lead's last on-site step; remind them to punch out before Submit for
  // QC (which needs their field work completed) instead of leaving them on the completed step.
  const handleClosingMeetingSaved = () => {
    goToNextStep();
    if (isPunchedIn) {
      setShowPunchOutForQcModal(true);
      setTimeout(() => setShowPunchOutForQcModal(false), 2000);
    }
  };
  const activeLocked = activeStep ? getStepState(activeStep).locked : false;
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [keyRawMaterialModalOpen, setKeyRawMaterialModalOpen] = useState(false);
  const [selectedKeyRawMaterial, setSelectedKeyRawMaterial] = useState(null);
  const [punchModalOpen, setPunchModalOpen] = useState(false);
  const [punchModalMode, setPunchModalMode] = useState('out');
  const [showPunchOutForQcModal, setShowPunchOutForQcModal] = useState(false);
  const [allocatedParametersModalOpen, setAllocatedParametersModalOpen] = useState(false);
  const [showAllocatedSuccess, setShowAllocatedSuccess] = useState(false);
  const allocatedSuccessTimeoutRef = useRef(null);

  useEffect(() => () => clearTimeout(allocatedSuccessTimeoutRef.current), []);

  const mandatoryParameters = parameters?.mandatoryParameters || [];
  const optionalParameters = parameters?.optionalParameters || [];
  const allocatedParameters = useMemo(() => [...mandatoryParameters, ...optionalParameters], [mandatoryParameters, optionalParameters]);
  const leadAllocatedCount = allocatedParameters.filter(parameter => parameter?.assignedTeamMember?.role === 'lead_assessor').length;
  const coAssessorAllocatedCount = allocatedParameters.filter(parameter => parameter?.assignedTeamMember?.role === 'co_assessor').length;
  const myAssignedParameterCount = allocatedParameters.filter(parameter => isParameterAssignedToUser(parameter, user?.id, teamMemberId)).length;
  // Once anything is allocated the card stops inviting an assignment and offers a review link instead.
  const hasAllocation = leadAllocatedCount + coAssessorAllocatedCount > 0;
  const lastAttendance = punchStatus?.lastAttendance || punchStatus?.last_attendance;
  const attendanceRecords = attendance?.attendances || attendance || [];
  const latestPunchIn = useMemo(() => {
    if (!Array.isArray(attendanceRecords)) {
      return null;
    }

    return attendanceRecords
      .filter(record => {
        const recordUserId = record?.teamMember?.user?.id || record?.team_member?.user?.id || record?.userId || record?.user_id;
        return (record?.type === 'punch_in' || record?.type === 'punch-in') && String(recordUserId) === String(user?.id);
      })
      .sort((a, b) => new Date(b?.recordedAt || b?.recorded_at || 0) - new Date(a?.recordedAt || a?.recorded_at || 0))[0];
  }, [attendanceRecords, user?.id]);
  const lastPunch = lastAttendance?.punchIn || lastAttendance?.punch_in || latestPunchIn || lastAttendance;
  const latitude =
    lastPunch?.latitude ?? lastPunch?.lat ?? lastPunch?.coordinates?.latitude ?? lastPunch?.location?.latitude ?? latestPunchIn?.latitude ?? latestPunchIn?.lat ?? latestPunchIn?.coordinates?.latitude;
  const longitude =
    lastPunch?.longitude ??
    lastPunch?.lng ??
    lastPunch?.long ??
    lastPunch?.coordinates?.longitude ??
    lastPunch?.location?.longitude ??
    latestPunchIn?.longitude ??
    latestPunchIn?.lng ??
    latestPunchIn?.long ??
    latestPunchIn?.coordinates?.longitude;
  const coordinates = [latitude, longitude].every(value => value !== null && value !== undefined && value !== '')
    ? `${Number(latitude).toFixed(8)}, ${Number(longitude).toFixed(8)}`
    : 'Location not available';
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'Assessor';
  const userPhoto = user?.profilePicture || user?.profile_picture || user?.profileImage || user?.profile_image || user?.avatar;
  const punchInSelfieSource =
    lastPunch?.selfieUrl ||
    lastPunch?.selfie_url ||
    lastPunch?.selfie ||
    lastPunch?.selfieImage ||
    lastPunch?.selfie_image ||
    lastPunch?.imageUrl ||
    lastPunch?.image_url ||
    lastPunch?.image ||
    latestPunchIn?.selfieUrl ||
    latestPunchIn?.selfie_url ||
    latestPunchIn?.selfie;
  const [punchInSelfieUrl, setPunchInSelfieUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let blobUrl = null;

    if (!punchInSelfieSource) {
      setPunchInSelfieUrl(null);
      return undefined;
    }

    const loadPunchInSelfie = async () => {
      blobUrl = await fetchAuthenticatedImageUrl(punchInSelfieSource);
      if (!cancelled) {
        setPunchInSelfieUrl(blobUrl);
      }
    };

    loadPunchInSelfie();

    return () => {
      cancelled = true;
      if (blobUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [punchInSelfieSource]);

  // State for AppSingleParameterQuestionsModal
  const [singleParameterModalOpen, setSingleParameterModalOpen] = useState(false);
  const [singleParameterModalData, setSingleParameterModalData] = useState(null);
  const [singleParameterModalQuestions, setSingleParameterModalQuestions] = useState([]);
  const [singleParameterInitialQuestionIndex, setSingleParameterInitialQuestionIndex] = useState(0);
  // Handler to open AppSingleParameterQuestionsModal
  const handleOpenSingleParameterModal = (parameterData, questions, index) => {
    // parameterData: parameter object
    // questions: array of questions for the parameter
    // index: index of the clicked question
    setSingleParameterModalData(parameterData);
    setSingleParameterModalQuestions(Array.isArray(questions) ? questions : parameterData?.questions || []);
    setSingleParameterInitialQuestionIndex(Number.isFinite(index) ? index : 0);
    setSingleParameterModalOpen(true);
  };

  const handleCloseSingleParameterModal = () => {
    setSingleParameterModalOpen(false);
    setSingleParameterModalData(null);
  };

  // Bind the modal's questions to live Redux state rather than the click-time snapshot: a save
  // refreshes `responses`, so navigating between questions shows the just-saved comment and
  // evidence instead of re-seeding the form from the frozen (pre-save) prop. Falls back to the
  // snapshot until the live parameter is available.
  const singleParameterModalLiveQuestions = useMemo(() => {
    if (!singleParameterModalData) {
      return singleParameterModalQuestions;
    }
    const paramId = singleParameterModalData.id ?? singleParameterModalData.parameterId;
    const liveParam = (responses?.parameters || []).find(param => `${param.id}` === `${paramId}`);
    return liveParam?.questions?.length ? liveParam.questions : singleParameterModalQuestions;
  }, [responses, singleParameterModalData, singleParameterModalQuestions]);

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedProduct(null);
  };

  const handleCloseCustomerModal = () => {
    setCustomerModalOpen(false);
    setSelectedCustomer(null);
  };

  const handleCloseKeyRawMaterialModal = () => {
    setKeyRawMaterialModalOpen(false);
    setSelectedKeyRawMaterial(null);
  };

  const handleAllocate = payload => {
    dispatch(
      bulkAssignParametersAction({
        assessmentId: id,
        data: payload,
      }),
    )
      .unwrap()
      .then(() => {
        dispatch(getParametersAction(id));
        dispatch(getStepProgressAction(id));
        setAllocatedParametersModalOpen(false);
        setShowAllocatedSuccess(true);
        clearTimeout(allocatedSuccessTimeoutRef.current);
        allocatedSuccessTimeoutRef.current = setTimeout(() => setShowAllocatedSuccess(false), 2000);
      })
      .catch(() => undefined);
  };
  return (
    <>
      {canPunchIn && (
        <section className="assessment-status-card assessment-punchCrd assessment-punch-required" aria-label="Punch-in status">
          <div className="assessment-status-card__header">
            <div className="assessment-status-card__title-group">
              <div className={`assessment-status-card__icon${hasAllocation ? '' : ' assessment-status-card__icon--allocation'}`}>
                <img src={hasAllocation ? Icons.greenDocument : Icons.documentText} alt="" />
              </div>
              <div>
                <h2>Parameter Allocation</h2>
                {hasAllocation ? (
                  <p>
                    Lead <strong>{leadAllocatedCount}</strong>
                  </p>
                ) : (
                  <p>Assign parameters among assessors</p>
                )}
              </div>
            </div>
            {hasAllocation ? (
              <button type="button" className="assessment-status-card__allocation-link" onClick={() => setAllocatedParametersModalOpen(true)}>
                View Allocated Parameters
              </button>
            ) : (
              <AppButton title="Assign Parameters" size="medium" variant="primary" customClass="assessment-status-card__assign-parameters" onClick={() => setAllocatedParametersModalOpen(true)} />
            )}
          </div>

          <div className="assessment-status-card__footer">
            <div className="assessment-status-card__title-group">
              <div className="assessment-status-card__icon">
                <img src={Icons.punchIn} alt="" />
              </div>
              <div>
                <h2>Punch-In Required</h2>
                <p>Punch-In to start the assessment</p>
              </div>
            </div>
            <AppButton
              title="Punch-In"
              size="medium"
              variant="success-bg"
              customClass="assessment-status-card__punch-in"
              onClick={() => {
                setPunchModalMode('in');
                setPunchModalOpen(true);
              }}
            />
          </div>
        </section>
      )}
      {serviceExecution && isPunchedIn && (
        <section className="assessment-status-card assessment-punchCrd" aria-label="Assessment status">
          <div className="assessment-status-card__header">
            <div className="assessment-status-card__title-group">
              <div className="assessment-status-card__icon">
                <img src={Icons.greenDocument} alt="" />
              </div>
              <div>
                <h2>Parameter Allocation</h2>
                <p>
                  Lead <strong>{leadAllocatedCount}</strong>
                </p>
              </div>
            </div>
            <button type="button" className="assessment-status-card__allocation-link" onClick={() => setAllocatedParametersModalOpen(true)}>
              View Allocated Parameters
            </button>
          </div>

          <div className="assessment-status-card__footer">
            <div className="assessment-status-card__punch-details">
              <AppAvatar src={punchInSelfieUrl || userPhoto} alt={userName} size="44" role="active-assessor" style={{ width: 44, height: 44 }} />
              <div>
                <p className="assessment-status-card__date">
                  <img src={Icons.calendarFill} alt="" />
                  {lastPunch?.recordedAt ? `${formatDate(lastPunch.recordedAt)}, ${formatTime(lastPunch.recordedAt)}` : 'Punch-in recorded'}
                </p>
                <p className="assessment-status-card__location">
                  <img src={Icons.locationGrey} alt="" />
                  {coordinates}
                </p>
              </div>
            </div>
            <AppButton
              title="Punch-Out"
              type="button"
              variant="danger-secondary"
              customClass="assessment-status-card__punch-out"
              onClick={() => {
                setPunchModalMode('out');
                setPunchModalOpen(true);
              }}
            />
          </div>
        </section>
      )}
      <div className="details-card assessment-tab-main" style={{ borderRadius: '20px', paddingBottom: '25px' }}>
        <div className="row">
          {/* Bootstrap Vertical Tabs */}
          <div className="col-12 col-md-3 border-right assessment-tab-sidebar">
            <ul className="nav flex-column nav-pills py-3 assessment-tab" id="assessment-tab" role="tablist" aria-orientation="vertical">
              {sidebarSteps.map(step => {
                const { completed, locked } = getStepState(step);
                // Manufacturing never shows the yellow "pending" icon — a step is
                // either complete (green) or not-yet (grey). The yellow state is
                // reserved for service's single actionable (punched-in) step.
                const pending = !completed && !locked && serviceExecution;
                return (
                  <li className="nav-item" key={step.number}>
                    <a
                      className={`nav-link ${activeTab === step.number ? 'active' : ''}${locked ? ' disabled' : ''}`}
                      id={`tab-step-${step.number}`}
                      href="#"
                      role="tab"
                      aria-selected={activeTab === step.number}
                      aria-disabled={locked}
                      style={locked ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                      onClick={e => {
                        e.preventDefault();
                        if (locked) {
                          return;
                        }
                        setActiveTab(step.number);
                      }}>
                      <div className={`assessment-tab-number assessment-tab-number--${completed ? 'complete' : pending ? 'pending' : 'disabled'}${activeTab === step.number ? ' active' : ''}`}>
                        <img
                          src={completed ? Icons.greenTickCircle : pending ? Icons.yellowClock : Icons.clockGrey}
                          alt={completed ? 'completed' : pending ? 'pending' : 'disabled'}
                          style={{ width: 20, height: 20 }}
                        />
                      </div>
                      {step.label}
                      {/* {locked && <img src={Icons.lockCircle} alt="locked" className="ms-auto" style={{ width: 16, height: 16 }} />} */}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
          {/* Bootstrap Tab Content */}
          <div className="col-12 col-md-9">
            {activeLocked ? (
              <div className="tab-content padding-left-10 text-center py-5">
                <div className="locked-state-icon">
                  <img src={Icons.lock} alt="locked" />
                </div>
                <p className="fs-16 fw-600 heading-color mb-1">{isPunchedIn || !serviceExecution ? 'Complete the previous steps to unlock this step' : 'Punch in to unlock the assessment'}</p>
                <p className="fs-13 fw-500 text-3-color mb-0">
                  {isPunchedIn || !serviceExecution ? 'Finish your current step before moving on to this one.' : 'Once you punch in, the assessment steps become available for today.'}
                </p>
              </div>
            ) : (
              <div className="tab-content padding-left-10" id="assessment-tabContent">
                {/* Parameter Allocation */}
                {/* <div className={`tab-pane fade${activeTab === 1 ? ' show active' : ''}`} id="tab-pane-1" role="tabpanel" aria-labelledby="tab-step-1">
                  {activeTab === 1 && <ParameterAllocation showQuestionNumbers={true} />}
                </div> */}
                {/* Site Pictures */}
                <div className={`tab-pane fade${activeTab === 2 ? ' show active' : ''}`} id="tab-pane-2" role="tabpanel" aria-labelledby="tab-step-2">
                  {activeTab === 2 && <SitePictures />}
                </div>

                {/* Opening Meeting */}
                <div className={`tab-pane fade${activeTab === 3 ? ' show active' : ''}`} id="tab-pane-3" role="tabpanel" aria-labelledby="tab-step-3">
                  {activeTab === 3 && <OpeningMeeting onEditComment={true} onSaved={goToNextStep} />}
                </div>

                {/* Site Tour */}
                <div className={`tab-pane fade${activeTab === 4 ? ' show active' : ''}`} id="tab-pane-4" role="tabpanel" aria-labelledby="tab-step-4">
                  {activeTab === 4 && <SiteTour />}
                </div>

                {/* Basic Information */}
                <div className={`tab-pane fade${activeTab === 5 ? ' show active' : ''}`} id="tab-pane-5" role="tabpanel" aria-labelledby="tab-step-5">
                  {activeTab === 5 && (
                    <BasicInformation
                      onViewProduct={product => {
                        setSelectedProduct(product);
                        setModalOpen(true);
                      }}
                      onViewCustomer={customer => {
                        setSelectedCustomer(customer);
                        setCustomerModalOpen(true);
                      }}
                      onViewKeyRawMaterial={keyRawMaterial => {
                        setSelectedKeyRawMaterial(keyRawMaterial);
                        setKeyRawMaterialModalOpen(true);
                      }}
                      onSaved={goToNextStep}
                    />
                  )}
                </div>
                {/* Assessment Parameter */}
                <div className={`tab-pane fade${activeTab === 6 ? ' show active' : ''}`} id="tab-pane-6" role="tabpanel" aria-labelledby="tab-step-6">
                  {activeTab === 6 && <AssessmentParameter inProgress={true} onClick={handleOpenSingleParameterModal} />}
                </div>
                {/* Closing Meeting */}
                <div className={`tab-pane fade${activeTab === 7 ? ' show active' : ''}`} id="tab-pane-7" role="tabpanel" aria-labelledby="tab-step-7">
                  {activeTab === 7 && <ClosingMeeting onEditComment={true} onSaved={handleClosingMeetingSaved} />}
                </div>
              </div>
            )}
          </div>
        </div>
        <ProductDetailModal open={modalOpen} onClose={handleCloseModal} product={selectedProduct} />
        <CustomerDetailModal open={customerModalOpen} onClose={handleCloseCustomerModal} customer={selectedCustomer} />
        <KeyRawMaterialModal open={keyRawMaterialModalOpen} onClose={handleCloseKeyRawMaterialModal} product={selectedKeyRawMaterial} />
        <AppAssessorParameterQuestionsModal
          open={singleParameterModalOpen}
          onClose={handleCloseSingleParameterModal}
          parameterData={singleParameterModalData ? [singleParameterModalData] : []}
          questions={singleParameterModalLiveQuestions}
          assessmentId={assessment?.id || assessment?.assessment?.id || assessment?.data?.assessment?.id}
          initialQuestionIndex={singleParameterInitialQuestionIndex}
          Data={true}
          inProgress={true}
          editComment={hasRole(user, 'assessor') && user.id === (singleParameterModalData?.assignedAssessor?.id || singleParameterModalData?.assigned_assessor?.id)}
        />
        {/* <AllocatedParametersModal
          open={allocatedParametersModalOpen}
          onClose={() => setAllocatedParametersModalOpen(false)}
          user={user}
          myAssignedParameterCount={myAssignedParameterCount}
          mandatoryParameters={mandatoryParameters}
          optionalParameters={optionalParameters}
          onAllocate={handleAllocate}
        /> */}
        <AllocatedParametersModal
          open={allocatedParametersModalOpen}
          onClose={() => setAllocatedParametersModalOpen(false)}
          user={user}
          myAssignedParameterCount={myAssignedParameterCount}
          mandatoryParameters={mandatoryParameters}
          optionalParameters={optionalParameters}
          assignments={assignments}
          setAssignments={setAssignments}
          teamMembers={assessment?.teamMembers || parameters?.teamMembers || []}
          loading={bulkAssignLoading}
          onAllocate={handleAllocate}
        />
        <AppModal
          show={showAllocatedSuccess}
          modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
          image={Icons.successCircle}
          header="Parameter Allocated"
          subHeader="Parameter Allocated Successfully."
          disableBackdropClick
        />
        <AppModal
          show={showPunchOutForQcModal}
          handleClose={() => setShowPunchOutForQcModal(false)}
          modalHeaderStyle={{ backgroundColor: 'var(--warning-light)' }}
          image={Icons.warningIcon}
          header="Punch out before submitting for QC"
          subHeader="You have completed the closing meeting. Punch out to finish your field work, then submit the assessment for Quality Check."
          buttonClassName="btn-primary"
        />
        <PunchModal
          open={punchModalOpen}
          onClose={() => setPunchModalOpen(false)}
          mode={punchModalMode}
          assessmentId={id}
          onSuccess={() => {
            dispatch(getMyPunchStatusAction(id));
            dispatch(getAttendanceAction(id));
            // Punch-out flips field-work eligibility (canComplete) server-side, which drives the
            // lead's Submit for QC button — refresh it (and step progress) so the button enables
            // without a page reload.
            dispatch(getFieldCompletionStatusAction(id));
            dispatch(getStepProgressAction(id));
            if (punchModalMode === 'in') {
              onPunchInSuccess?.();
            }
          }}
        />
      </div>
    </>
  );
};

export default AssessmentTab;
