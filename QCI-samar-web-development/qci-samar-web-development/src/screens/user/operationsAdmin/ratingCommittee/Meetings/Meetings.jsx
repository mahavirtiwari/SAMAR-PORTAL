import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppBadge, AppButton, AppDataGrid, AppInput } from '../../../../../components/base';
import { toastError } from '../../../../../components/base/toast';
import { Layout } from '../../../../../components/layout';
import { AddMeetingModal, AppModal } from '../../../../../components/modals';
import EditMeetingModal from '../../../../../components/modals/EditMeetingModal';
import Icons from '../../../../../constants/Icons';
import { cancelCommitteeMeetingAction, getCommitteeMeetingsAction } from '../../../../../redux/action/operationsAdmin/CommitteeMeetingAction';
import { getCommitteeMembersAction } from '../../../../../redux/action/operationsAdmin/CommitteeMemberAction';
import { formatDate, formatTime } from '../../../../../utils/formatters';

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

const getStatusBadge = status => {
  switch (status) {
    case 'scheduled':
      return { variant: 'blue', label: 'Scheduled' };
    case 'in_progress':
      return { variant: 'yellow', label: 'In Progress' };
    case 'completed':
      return { variant: 'green', label: 'Completed' };
    case 'cancelled':
      return { variant: 'red', label: 'Cancelled' };
    default:
      return { variant: 'gray', label: status || 'Unknown' };
  }
};

