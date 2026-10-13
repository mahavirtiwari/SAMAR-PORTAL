import { useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppBadge, AppButton, AppDataGrid, AppModal } from '../../../../../components/base';
import { ReviewParameterModal } from '../../../../../components/modals';
import Icons from '../../../../../constants/Icons';
import { committeeDecisionAction } from '../../../../../redux/action/common/AssessmentAction';
import { getCommitteeMeetingByIdAction } from '../../../../../redux/action/operationsAdmin/CommitteeMeetingAction';
import { formatParameterScore } from '../../../../../utils/assessmentScoreUtils';
import { getBadgeVariantByLabel } from '../../../../../utils/getStatusColors';
import { Logger } from '../../../../../utils/logger';

const formatAssessmentStatus = status => {
  switch (status) {
    case 'submitted_for_qc':
      return 'Submitted for Quality Check';
    case 'in_progress':
      return 'In Progress';
    case 'committee_feedback':
      return 'Committee Review Feedback';
    case 'ready_for_committee':
      return 'Ready For Committee Review';
    case 'qc_feedback':
      return 'Quality Check Feedback';
    case 'qc':
      return 'Quality Check';
    case 'committee_review':
      return 'Committee Review';
    default:
      return status;
  }
};

const formatMeetingOutcome = decision => {
  switch (decision) {
    case 'certified':
      return 'Certified';
    case 'feedback':
      return 'Feedback';
    case 'pending':
      return 'Pending';
    default:
      return decision || 'Pending';
  }
};

