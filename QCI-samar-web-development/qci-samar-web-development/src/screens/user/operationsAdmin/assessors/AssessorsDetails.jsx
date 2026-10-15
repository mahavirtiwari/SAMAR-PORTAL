import { Box, Link, Skeleton } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { AppAvatar, AppBadge, AppDataGrid, AppInput, AppTableEmpty, FullScreenLoader } from '../../../../components/base';
import AppIconButton from '../../../../components/base/AppIconButton';
import { Layout } from '../../../../components/layout';
import { AppAssessorLocationModal, AssessorDomainModal } from '../../../../components/modals';
import Icons from '../../../../constants/Icons';
import useDebouncedValue from '../../../../hooks/useDebouncedValue';
import { getUserDetailsAction } from '../../../../redux/action/common/UnitAdminAction';
import Api from '../../../../services/api';
import { formatDate } from '../../../../utils/formatters';
import { getBadgeVariantByLabel } from '../../../../utils/getStatusColors';
import { Logger } from '../../../../utils/logger';

const formatAssessmentStatus = status => {
  switch (status) {
    case 'submitted_for_qc':
      return 'Submitted for Quality Check';
    case 'in_progress':
      return 'In Progress';
    case 'mobile_complete':
      return 'Completed on Mobile';
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

const assessmentHistoryColumns = [
  {
    field: 'applicationNo',
    headerName: 'Application Number',
    flex: 1.2,
    minWidth: 150,
    sortable: false,
  },
  {
    field: 'assessmentDate',
    headerName: 'Assessment Date',
    flex: 1.2,
    minWidth: 180,
    sortable: false,
  },
  {
    field: 'assessmentStatus',
    headerName: 'Assessment Status',
    flex: 1,
    minWidth: 140,
    headerAlign: 'right',
    sortable: false,
    renderCell: params => (
      <div className="table-flex-end">
        <AppBadge variant={getBadgeVariantByLabel(params.row.assessmentStatus)} label={formatAssessmentStatus(params.row.assessmentStatus)} />
      </div>
    ),
  },
];

const AssessorsDetails = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { id } = useParams();
  const { userDetails, userDetailsLoading } = useSelector(state => state.UnitAdmin);

  const [showDomainModal, setShowDomainModal] = useState(false);
  const handleCloseDomainModal = () => setShowDomainModal(false);

  const [showLocationModal, setShowLocationModal] = useState(false);
  const handleOpenLocationModal = () => setShowLocationModal(true);
  const handleCloseLocationModal = () => setShowLocationModal(false);

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);

  // Assessment history state
  const [assessmentHistory, setAssessmentHistory] = useState([]);
  const [assessmentHistoryLoading, setAssessmentHistoryLoading] = useState(false);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
  const [totalRows, setTotalRows] = useState(0);

  // Fetch user details when component mounts
  useEffect(() => {
    if (id) {
      dispatch(getUserDetailsAction(id));
    }
  }, [dispatch, id]);

  // Fetch assessment history for this assessor
  // Only the latest request may write state, so a slow response for an earlier search or
  // page cannot overwrite a newer one; the effect cleanup also retires it on unmount.
  const historyRequestRef = useRef(0);
  const fetchAssessmentHistory = useCallback(async () => {
    if (!id) {
      return;
    }
    const requestId = ++historyRequestRef.current;
    const isLatest = () => requestId === historyRequestRef.current;

    setAssessmentHistoryLoading(true);
    try {
      const service = Api.Assessment;
      // Fetch assessments where this user is either lead assessor or co-assessor
      const response = await service.getAssessments({
        leadAssessor: id,
        page: paginationModel.page + 1,
        perPage: paginationModel.pageSize,
        search: debouncedSearch || undefined,
      });

      if (!isLatest()) {
        return;
      }
      const assessments = response?.data?.assessments || response?.data || [];
      const pagination = response?.data?.pagination || response?.pagination;

      setAssessmentHistory(assessments);
      setTotalRows(pagination?.total || assessments.length);
      Logger.info('Fetched assessment history:', { assessments, pagination });
    } catch (error) {
      Logger.error('Error fetching assessment history:', error);
      if (!isLatest()) {
        return;
      }
      setAssessmentHistory([]);
      setTotalRows(0);
    } finally {
      if (isLatest()) {
        setAssessmentHistoryLoading(false);
      }
    }
  }, [id, paginationModel.page, paginationModel.pageSize, debouncedSearch]);

  useEffect(() => {
    fetchAssessmentHistory();
    return () => {
      historyRequestRef.current += 1;
    };
  }, [fetchAssessmentHistory]);

  const handleSearchChange = e => {
    setSearchQuery(e.target.value);
    setPaginationModel(prev => ({ ...prev, page: 0 }));
  };

  // Map assessment data to table rows
  const rows = useMemo(() => {
    return assessmentHistory.map((assessment, index) => ({
      id: assessment.id || index + 1,
      applicationNo: assessment.application?.applicationNumber || assessment.applicationNumber || '-',
      assessmentDate: assessment.scheduledStartDate ? `${formatDate(assessment.scheduledStartDate)}${assessment.scheduledEndDate ? ` - ${formatDate(assessment.scheduledEndDate)}` : ''}` : '-',
      assessmentStatus: assessment.status || '-',
    }));
  }, [assessmentHistory]);

  // The loading skeleton overlay is specific to this screen, so the slots object is supplied
  // wholesale — it must still carry the empty overlay the wrapper would otherwise provide.
  const gridExtraProps = useMemo(
    () => ({
      slots: {
        noRowsOverlay: () => <AppTableEmpty title="No Assessment History" subtitle="This assessor has not completed any assessments yet." />,
        loadingOverlay: () => (
          <Box sx={{ width: '100%', padding: 2 }}>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
            ))}
          </Box>
        ),
      },
      hideFooter: rows.length === 0 && !assessmentHistoryLoading,
    }),
    [rows.length, assessmentHistoryLoading],
  );

  return (
    <Layout
      isSubHeader
      subHeader={
        <div className="subHeaderWrapper">
          <div className="subHeaderLeft">
            <div className="subHeaderLeftBox">
              <AppIconButton icon={Icons.back} label="Go back" iconClassName="icon-24" onClick={() => navigate(-1)} />
              <div className="heading-seperator"></div>
              <h1 className="heading-createApp">Assessor Details</h1>
            </div>
            <div className="subHeaderRightBx">
              <ul className="breadCrumbHeader">
                <li className="margin-left-30">Assessors</li>
                <div className="dot-separator" />
                <li>Assessor Details</li>
              </ul>
            </div>
          </div>
        </div>
      }>
      {userDetailsLoading ? (
        <div className="d-flex justify-content-center align-items-center" style={{ height: '500px' }}>
          <FullScreenLoader loading={true} />
        </div>
      ) : (
        <div className="main-content-inner">
          <div className="container">
            <div className="row">
              <div className="col-12">
                <div>
                  <div className="details-card">
                    <div className="top-details-card">
                      <div className="top-details-card-content flex-grow-1">
                        <div className="top-left-details-card">
                          <AppAvatar alt={userDetails?.fullName} size="80" />
                        </div>
                        <div className="top-right-details-card pl-20">
                          <div className="d-flex justify-content-between align-items-start">
                            <div>
                              <div className="rowCenter">
                                {userDetailsLoading ? <Skeleton variant="text" width={200} height={32} /> : <h4 className="fs-24 fw-600 heading-color mb-0">{userDetails?.fullName || '-'}</h4>}
                                <AppBadge variant={getBadgeVariantByLabel(userDetails?.status)} label={userDetails?.status} className="margin-left-10" />
                              </div>
                              <div className="d-flex align-items-center margin-top-8">
                                <ul className="enterpriseInfoUl enterpriseInfoHorizontalUl">
                                  <li>
                                    <img src={Icons.receiver} alt="phone" className="icon-20 margin-right-8" />
                                    <p className="fs-12 fw-400 mb-0 text-3-color">Mobile Number:</p>
                                    {userDetailsLoading ? (
                                      <Skeleton variant="text" width={120} height={16} />
                                    ) : (
                                      <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{userDetails?.mobileNumber || '-'}</p>
                                    )}
                                  </li>
                                  <li>
                                    <img src={Icons.email} alt="email" className="icon-20 margin-right-8" />
                                    <p className="fs-12 fw-400 mb-0 text-3-color">Email:</p>
                                    {userDetailsLoading ? (
                                      <Skeleton variant="text" width={150} height={16} />
                                    ) : (
                                      <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{userDetails?.email || '-'}</p>
                                    )}
                                  </li>
                                </ul>
                              </div>
                            </div>
                          </div>
                          <div className="d-flex align-items-center margin-top-8">
                            <ul className="enterpriseInfoUl enterpriseInfoHorizontalUl">
                              <li>
                                <img src={Icons.location} alt="location" className="icon-20 margin-right-8" />
                                <p className="fs-12 fw-400 mb-0 text-3-color margin-right-6">Assessor Locations:</p>
                                {userDetailsLoading ? (
                                  <Skeleton variant="text" width={150} height={16} />
                                ) : (
                                  <Link
                                    href="#"
                                    underline="none"
                                    className="fs-12 fw-500 mb-0 primary-color"
                                    onClick={e => {
                                      e.preventDefault();
                                      handleOpenLocationModal();
                                    }}>
                                    View
                                  </Link>
                                )}
                                <AppAssessorLocationModal userDetails={userDetails} open={showLocationModal} onClose={handleCloseLocationModal} />
                              </li>

                              <li>
                                <img src={Icons.briefcase} alt="domain" className="icon-20 margin-right-8" />
                                <p className="fs-12 fw-400 mb-0 text-3-color margin-right-6">Domains:</p>
                                {userDetailsLoading ? (
                                  <Skeleton variant="text" width={200} height={16} />
                                ) : (
                                  <Link
                                    href="#"
                                    underline="none"
                                    className="fs-12 fw-500 mb-0 primary-color"
                                    onClick={e => {
                                      e.preventDefault();
                                      setShowDomainModal(true);
                                    }}>
                                    View
                                  </Link>
                                )}
                                <AssessorDomainModal open={showDomainModal} onClose={handleCloseDomainModal} domains={userDetails?.assessorDomains} />
                              </li>
                              <li>
                                <img src={Icons.calendarBlue} alt="calendar" className="icon-20 margin-right-8" />
                                <p className="fs-12 fw-400 mb-0 text-3-color">Last login:</p>
                                <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{userDetails?.lastLoginAt ? formatDate(userDetails?.lastLoginAt) : '-'}</p>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="table-container">
              <div className="table-header">
                <div className="table-header-left">
                  <h1 className="page-heading">Assessment History</h1>
                  <div className="input-search-document">
                    <AppInput
                      label={'Search'}
                      inputType="search"
                      name="search"
                      customInputClass={'search-input'}
                      value={searchQuery}
                      onChange={handleSearchChange}
                      placeholder="Application number or enterprise name"
                      customWidth="100%"
                      leftIcon={Icons.search}
                      marginLeft="6px"
                    />
                  </div>
                </div>
              </div>

              <div className="table-wrapper">
                <AppDataGrid
                  rows={rows}
                  columns={assessmentHistoryColumns}
                  loading={assessmentHistoryLoading}
                  rowCount={totalRows}
                  page={paginationModel.page + 1}
                  pageSize={paginationModel.pageSize}
                  onPaginationChange={model => setPaginationModel({ page: model.page - 1, pageSize: model.pageSize })}
                  extraProps={gridExtraProps}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AssessorsDetails;
