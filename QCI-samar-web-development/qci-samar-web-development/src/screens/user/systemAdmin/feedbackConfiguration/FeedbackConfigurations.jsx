import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { AppBadge, AppButton, AppDataGrid, AppModal, AppToolTip } from '../../../../components/base';
import ListSearchBox from '../../../../components/base/ListSearchBox';
import { toastError } from '../../../../components/base/toast';
import { Layout } from '../../../../components/layout';
import { AddFeedbackConfigurationModal, EditFeedbackConfigurationModal } from '../../../../components/modals';
import { MESSAGE_DISPLAY_DELAY_MS } from '../../../../constants/appConstants';
import Icons from '../../../../constants/Icons';
import { activateFeedbackQuestionAction, deactivateFeedbackQuestionAction, getFeedbackQuestionsAction } from '../../../../redux/action/systemAdmin/FeedbackAction';
import { resetActivateDeactivateState } from '../../../../redux/slices/systemAdmin/FeedbackSlice';
import { getBadgeVariantByLabel } from '../../../../utils/getStatusColors';

const getFeedbackRowId = row => row.id || row.user_id;

const FeedbackConfigurations = () => {
  const dispatch = useDispatch();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    unitStatus: '',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [_snackbarMessage, setSnackbarMessage] = useState('');
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [selectedFeedbackQuestion, setSelectedFeedbackQuestion] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const { feedbackQuestions, feedbackQuestionsLoading, activateLoading, activateError, activatedFeedbackQuestion, deactivateLoading, deactivateError, deactivatedFeedbackQuestion } = useSelector(
    state => state.SystemAdminFeedback,
  );

  const handleGeneralError = errorMessage => {
    setSnackbarMessage(errorMessage);
    toastError(errorMessage);
  };

  // Fetch feedback questions
  useEffect(() => {
    const filtersData = {
      search: filters.search,
      status: filters?.unitStatus,
      perPage: pageSize,
      page: page,
    };
    dispatch(getFeedbackQuestionsAction(filtersData));
  }, [dispatch, page, pageSize, filters]);

  // Open edit modal when selectedItem is set
  useEffect(() => {
    if (selectedItem) {
      setShowEditModal(true);
    }
  }, [selectedItem]);

  const handleCloseModal = () => {
    setShowAddModal(false);
  };

  const handleEditItem = useCallback(item => {
    setSelectedItem(item);
  }, []);

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedItem(null);
  };

  const handleActivate = useCallback(row => {
    setSelectedFeedbackQuestion(row);
    setShowActivateModal(true);
  }, []);

  const handleDeactivate = useCallback(row => {
    setSelectedFeedbackQuestion(row);
    setShowDeactivateModal(true);
  }, []);

  const confirmActivate = () => {
    if (selectedFeedbackQuestion) {
      dispatch(activateFeedbackQuestionAction(selectedFeedbackQuestion.id));
    }
  };

  const confirmDeactivate = () => {
    if (selectedFeedbackQuestion) {
      dispatch(deactivateFeedbackQuestionAction(selectedFeedbackQuestion.id));
    }
  };

  // Handle activate/deactivate success
  useEffect(() => {
    if (activatedFeedbackQuestion) {
      setShowActivateModal(false);
      setSelectedFeedbackQuestion(null);
      setSuccessMessage('Feedback question activated successfully');
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), MESSAGE_DISPLAY_DELAY_MS);
      dispatch(resetActivateDeactivateState());
      dispatch(getFeedbackQuestionsAction({ search: filters.search, status: filters?.unitStatus, perPage: pageSize, page }));
    }
    if (deactivatedFeedbackQuestion) {
      setShowDeactivateModal(false);
      setSelectedFeedbackQuestion(null);
      setSuccessMessage('Feedback question deactivated successfully');
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), MESSAGE_DISPLAY_DELAY_MS);
      dispatch(resetActivateDeactivateState());
      dispatch(getFeedbackQuestionsAction({ search: filters.search, status: filters?.unitStatus, perPage: pageSize, page }));
    }
  }, [activatedFeedbackQuestion, deactivatedFeedbackQuestion, dispatch, filters.search, filters.unitStatus, pageSize, page]);

  // Handle activate/deactivate errors
  useEffect(() => {
    if (activateError) {
      queueMicrotask(() => handleGeneralError(`Error activating feedback question: ${activateError}`));
      dispatch(resetActivateDeactivateState());
    }
    if (deactivateError) {
      queueMicrotask(() => handleGeneralError(`Error deactivating feedback question: ${deactivateError}`));
      dispatch(resetActivateDeactivateState());
    }
  }, [activateError, deactivateError, dispatch]);
  const columns = useMemo(
    () => [
      {
        field: 'action',
        headerName: 'Actions',
        width: 130,
        sortable: false,
        renderCell: params => (
          <div className="gap-8 d-flex align-items-center">
            <AppButton variant="secondary" title={'Edit'} size="extraSmall" onClick={() => handleEditItem(params.row)} />
            <div className="toggle-btns d-flex">
              {params.row.isActive ? (
                <AppToolTip title="Deactivate Feedback Question">
                  <Image src={Icons.active} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleDeactivate(params.row)} />
                </AppToolTip>
              ) : (
                <AppToolTip title="Activate Feedback Question">
                  <Image src={Icons.inactive} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleActivate(params.row)} />
                </AppToolTip>
              )}
            </div>
          </div>
        ),
      },

      {
        field: 'questionText',
        headerName: 'Feedback Question',
        flex: 3,
        minWidth: 260,
        sortable: false,

        renderCell: params => (
          <div className="d-flex align-items-center">
            <p className="fs-14 fw-500 text-2-color mb-0 line-clamp" title={params.row.questionText}>
              {params.row.questionText}
            </p>
          </div>
        ),
      },
      {
        field: 'type',
        headerName: 'Type',
        flex: 0.8,
        minWidth: 110,
        sortable: false,

        renderCell: params => (
          <div className="d-flex align-items-center">
            <span className="app-chip-type">{params.row.type === 'yes_no' ? 'Yes/No' : params.row.type?.charAt(0).toUpperCase() + params.row.type?.slice(1)}</span>
          </div>
        ),
      },

      {
        field: 'status',
        headerName: 'Status',
        flex: 0.7,
        minWidth: 110,
        sortable: false,
        renderCell: params => {
          return <AppBadge variant={getBadgeVariantByLabel(params.row?.isActive ? 'Active' : 'Inactive')} label={params.row?.isActive ? 'Active' : 'Inactive'} />;
        },
      },
    ],
    [handleEditItem, handleActivate, handleDeactivate],
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
                    <h1 className="page-heading">Feedback Configuration</h1>
                    <div className="input-search-document">
                      <ListSearchBox
                        value={filters.search}
                        placeholder="Search feedback questions"
                        onSearch={value => {
                          setFilters(prev => ({ ...prev, search: value }));
                          setPage(1);
                        }}
                      />
                    </div>
                  </div>
                  <div className="table-header-right">
                    <AppButton variant="primary" size="small" title={'Add New'} onClick={() => setShowAddModal(true)} />
                  </div>
                </div>

                <div className="table-wrapper">
                  <AppDataGrid
                    rows={feedbackQuestions?.data || []}
                    columns={columns}
                    rowCount={feedbackQuestions?.pagination?.total || 0}
                    page={page}
                    pageSize={pageSize}
                    onPaginationChange={model => {
                      setPage(model.page);
                      setPageSize(model.pageSize);
                    }}
                    getRowId={getFeedbackRowId}
                    loading={feedbackQuestionsLoading}
                    emptyTitle="No Feedback Questions"
                    emptySubtitle="No Feedback Questions have been set up yet."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AddFeedbackConfigurationModal open={showAddModal} handleClose={handleCloseModal} onGeneralError={handleGeneralError} />

      <EditFeedbackConfigurationModal open={showEditModal} handleClose={handleCloseEditModal} data={selectedItem} onGeneralError={handleGeneralError} />

      {/* Activate Confirmation Modal */}
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        image={Icons.successCircle}
        show={showActivateModal}
        header={'Activate Feedback Question'}
        subHeader={'This will be available for selection across the platform.'}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonOnClick={() => {
          setShowActivateModal(false);
          setSelectedFeedbackQuestion(null);
        }}
        rightButton={activateLoading ? 'Activating' : 'Activate'}
        rightButtonClassName={'w-100 success-primary'}
        rightButtonOnClick={confirmActivate}
        rightButtonDisabled={activateLoading}
      />

      {/* Deactivate Confirmation Modal */}
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--danger-light)' }}
        image={Icons.deleteModal}
        show={showDeactivateModal}
        header={'Deactivate Feedback Question'}
        subHeader={'This will no longer be available for selection across the platform.'}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonOnClick={() => {
          setShowDeactivateModal(false);
          setSelectedFeedbackQuestion(null);
        }}
        rightButton={deactivateLoading ? 'Deactivating' : 'Deactivate'}
        rightButtonClassName={'w-100 danger-primary'}
        rightButtonOnClick={confirmDeactivate}
        rightButtonDisabled={deactivateLoading}
      />

      {/* Success Modal */}
      <AppModal modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }} show={showSuccessModal} image={Icons.successCircle} header={successMessage} subHeader={''} />
    </Layout>
  );
};

export default FeedbackConfigurations;