const AssessmentsTab = ({ meetingId, assessments = [], meetingStatus }) => {
  const dispatch = useDispatch();
  const [reviewParameter, setReviewParameter] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ open: false, action: null, assessmentId: null });
  const [actionLoading, setActionLoading] = useState(false);

  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
  const navigate = useNavigate();
  // Map assessment details to table rows
  const rows = useMemo(
    () =>
      assessments.map((assessment, index) => ({
        id: assessment.id || index + 1,
        assessmentId: assessment.id,
        applicationNo: assessment.applicationNumber || '-',
        enterprise: assessment.unitName || 'N/A',
        place: assessment.unitAddress || '',
        sector: assessment.sector || 'N/A',
        unitSize: assessment.enterpriseClassification || 'N/A',
        rating: assessment.rating || 'N/A',
        score: assessment.score || '-',
        rcScore: assessment.rcScore ?? assessment.score,
        assessorScore: assessment.assessorScore,
        assessmentDate: assessment.assessmentStartDate && assessment.assessmentEndDate ? `${assessment.assessmentStartDate} - ${assessment.assessmentEndDate}` : 'N/A',
        status: assessment.status || 'pending',
        decision: assessment.decision || 'pending',
      })),
    [assessments],
  );
  const handleCloseConfirmModal = () => {
    setConfirmModal({ open: false, action: null, assessmentId: null });
  };

  const handleCommitteeDecision = async () => {
    const { action, assessmentId } = confirmModal;
    if (!assessmentId || !action) {
      return;
    }

    setActionLoading(true);
    try {
      await dispatch(
        committeeDecisionAction({
          assessmentId,
          data: { action, remarks: '' },
        }),
      ).unwrap();
      handleCloseConfirmModal();
      // Refresh meeting data to get updated assessment statuses
      if (meetingId) {
        dispatch(getCommitteeMeetingByIdAction({ meetingId }));
      }
    } catch (error) {
      Logger.error('Committee decision failed:', error);
    } finally {
      setActionLoading(false);
    }
  };
  const isMeetingScheduled = meetingStatus === 'scheduled';
  const isMeetingCancelled = meetingStatus === 'cancelled';

  const columns = useMemo(
    () => [
      {
        field: 'action',
        headerName: 'Actions',
        flex: 1.2,
        minWidth: 180,
        sortable: false,
        renderCell: params => {
          const assessmentId = params.row.assessmentId;
          const isDecided = params.row.decision !== 'pending';

          if (isMeetingScheduled || isMeetingCancelled) {
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AppButton variant="primary" size="extraSmall" title={isDecided ? 'View' : 'Review'} disabled />
              </div>
            );
          }
          const buttonTitle = isDecided ? 'View' : 'Review';
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AppButton
                variant={'secondary'}
                size="extraSmall"
                title={buttonTitle}
                onClick={() => {
                  if (isDecided) {
                    navigate(`/rating-committee/meetings/view-assessment-parameter/${assessmentId}`, {
                      state: { assessmentId },
                    });
                  } else if (params.row) {
                    setSelectedAssessment(params.row);
                    setReviewParameter(true);
                  }
                }}
              />
            </div>
          );
        },
      },
      {
        field: 'applicationNo',
        headerName: 'Application Number',
        flex: 1.2,
        minWidth: 160,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4>{params.row.applicationNo}</h4>
            <div className="d-flex align-items-center">
              <span className={`text-capitalize ${params.row.sector === 'manufacturing' ? 'primary-color' : 'badge-purple-color'}`}>{params.row.sector}</span>
              <div className="dot-separator-small"></div>
              <span className="text-3-color text-capitalize">{params.row.unitSize === 'startup' ? 'Start-Up' : params.row.unitSize}</span>
            </div>
          </div>
        ),
      },
      {
        field: 'enterprise',
        headerName: 'Enterprise/Unit Name',
        flex: 1.4,
        minWidth: 120,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4>{params.row.enterprise}</h4>

            <h4 className="text-3-color line-clamp fs-400"> {params.row.place}</h4>
          </div>
        ),
      },
      {
        field: 'score',
        headerName: 'Score',
        flex: 1,
        minWidth: 90,
        sortable: false,
        // Once certified the committee's RC Score is authoritative — labeled "RC Score"
        // regardless of sector; before that (pending / sent back) show the assessor's
        // own SA/RA Score by sector.
        renderCell: params => {
          const isCertified = params.row.decision === 'certified';
          const isService = params.row.sector === 'service';
          const value = isCertified ? params.row.rcScore : params.row.assessorScore;
          const label = isCertified ? 'RC Score' : isService ? 'RA Score' : 'SA Score';
          return (
            <div className="double-content">
              <h4>{formatParameterScore(value)}</h4>
              <h4 className="text-3-color fs-400">{label}</h4>
            </div>
          );
        },
      },
      {
        field: 'rating',
        headerName: 'Rating',
        flex: 1,
        minWidth: 80,
        sortable: false,
        // Rating is issued only after Certify — never shown before.
        renderCell: params => <span>{params.row.decision === 'certified' ? params.row.rating : '-'}</span>,
      },

      {
        field: 'status',
        headerName: 'Current Status',
        minWidth: 160,
        sortable: false,
        renderCell: params => {
          return <AppBadge variant={getBadgeVariantByLabel(params.row.status)} label={formatAssessmentStatus(params.row.status)} />;
        },
      },
      {
        field: 'decision',
        headerName: 'Meeting Outcome',
        minWidth: 150,
        sortable: false,
        renderCell: params => {
          return <AppBadge variant={getBadgeVariantByLabel(params.row.decision)} label={formatMeetingOutcome(params.row.decision)} />;
        },
      },
    ],
    [navigate, isMeetingScheduled, isMeetingCancelled],
  );

  return (
    <div className="row">
      <div className="col-12">
        <div className="table-container">
          <div className="table-header">
            <div className="table-header-left">
              <h1 className="page-heading">Assessments to Review</h1>
              <span className="text-3-color fs-14 ms-2">({rows.length} assessments)</span>
            </div>
          </div>

          <div className="table-wrapper">
            <AppDataGrid
              rows={rows}
              columns={columns}
              server={false}
              page={paginationModel.page + 1}
              pageSize={paginationModel.pageSize}
              onPaginationChange={model => setPaginationModel({ page: model.page - 1, pageSize: model.pageSize })}
            />
          </div>
        </div>
      </div>

      <ReviewParameterModal open={reviewParameter} handleClose={() => setReviewParameter(false)} assessmentData={selectedAssessment} />

      {/* Confirm Modal for Certify/Feedback */}
      <AppModal
        modalHeaderStyle={{ backgroundColor: confirmModal.action === 'certify' ? 'var(--success-light)' : 'var(--warning-light)' }}
        image={confirmModal.action === 'certify' ? Icons.successIcon : Icons.warningIcon}
        show={confirmModal.open}
        handleClose={handleCloseConfirmModal}
        header={confirmModal.action === 'certify' ? 'Certify Assessment?' : 'Provide Feedback?'}
        subHeader={confirmModal.action === 'certify' ? 'The assessment status will be locked once certified.' : 'The assessment will be sent back to the assessor to address the committee feedback.'}
        twoButtons
        leftButton="Cancel"
        leftButtonClassName="w-100 tertiary"
        leftButtonOnClick={handleCloseConfirmModal}
        rightButton={confirmModal.action === 'certify' ? 'Certify' : 'Send Feedback'}
        rightButtonClassName={confirmModal.action === 'certify' ? 'w-100 btn-success' : 'w-100 btn-primary'}
        rightButtonOnClick={handleCommitteeDecision}
        rightButtonLoading={actionLoading}
        rightButtonDisabled={actionLoading}
      />
    </div>
  );
};

export default AssessmentsTab;
