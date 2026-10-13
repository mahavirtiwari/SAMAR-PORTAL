import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { AppBadge, AppButton, AppDataGrid, AppModal } from '../../../../../components/base';
import { Layout } from '../../../../../components/layout';
import AppCommonModal from '../../../../../components/modals/AppCommonModal';
import Icons from '../../../../../constants/Icons';
import { completeCommitteeMeetingAction, getCommitteeMeetingByIdAction, startCommitteeMeetingAction } from '../../../../../redux/action/operationsAdmin/CommitteeMeetingAction';
import { clearCurrentMeeting } from '../../../../../redux/slices/operationsAdmin/CommitteeMeetingSlice';
import { formatDate, formatTime } from '../../../../../utils/formatters';
import { Logger } from '../../../../../utils/logger';
import AssessmentsTab from './AssessmentsTab';

const memberColumns = [
  { field: 'name', headerName: 'Member Name', flex: 1.5, minWidth: 150, sortable: false },
  {
    field: 'contact',
    headerName: 'Contact',
    flex: 1.5,
    minWidth: 200,
    sortable: false,
    renderCell: params => (
      <div className="double-content">
        <h4>{params.row.contact}</h4>
        <span>
          <a href={`mailto:${params.row.email}`} className="info-primary-color text-decoration-none">
            {params.row.email}
          </a>
        </span>
      </div>
    ),
  },
  { field: 'org', headerName: 'Organisation', flex: 1, minWidth: 150, sortable: false },
  { field: 'designation', headerName: 'Designation', flex: 1, minWidth: 150, sortable: false },
];

