import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { AppBadge, AppButton, AppDataGrid, AppInput, AppModal, AppToolTip } from '../../../../../components/base';
import { toastError } from '../../../../../components/base/toast';
import { Layout } from '../../../../../components/layout';
import { AddAssessmentQuestionModal, EditAssessmentQuestionModal, QuestionDetailModal } from '../../../../../components/modals';
import Icons from '../../../../../constants/Icons';
import useDebouncedValue from '../../../../../hooks/useDebouncedValue';
import {
  activateAssessmentQuestionAction,
  deactivateAssessmentQuestionAction,
  getAssessmentParameterByIdAction,
  getAssessmentParameterQuestionsAction,
  getAssessmentQuestionDetailsAction,
} from '../../../../../redux/action/systemAdmin/AssessmentParameterAction';
import { getBadgeVariantByLabel } from '../../../../../utils/getStatusColors';
import { Logger } from '../../../../../utils/logger';

// Helper component to display total weightage statusp
const WeightageStatusIndicator = ({ totalWeightage = 0 }) => {
  const isComplete = totalWeightage === 100;
  const isOverweight = totalWeightage > 100;

  const getStatusColor = () => {
    if (isComplete) {
      return 'var(--success-primary)';
    }
    if (isOverweight) {
      return 'var(--danger-primary)';
    }
    return 'var(--status-warning)';
  };

  const getStatusBg = () => {
    if (isComplete) {
      return 'var(--success-light)';
    }
    if (isOverweight) {
      return 'var(--danger-light)';
    }
    return 'var(--warning-light)';
  };

  const getMessage = () => {
    if (isComplete) {
      return 'Weightage complete';
    }
    if (isOverweight) {
      return `Exceeds by ${totalWeightage - 100}%`;
    }
    return `${100 - totalWeightage}% remaining`;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        borderRadius: '8px',
        backgroundColor: getStatusBg(),
      }}>
      <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-2-color)' }}>Total Weightage:</span>
      <span style={{ fontSize: '18px', fontWeight: 600, color: getStatusColor() }}>{totalWeightage}%</span>
      <span style={{ fontSize: '12px', fontWeight: 500, color: getStatusColor() }}>({getMessage()})</span>
    </div>
  );
};