const Meetings = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [addMeetingModal, setAddMeetingModal] = useState(false);
  const [editMeetingModal, setEditMeetingModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [meetingToCancel, setMeetingToCancel] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
  const [rejectReason, setRejectReason] = useState('');

  // Get meetings from Redux state
  const { meetings, meetingsPagination, meetingsLoading, cancelLoading } = useSelector(state => state.CommitteeMeeting || {});
  const { members } = useSelector(state => state.CommitteeMember || {});

  const handleGeneralError = message => toastError(message, { duration: 6000 });

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 400);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  // Members feed the Add Meeting modal's pickers, not the grid, so they load once and
  // must not follow the meetings page.
  useEffect(() => {
    dispatch(getCommitteeMembersAction({ params: { page: 1, perPage: 100 } }));
  }, [dispatch]);
  // Fetch meetings on mount and when pagination changes
  useEffect(() => {
    dispatch(
      getCommitteeMeetingsAction({
        params: {
          page: paginationModel.page + 1,
          perPage: paginationModel.pageSize,
          search: debouncedSearchQuery || undefined,
        },
      }),
    );
  }, [dispatch, paginationModel.page, paginationModel.pageSize, debouncedSearchQuery]);

  const handleAddMeeting = () => {
    setAddMeetingModal(true);
  };

  const handleEditMeeting = meeting => {
    setSelectedMeeting(meeting);
    setEditMeetingModal(true);
  };

  const handleOpenCancelModal = meeting => {
    setMeetingToCancel(meeting);
    setShowCancelModal(true);
  };

  const handleCloseCancelModal = () => {
    setShowCancelModal(false);
    setMeetingToCancel(null);
    setRejectReason('');
  };

  const handleConfirmCancel = async () => {
    if (!meetingToCancel?.id || !rejectReason.trim()) {
      return;
    }
    try {
      await dispatch(cancelCommitteeMeetingAction({ meetingId: meetingToCancel.id, reason: rejectReason.trim() }));
      handleCloseCancelModal();
      refreshMeetings();
    } catch {
      // swallow - action may dispatch errors to store
    }
  };

  const refreshMeetings = () => {
    dispatch(
      getCommitteeMeetingsAction({
        params: {
          page: paginationModel.page + 1,
          perPage: paginationModel.pageSize,
          search: debouncedSearchQuery || undefined,
        },
      }),
    );
  };

  // normalize rows: API may return items as { meeting: {...} } or direct meeting objects
  const tableRows = useMemo(
    () =>
      Array.isArray(meetings)
        ? meetings.map((m, idx) => {
            const item = m?.meeting ? m.meeting : m || {};
            return { id: item.id ?? item.meetingId ?? `row-${idx}`, ...item };
          })
        : [],
    [meetings],
  );

  const columns = useMemo(
    () => [
      {
        field: 'action',
        headerName: 'Actions',
        flex: 1.6,
        minWidth: 160,
        sortable: false,
        renderCell: params => (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <AppButton variant="secondary" size="extraSmall" title={'View'} onClick={() => navigate(`/rating-committee/meetings/meeting-details/${params.row.id}`)} />
            <div className="gap-8 d-flex align-items-center margin-left-8">
              <AppButton
                variant="secondary"
                size="extraSmall"
                leftIconStyle={'icon-14 me-0'}
                leftIcon={Icons.edit}
                buttonPaddingX="0"
                minWidth={30}
                onClick={() => handleEditMeeting(params.row)}
                disabled={params.row.status === 'completed' || params.row.status === 'in_progress' || params.row.status === 'cancelled'}
              />
              <AppButton
                variant="danger-secondary"
                size="extraSmall"
                leftIconStyle={'icon-14 me-0'}
                leftIcon={Icons.cancelBtn}
                buttonPaddingX="0"
                minWidth={30}
                onClick={() => handleOpenCancelModal(params.row)}
                disabled={cancelLoading || params.row.status === 'completed' || params.row.status === 'in_progress' || params.row.status === 'cancelled'}
              />
            </div>
          </div>
        ),
      },
      {
        field: 'title',
        headerName: 'Meeting Title',
        flex: 1.8,
        minWidth: 150,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4>{params.row.title || 'N/A'}</h4>
          </div>
        ),
      },
      {
        field: 'assessmentsCount',
        headerName: 'Assessments',
        flex: 0.8,
        minWidth: 100,
        sortable: false,
        renderCell: params => <span>{params.row.assessmentsCount ?? 0}</span>,
      },
      {
        field: 'meetingType',
        headerName: 'Mode',
        flex: 1,
        minWidth: 120,
        sortable: false,
        renderCell: params => <AppBadge circular variant={getMode(params.value)} label={params.value} icon={getModeIcon(params.value)} />,
      },
      {
        field: 'date',
        headerName: 'Date & Time',
        flex: 1.2,
        minWidth: 150,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4>{params.row.date ? formatDate(params.row.date) : 'N/A'}</h4>
            <span>{params.row.time ? formatTime(params.row.time) : ''}</span>
          </div>
        ),
      },
      {
        field: 'status',
        headerName: 'Status',
        flex: 1,
        minWidth: 120,
        sortable: false,
        renderCell: params => {
          const badge = getStatusBadge(params.value);
          return <AppBadge variant={badge.variant} label={badge.label} />;
        },
      },
    ],
    [navigate, cancelLoading],
  );
  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="table-container">
                <div className="table-header">
                  <div className="table-header-left">
                    <h1 className="page-heading">Committee Meetings</h1>
                    <div className="input-search-document">
                      <AppInput
                        label={'Search'}
                        inputType="search"
                        name="search"
                        customInputClass={'search-input'}
                        value={searchQuery}
                        onChange={e => {
                          setSearchQuery(e.target.value);
                          setPaginationModel(prev => (prev.page === 0 ? prev : { ...prev, page: 0 }));
                        }}
                        placeholder="Search by meeting title"
                        customWidth="100%"
                        leftIcon={Icons.search}
                        marginLeft="6px"
                      />
                    </div>
                  </div>
                  <div className="table-header-right">
                    <AppButton variant="primary" size="small" title={'Add Meeting'} leftIcon={Icons.whiteAdd} leftIconStyle={'icon-14'} onClick={() => handleAddMeeting()} />
                  </div>
                </div>

                <div className="table-wrapper">
                  <AppDataGrid
                    rows={tableRows}
                    columns={columns}
                    loading={meetingsLoading}
                    rowCount={meetingsPagination?.total || 0}
                    page={paginationModel.page + 1}
                    pageSize={paginationModel.pageSize}
                    onPaginationChange={model => setPaginationModel({ page: model.page - 1, pageSize: model.pageSize })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <AddMeetingModal
        open={addMeetingModal}
        members={members}
        onGeneralError={handleGeneralError}
        handleClose={() => {
          setAddMeetingModal(false);
          refreshMeetings();
        }}
      />
      <EditMeetingModal
        open={editMeetingModal}
        meeting={selectedMeeting}
        onGeneralError={handleGeneralError}
        handleClose={() => {
          setEditMeetingModal(false);
          setSelectedMeeting(null);
          refreshMeetings();
        }}
      />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--danger-light)' }}
        image={Icons.redConfirmIcon}
        show={showCancelModal}
        handleClose={handleCloseCancelModal}
        header={'Confirm Cancellation?'}
        subHeader={'The meeting will be removed and all participants will be notified.'}
        textAreaLabel={'Reason for Cancellation'}
        textAreaPlaceholder={'Please provide a brief reason for the cancellation'}
        textAreaValue={rejectReason}
        onTextAreaChange={e => setRejectReason(e.target.value)}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonOnClick={handleCloseCancelModal}
        rightButton={'Cancel Meeting'}
        isRequiredTextArea
        rightButtonClassName={'w-100 danger-primary'}
        rightButtonOnClick={handleConfirmCancel}
        rightButtonLoading={cancelLoading}
        rightButtonDisabled={!rejectReason.trim()}
      />
    </Layout>
  );
};

export default Meetings;