const MeetingsDetails = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { meetingId } = useParams();

  // ===================== REDUX STATE =====================
  const { currentMeeting, currentMeetingLoading, startLoading, completeLoading } = useSelector(state => state.CommitteeMeeting);
  // ===================== LOCAL STATES =====================
  const [modalOpen, setModalOpen] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [endMeetingModal, setEndMeetingModal] = useState(false);
  const [endSuccessModal, setEndSuccessModal] = useState(false);
  const [meetingNotes, setMeetingNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const [memberPagination, setMemberPagination] = useState({ page: 1, pageSize: 100 });
  // ===================== EFFECTS =====================
  useEffect(() => {
    if (meetingId) {
      dispatch(getCommitteeMeetingByIdAction({ meetingId }));
    }
    return () => {
      dispatch(clearCurrentMeeting());
    };
  }, [dispatch, meetingId]);

  // ===================== HANDLERS =====================
  const handleCloseMembersModal = () => setModalOpen(false);

  const handleSubmitClick = () => setShowSubmitModal(true);
  const handleCloseSubmitModal = () => setShowSubmitModal(false);

  const handleStartMeeting = async () => {
    try {
      await dispatch(startCommitteeMeetingAction({ meetingId })).unwrap();
      setShowSubmitModal(false);
      // Re-fetch full meeting details because start response may not include assessmentDetails
      try {
        await dispatch(getCommitteeMeetingByIdAction({ meetingId })).unwrap();
      } catch (err) {
        Logger.error('Failed to reload meeting after start:', err);
      }
      // Optionally navigate to review or stay on page
    } catch (error) {
      Logger.error('Failed to start meeting:', error);
    }
  };

  const handleOpenEndMeeting = () => setEndMeetingModal(true);

  const handleCloseEndMeeting = () => {
    setEndMeetingModal(false);
    setMeetingNotes('');
  };

  const handleConfirmEndMeeting = async () => {
    let completed = false;
    try {
      await dispatch(
        completeCommitteeMeetingAction({
          meetingId,
          payload: { minutes: meetingNotes },
        }),
      ).unwrap();
      completed = true;
    } catch (error) {
      Logger.error('Failed to complete meeting:', error);
    }

    setEndMeetingModal(false);

    // Reconcile the UI with the backend regardless of outcome: the complete response may not
    // carry the new status, and a client-side timeout can mask a complete the backend already
    // finished. Re-fetching (as Start does) flips isCompleted without a manual refresh.
    try {
      await dispatch(getCommitteeMeetingByIdAction({ meetingId })).unwrap();
    } catch (err) {
      Logger.error('Failed to reload meeting after complete:', err);
    }

    if (completed) {
      setMeetingNotes('');
      setEndSuccessModal(true);
      setTimeout(() => setEndSuccessModal(false), 1000);
    }
  };

  const handleCopyLink = async () => {
    try {
      const link = meeting?.meetingLink;
      if (!link) {
        return;
      }
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      Logger.error('Failed to copy link:', err);
    }
  };

  const handleJoinMeeting = () => {
    try {
      const link = meeting?.meetingLink;
      if (!link) {
        Logger.warn('No meeting link available to join');
        return;
      }
      window.open(link, '_blank', 'noopener,noreferrer');
    } catch (err) {
      Logger.error('Failed to open meeting link:', err);
    }
  };

  // ===================== DERIVED DATA =====================
  const meeting = currentMeeting;
  const isScheduled = meeting?.status === 'scheduled';
  const isInProgress = meeting?.status === 'in_progress';
  const isCompleted = meeting?.status === 'completed';

  // End Meeting is gated on the per-meeting pivot decision, not the assessment's global status.
  // An assessment can drift back to ready_for_committee (e.g. assessor responds to a send-back)
  // while its decision on THIS meeting is already recorded — the meeting is still completable.
  const allAssessmentsDecided = (meeting?.assessmentDetails || []).length > 0 && (meeting?.assessmentDetails || []).every(a => a?.decision && a.decision !== 'pending');

  // Get chair and convenor - check both detailed responses and member list
  const chairDetails = meeting?.chairDetails;
  const convenorDetails = meeting?.convenorDetails;
  // Fallback to finding in memberDetails array
  const chairFromMembers = meeting?.memberDetails?.find(m => m.role === 'chair');
  const convenorFromMembers = meeting?.memberDetails?.find(m => m.role === 'convenor');
  const chair = chairDetails || chairFromMembers;
  const convenor = convenorDetails || convenorFromMembers;

  // ===================== TABLE DATA =====================
  // Use memberDetails for the detailed member information
  const memberRows = useMemo(
    () =>
      (meeting?.memberDetails || []).map((member, index) => ({
        id: member.id || index + 1,
        name: member.name || 'N/A',
        contact: member.phone || 'N/A',
        email: member.email || 'N/A',
        org: member.organization || 'N/A',
        designation: member.designation || member.role || 'N/A',
      })),
    [meeting?.memberDetails],
  );

  const getMode = mode => {
    switch (mode) {
      case 'Online':
        return 'green';
      case 'Offline':
        return 'blue';
      default:
        return 'gray';
    }
  };
  const getModeIcon = mode => {
    switch (mode) {
      case 'Online':
        return Icons.online;
      case 'Offline':
        return Icons.offline;
      default:
        return null;
    }
  };

  if (currentMeetingLoading) {
    return (
      <Layout
        isSubHeader
        subHeader={
          <div className="subHeaderWrapper">
            <div className="subHeaderLeft">
              <img src={Icons.back} alt="back" className="icon-24" onClick={() => navigate(-1)} />
              <div className="heading-seperator"></div>
              <h1 className="heading-createApp">Meeting Details</h1>
            </div>
          </div>
        }>
        <div className="main-content-inner">
          <div className="container">
            <div className="row">
              <div className="col-12">
                <div className="details-card">
                  <p>Loading meeting details...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      isSubHeader
      subHeader={
        <div className="subHeaderWrapper">
          <div className="subHeaderLeft">
            <img src={Icons.back} alt="back" className="icon-24" onClick={() => navigate(-1)} />
            <div className="heading-seperator"></div>
            <h1 className="heading-createApp">Meeting Details</h1>
            <div className="subHeaderRightBx">
              <ul className="breadCrumbHeader">
                <li className="margin-left-30">Committee Meetings</li>
                <div className="dot-separator" />
                <li>Meeting Details</li>

                {isCompleted && (
                  <div className="margin-left-16">
                    <AppBadge variant="green" label="Meeting Completed" />
                  </div>
                )}
                {isInProgress && (
                  <div className="margin-left-16">
                    <AppBadge variant="yellow" label="Meeting In Progress" />
                  </div>
                )}
                {isScheduled && (
                  <div className="margin-left-16">
                    <AppBadge variant="blue" label="Meeting Scheduled" />
                  </div>
                )}
              </ul>
            </div>
          </div>
        </div>
      }>
      <div className="main-content-inner">
        <div className="container">
          <div className="row">
            <div className="col-12">
              {/* ===================== DETAILS CARD ===================== */}
              <div className="details-card">
                <div className="top-details-card">
                  <div className="top-details-card-content flex-grow-1">
                    <div className="top-left-details-card scheduleMeetingProfile">
                      <img src={Icons.meetingIcon} alt="MeetingAssessment" className="icon-46" />
                    </div>

                    <div className="top-right-details-card pl-20">
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="w-100">
                          <div className="d-flex justify-content-between w-100">
                            <div>
                              <div className="d-flex align-items-center gap-8">
                                <h4 className="fs-24 fw-600 heading-color mb-0">{meeting?.title || meeting?.title || 'N/A'}</h4>
                                <AppBadge circular variant={getMode(meeting?.meetingType)} label={meeting?.meetingType} icon={getModeIcon(meeting?.meetingType)} />
                              </div>
                            </div>
                            {meeting?.meetingType === 'Online' && (
                              <div className="d-flex gap-8">
                                <div className="d-flex flex-column align-items-center">
                                  <AppButton variant="secondary" size="small" title="Copy Link" onClick={handleCopyLink} />
                                  {copied && <span className="fs-12 primary-color mt-1">Copied</span>}
                                </div>
                                <AppButton variant="primary" size="small" title="Join" leftIcon={Icons.videoIcon} onClick={handleJoinMeeting} />
                              </div>
                            )}
                          </div>
                          {meeting?.venue && (
                            <div className="d-flex align-items-center margin-top-2">
                              <img src={Icons.location} className="icon-20" />
                              <span className="margin-left-8 fs-14 fw-500 heading-color">{meeting?.venue}</span>
                            </div>
                          )}
                          <div className="d-flex align-items-center gap-32 margin-top-16 custom-gap-style custom-flex-wrap">
                            <div className="d-flex align-items-center gap-8">
                              <img src={Icons.user} className="icon-24" alt="icon" />
                              <div className="d-flex flex-column">
                                <span className="fs-12 fw-500 text-3-color">Chair</span>
                                <span className="fs-14 fw-500 heading-color">{chair?.name || meeting?.organizer?.name || 'N/A'}</span>
                              </div>
                            </div>

                            <div className="vertical-divider margin-left-30 margin-right-30" />

                            <div className="d-flex align-items-center gap-8">
                              <img src={Icons.blueUserProfile} className="icon-24" alt="icon" />
                              <div className="d-flex flex-column">
                                <span className="fs-12 fw-500 text-3-color">Convenor</span>
                                <span className="fs-14 fw-500 heading-color">{convenor?.name || 'N/A'}</span>
                              </div>
                            </div>

                            <div className="vertical-divider margin-left-30 margin-right-30" />

                            <div className="d-flex align-items-center gap-8">
                              <img src={Icons.calendarBlue} className="icon-24" alt="icon" />
                              <div className="d-flex flex-column">
                                <span className="fs-12 fw-500 text-3-color">Committee Members</span>
                                <a
                                  href="#"
                                  className="fs-14 fw-500 info-primary-color text-decoration-none"
                                  onClick={e => {
                                    e.preventDefault();
                                    setModalOpen(true);
                                  }}>
                                  View ({meeting?.memberDetails?.length || meeting?.membersCount || 0})
                                </a>
                              </div>
                            </div>

                            <div className="vertical-divider margin-left-30 margin-right-30" />

                            <div className="d-flex align-items-center gap-8">
                              <img src={Icons.calendarBlue} className="icon-24" alt="icon" />
                              <div className="d-flex flex-column">
                                <span className="fs-12 fw-500 text-3-color">Date & Time</span>
                                <span className="fs-14 fw-500 heading-color">
                                  {meeting?.date ? formatDate(meeting.date) : 'N/A'}
                                  {meeting?.time ? `, ${formatTime(meeting.time)}` : ''}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {meeting?.remarks && <p className="fs-12 fw-500 text-3-color mb-0 margin-top-20 padding-bottom-14">{meeting?.remarks}</p>}
                {(isScheduled || isInProgress) && <hr className="divider-small" />}

                <div className="d-flex gap-12">
                  {isScheduled && <AppButton variant="success" title="Start Meeting" onClick={handleSubmitClick} loading={startLoading} disabled={startLoading} />}
                  {isInProgress && <AppButton variant="danger-secondary" title="End Meeting" onClick={handleOpenEndMeeting} loading={completeLoading} disabled={!allAssessmentsDecided} />}
                </div>
              </div>

              {/* ===================== ASSESSMENTS ===================== */}
              <div className="details-card p-0">
                <AssessmentsTab meetingId={meetingId} assessments={meeting?.assessmentDetails || []} meetingStatus={meeting?.status} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== MODALS ===================== */}

      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--warning-light)' }}
        image={Icons.warningIcon}
        show={showSubmitModal}
        handleClose={handleCloseSubmitModal}
        header="Start Committee Review?"
        subHeader="You can now review assessments and either certify them or mark them for send back."
        twoButtons
        leftButton="Cancel"
        leftButtonClassName="w-100 tertiary"
        leftButtonOnClick={handleCloseSubmitModal}
        rightButton="Start"
        rightButtonClassName="w-100 btn-primary"
        rightButtonOnClick={handleStartMeeting}
        rightButtonLoading={startLoading}
        rightButtonDisabled={startLoading}
      />

      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--warning-light)' }}
        image={Icons.warningIcon}
        show={endMeetingModal}
        handleClose={handleCloseEndMeeting}
        header="End Meeting?"
        subHeader="Approved assessments will be certified. Assessments marked for clarification will be sent back to assessors. This cannot be undone."
        textAreaLabel="Meeting Notes"
        textAreaPlaceholder="Enter Meeting Notes"
        textAreaValue={meetingNotes}
        onTextAreaChange={e => setMeetingNotes(e.target.value)}
        twoButtons
        leftButton="Cancel"
        leftButtonClassName="w-100 tertiary"
        leftButtonOnClick={handleCloseEndMeeting}
        rightButton="End Meeting"
        rightButtonClassName="w-100 danger-primary"
        rightButtonOnClick={handleConfirmEndMeeting}
        rightButtonLoading={completeLoading}
        rightButtonDisabled={completeLoading}
      />

      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        show={endSuccessModal}
        image={Icons.successCircle}
        header="Meeting Ended Successfully"
        subHeader=""
        handleClose={() => setEndSuccessModal(false)}
      />

      <AppCommonModal
        open={modalOpen}
        onClose={handleCloseMembersModal}
        modalHeader="Committee Members"
        modalContent={
          <AppDataGrid rows={memberRows} columns={memberColumns} server={false} page={memberPagination.page} pageSize={memberPagination.pageSize} onPaginationChange={setMemberPagination} />
        }
        paperSx={{
          width: { xs: '100%', sm: '90%', md: '700px', lg: '800px' },
          maxWidth: '98vw',
        }}
      />
    </Layout>
  );
};

export default MeetingsDetails;