const AssessmentParameterDetail = () => {
  const navigate = useNavigate();
  const { id: parameterId } = useParams();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState({ search: '' });
  const [serverError, setServerError] = useState('');
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [showToggleConfirmModal, setShowToggleConfirmModal] = useState(false);
  const [questionToToggle, setQuestionToToggle] = useState(null);
  const [totalWeightage, setTotalWeightage] = useState(0);

  const dispatch = useDispatch();
  const {
    assessmentParameter,
    assessmentQuestion,
    activateQuestionLoading,
    deactivateQuestionLoading,
    activatedAssessmentQuestion,
    deactivatedAssessmentQuestion,
    assessmentParameterQuestions,
    assessmentParameterQuestionsPagination,
    assessmentParameterQuestionsLoading,
    createdAssessmentQuestion,
  } = useSelector(state => state.SystemAdminAssessmentParameter);

  const handleGeneralError = errorMessage => {
    setServerError(errorMessage);
    toastError(errorMessage);
  };

  // Fetch parameter detail by ID
  useEffect(() => {
    if (parameterId) {
      dispatch(getAssessmentParameterByIdAction(parameterId)).catch(err => {
        Logger.error('Failed fetching parameter by id:', err);
        handleGeneralError(err?.message || 'Failed fetching parameter details');
      });
    }
  }, [parameterId, dispatch, activatedAssessmentQuestion, deactivatedAssessmentQuestion, createdAssessmentQuestion]);

  // Fetch assessment questions for the parameter using the correct API

  // Debounced so typing in the search box sends one request, not one per keystroke.
  const debouncedSearch = useDebouncedValue(filters.search);

  useEffect(() => {
    if (parameterId) {
      const fetchQuestionsData = {
        parameterId,
        perPage: pageSize,
        page,
        search: debouncedSearch || '',
      };
      dispatch(getAssessmentParameterQuestionsAction(fetchQuestionsData)).catch(err => {
        Logger.error('Failed fetching parameter questions:', err);
        handleGeneralError(err?.message || 'Failed fetching questions');
      });
    }
  }, [parameterId, dispatch, activatedAssessmentQuestion, deactivatedAssessmentQuestion, page, pageSize, debouncedSearch]);

  // Total weightage comes from backend aggregate (covers all pages, not just current).
  useEffect(() => {
    if (!debouncedSearch) {
      setTotalWeightage(assessmentParameter?.data?.questionsSumWeightage ?? 0);
    }
  }, [assessmentParameter, debouncedSearch]);

  // Trigger search immediately (reset to first page)
  const handleSearch = () => {
    setPage(1);
    const fetchQuestionsData = {
      parameterId,
      perPage: pageSize,
      page: 1,
      search: filters.search || '',
    };
    dispatch(getAssessmentParameterQuestionsAction(fetchQuestionsData));
  };

  // Handler for toggling active/inactive state with confirmation modal
  const handleToggle = useCallback((rowId, isCurrentlyActive, questionText) => {
    setQuestionToToggle({
      id: rowId,
      isActive: isCurrentlyActive,
      question: questionText,
    });
    setShowToggleConfirmModal(true);
  }, []);

  const confirmToggleQuestion = () => {
    if (!questionToToggle) {
      return;
    }
    const { id, isActive } = questionToToggle;
    if (isActive) {
      dispatch(deactivateAssessmentQuestionAction(id))
        .then(() => {
          setShowToggleConfirmModal(false);
        })
        .catch(err => {
          Logger.error('Deactivate question failed:', err);
          handleGeneralError(err?.message || 'Deactivate failed');
        });
    } else {
      dispatch(activateAssessmentQuestionAction(id))
        .then(() => {
          setShowToggleConfirmModal(false);
        })
        .catch(err => {
          Logger.error('Activate question failed:', err);
          handleGeneralError(err?.message || 'Activate failed');
        });
    }
  };

  const columns = useMemo(
    () => [
      {
        field: 'action',
        headerName: 'Actions',
        flex: 1,
        minWidth: 140,
        sortable: false,
        renderCell: params => {
          const isUserActive = !!params.row.isActive;
          const rowId = params.row.id;

          // Handler to open Question Detail and fetch details
          const handleViewQuestion = async () => {
            await dispatch(getAssessmentQuestionDetailsAction(rowId));
            setQuestionModalOpen(true);
          };

          const isParameterActive = assessmentParameter?.data?.isActive;

          return (
            <div style={{ display: 'flex', gap: '8px' }}>
              <AppButton variant="secondary" size="extraSmall" title={'View'} onClick={() => handleViewQuestion()} />
              <AppToolTip title={isParameterActive ? 'Deactivate parameter to edit' : 'Edit Assessment Question'}>
                <span>
                  <AppButton
                    variant="secondary"
                    size="extraSmall"
                    leftIconStyle={'icon-14 me-0'}
                    leftIcon={Icons.edit}
                    buttonPaddingX="0"
                    minWidth={30}
                    disabled={isParameterActive}
                    onClick={async () => {
                      // Await the fetch before opening. The modal's form reinitialises
                      // whenever this question lands in Redux, so opening first meant the
                      // arriving data wiped anything typed in the meantime.
                      await dispatch(getAssessmentQuestionDetailsAction(params.row.id));
                      setEditData(params.row);
                      setEditModalOpen(true);
                    }}
                  />
                </span>
              </AppToolTip>
              {!isParameterActive && (
                <div className="toggle-btns d-flex">
                  {isUserActive ? (
                    <AppToolTip title="Deactivate Assessment Question">
                      <Image src={Icons.active} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleToggle(rowId, true, params.row.fullName || params.row.user)} />
                    </AppToolTip>
                  ) : (
                    <AppToolTip title="Activate Assessment Question">
                      <Image src={Icons.inactive} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleToggle(rowId, false, params.row.fullName || params.row.user)} />
                    </AppToolTip>
                  )}
                </div>
              )}
            </div>
          );
        },
      },
      {
        field: 'question',
        headerName: 'Question',
        flex: 2.3,
        minWidth: 260,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4>{params.row.questionText}</h4>
          </div>
        ),
      },
      {
        field: 'category',
        headerName: 'Category',
        flex: 0.8,
        minWidth: 110,
        sortable: false,
        renderCell: params => {
          const raw = params.row?.category || '';
          const capitalized = raw
            .split(' ')
            .map(part => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ''))
            .join(' ');
          return (
            <div className="double-content">
              <h4>{capitalized}</h4>
            </div>
          );
        },
      },
      {
        field: 'weightage',
        headerName: 'Weightage',
        flex: 0.6,
        minWidth: 70,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4>{params.row.weightage}%</h4>
          </div>
        ),
      },
      {
        field: 'status',
        headerName: 'Status',
        flex: 0.8,
        minWidth: 80,
        headerAlign: 'right',
        sortable: false,
        renderCell: params => (
          <div className="table-flex-end">
            <AppBadge variant={getBadgeVariantByLabel(params.row?.isActive ? 'Active' : 'Inactive')} label={params.row?.isActive ? 'Active' : 'Inactive'} />
          </div>
        ),
      },
    ],
    [dispatch, handleToggle, assessmentParameter?.data?.isActive],
  );
  // Using `rows` state defined above

  // compute a safe, capitalized display for enterpriseSize
  const enterpriseSizeDisplay = useMemo(() => {
    const raw = assessmentParameter?.data?.enterpriseSize ?? '';
    if (!raw || typeof raw !== 'string') {
      return '-';
    }
    return raw
      .split(' ')
      .map(part => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ''))
      .join(' ');
  }, [assessmentParameter?.data?.enterpriseSize]);

  return (
    <Layout
      isSubHeader
      subHeader={
        <div className="subHeaderWrapper">
          <div className="subHeaderLeft">
            <div className="subHeaderLeftBox">
              <img src={Icons.back} alt="back" className="icon-24" onClick={() => navigate(-1)} />
              <div className="heading-seperator"></div>
              <h1 className="heading-createApp">Assessment Parameter Details</h1>
            </div>
            <div className="subHeaderRightBx">
              <ul className="breadCrumbHeader">
                <li className="margin-left-30">Manufacturing Assessment Parameters</li>
                <div className="dot-separator" />
                <li>Assessment Parameter Details</li>
              </ul>
            </div>
          </div>
        </div>
      }>
      <div className="main-content-inner">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="details-card-with-tabs">
                <div className="details-card">
                  <div className="top-details-card">
                    <div className="top-details-card-content">
                      <div className="top-left-details-card">
                        <div className="statIconContainer">
                          <img src={Icons.clipboard} alt="Units" className="icon-30" />
                        </div>
                      </div>

                      <div className="rowBetween w-100">
                        <div className="top-right-details-card pl-20">
                          <div>
                            <h4 className="fs-20 fw-500 heading-color mb-0">{assessmentParameter?.data?.name || '-'}</h4>

                            <div className="rowCenter margin-top-8">
                              <p className="fs-14 fw-500 mb-0 text-2-color">{assessmentParameter?.data?.discipline?.name || '-'}</p>
                              <AppBadge
                                variant={getBadgeVariantByLabel(assessmentParameter?.data?.isActive ? 'Active' : 'Inactive')}
                                label={assessmentParameter?.data?.isActive ? 'Active' : 'Inactive'}
                                className="margin-left-10"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="h-100">
                          <AppBadge variant={assessmentParameter?.data?.isMandatory ? 'red' : 'yellow'} label={assessmentParameter?.data?.isMandatory ? 'Mandatory' : 'Optional'} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <hr className="divider-small" />
                  <div className="bottom-details-card">
                    <div className="each-details-box">
                      <img src={Icons.documentText} alt="parameter id" className="icon-24 margin-top-6" />
                      <div>
                        <p className="fs-12 fw-500 text-3-color mb-0">Parameter ID</p>
                        <div className="d-flex align-items-center">
                          <p className="fs-14 fw-500 heading-color mb-0 margin-top-2">{assessmentParameter?.data?.code || '-'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="vertical-divider" />
                    <div className="each-details-box">
                      <img src={Icons.questionsIcon} alt="calendar" className="icon-24 margin-top-6" />
                      <div>
                        <p className="fs-12 fw-500 text-3-color mb-0">Questions</p>
                        <div className="d-flex align-items-center">
                          <p className="fs-14 fw-500 heading-color mb-0 margin-top-2">{assessmentParameter?.data?.questionsCount || 0}</p>
                        </div>
                      </div>
                    </div>
                    <div className="vertical-divider" />
                    <div className="each-details-box">
                      <img src={Icons.shop} alt="shops" className="icon-24 margin-top-6" />
                      <div>
                        <p className="fs-12 fw-500 text-3-color mb-0">Category</p>
                        <div className="d-flex align-items-center">
                          <p className="fs-14 fw-500 heading-color mb-0 margin-top-2">{assessmentParameter?.data?.vendorCategoryName || '-'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="vertical-divider" />
                    <div className="each-details-box">
                      <img src={Icons.size} alt="shops" className="icon-24 margin-top-6" />
                      <div>
                        <p className="fs-12 fw-500 text-3-color mb-0">Enterprise Size</p>

                        <div className="d-flex align-items-center">
                          <p className="fs-14 fw-500 heading-color mb-0 margin-top-2">{enterpriseSizeDisplay === 'Startup' ? 'Start-Up' : enterpriseSizeDisplay}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="table-container">
                <div className="table-header">
                  <div className="table-header-left">
                    <h1 className="page-heading">Questions</h1>
                    <div className="input-search-document">
                      <AppInput
                        label={'Search'}
                        inputType="search"
                        name="search"
                        customInputClass={'search-input'}
                        placeholder="Search by question"
                        customWidth="100%"
                        leftIcon={Icons.search}
                        marginLeft="6px"
                        value={filters.search}
                        onChange={e => {
                          setFilters(prev => ({ ...prev, search: e.target.value }));
                          setPage(1);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            handleSearch();
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="table-header-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <WeightageStatusIndicator totalWeightage={totalWeightage} />
                    {assessmentParameter?.data?.isActive && (
                      <div className="fs-14 fw-500 read-only-input">
                        <img src={Icons.readOnlyCircle} alt="locked" className="icon-16" style={{ filter: 'var(--info-filter)' }} />
                        Read-only (Parameter is active)
                      </div>
                    )}
                    <AppToolTip title={assessmentParameter?.data?.isActive ? 'Deactivate parameter to add questions' : 'Add new question'}>
                      <span>
                        <AppButton variant="primary" size="small" title={'Add New'} onClick={() => setAddModalOpen(true)} disabled={assessmentParameter?.data?.isActive} />
                      </span>
                    </AppToolTip>
                  </div>
                </div>

                <div className="table-wrapper">
                  <AppDataGrid
                    rows={assessmentParameterQuestions || []}
                    columns={columns}
                    rowCount={assessmentParameterQuestionsPagination?.total ?? (assessmentParameterQuestions?.length || 0)}
                    page={page}
                    pageSize={pageSize}
                    onPaginationChange={model => {
                      setPage(model.page);
                      setPageSize(model.pageSize);
                    }}
                    loading={assessmentParameterQuestionsLoading}
                    emptyTitle="No Questions"
                    emptySubtitle="Assessment Questions have not been added yet."
                  />
                  <QuestionDetailModal open={questionModalOpen} handleClose={() => setQuestionModalOpen(false)} data={assessmentQuestion} />
                  <AddAssessmentQuestionModal
                    open={addModalOpen}
                    handleClose={(event, reason) => {
                      if (reason && reason === 'backdropClick') {
                        return;
                      }
                      setAddModalOpen(false);
                    }}
                    parameterId={assessmentParameter?.data?.id}
                    serverError={serverError}
                    onGeneralError={handleGeneralError}
                    existingQuestions={assessmentParameterQuestions || []}
                  />
                  <EditAssessmentQuestionModal
                    open={editModalOpen}
                    handleClose={() => setEditModalOpen(false)}
                    data={assessmentQuestion}
                    parameterId={assessmentParameter?.data?.id}
                    serverError={serverError}
                    onGeneralError={handleGeneralError}
                    existingQuestions={assessmentParameterQuestions || []}
                    editingQuestionId={editData?.id}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <AppModal
        modalHeaderStyle={{ backgroundColor: questionToToggle?.isActive ? 'var(--danger-light)' : 'var(--success-light)' }}
        image={questionToToggle?.isActive ? Icons.rejectIcon : Icons.successCircle}
        show={showToggleConfirmModal}
        onExited={() => setQuestionToToggle(null)}
        header={questionToToggle?.isActive ? 'Deactivate Assessment Question?' : 'Activate Assessment Question?'}
        subHeader={questionToToggle?.isActive ? 'This will no longer be available for selection across the platform.' : 'This will be available for selection across the platform.'}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonOnClick={() => {
          setShowToggleConfirmModal(false);
        }}
        rightButton={questionToToggle?.isActive ? 'Deactivate' : 'Activate'}
        rightButtonClassName={`w-100 ${questionToToggle?.isActive ? 'danger-primary' : 'primary'}`}
        rightButtonOnClick={confirmToggleQuestion}
        rightButtonLoading={activateQuestionLoading || deactivateQuestionLoading}
        rightButtonDisabled={activateQuestionLoading || deactivateQuestionLoading}
      />
    </Layout>
  );
};

export default AssessmentParameterDetail;
