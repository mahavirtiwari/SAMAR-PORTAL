import { Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppBadge, AppButton, AppDataGrid } from '../../../components/base';
import { Layout } from '../../../components/layout';
import { AddApplicationModal } from '../../../components/modals';
import Icons from '../../../constants/Icons';
import { getUserDetailsAction } from '../../../redux/action/common/UnitAdminAction';
import { getApplicationAction } from '../../../redux/action/enterpriseAdmin/application/ApplicationAction';
import { getEnterpriseAdminDashboardAction } from '../../../redux/action/enterpriseAdmin/DashboardAction';
import { getAllOrganizationsAction } from '../../../redux/action/organizations/OrganizationAction';
import { onActivate, onActivateLink } from '../../../utils/a11y';
import { formatDate } from '../../../utils/formatters';
import { getBadgeVariantByLabel } from '../../../utils/getStatusColors';

const Dashboard = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.Account);
  const { userDetails, userDetailsLoading } = useSelector(state => state.UnitAdmin);
  const { organizations, organizationsLoading } = useSelector(state => state.Organization);
  const { applicationList } = useSelector(state => state.EnterpriseAdminApplication);

  const { activeApplications, dashboardLoading, summaryCards, alerts } = useSelector(state => state.EnterpriseAdminDashboard);
  const [openAddApplicationModal, setOpenAddApplicationModal] = useState(false);

  // Fetch dashboard data
  useEffect(() => {
    if (user?.id) {
      dispatch(getEnterpriseAdminDashboardAction());
    }
  }, [dispatch, user?.id]);

  useEffect(() => {
    if (user?.organization?.id) {
      dispatch(getAllOrganizationsAction({ organizationId: user.organization.id }));
    }
  }, [dispatch, user?.organization?.id]);

  useEffect(() => {
    // Only fetch user details if we don't already have them cached
    if (user?.id && !userDetails && !userDetailsLoading) {
      dispatch(getUserDetailsAction(user.id));
    }
  }, [dispatch, user?.id, userDetails, userDetailsLoading]);

  useEffect(() => {
    const filtersData = {
      status: null,
      q: null,
      perPage: 10,
      page: 1,
      sector: null,
      classification: null,
    };
    dispatch(getApplicationAction(filtersData));
  }, [dispatch]);

  // Navigate only when organizations data is available and profile is incomplete
  useEffect(() => {
    if (organizations && organizations.organization && !organizations.organization.isProfileCompleted) {
      navigate('/enterprise-details');
    }
  }, [organizations, navigate]);

  // Helper to get stat card value by key
  const getStatValue = key => {
    const card = summaryCards.find(c => c.key === key);
    return card?.value ?? 0;
  };

  // Certificate renewal alert (rendered as the top-most banner card)
  const renewalAlert = alerts?.find(a => a.type === 'certificate_renewal' || a.key === 'certificate_renewal');
  const expiredCount = Number(renewalAlert?.expired ?? 0);
  const expiringCount = Number(renewalAlert?.expiringSoon ?? renewalAlert?.expiring_soon ?? 0);
  const renewalCount = Number(renewalAlert?.value ?? renewalAlert?.count ?? expiredCount + expiringCount);
  const showRenewalBanner = renewalCount > 0;

  // Prevent dashboard flash on first-login while profile/org data is loading
  const _isBlockingLoading = organizationsLoading || userDetailsLoading || dashboardLoading;

  const handleContactSupport = () => {
    navigate('/support');
  };

  const handleNewApplication = () => {
    setOpenAddApplicationModal(true);
  };

  const handleCloseAddApplicationModal = () => {
    setOpenAddApplicationModal(false);
  };

  const handleViewApplication = useCallback(
    applicationId => {
      navigate(`/my-application/application-details/${applicationId}`);
    },
    [navigate],
  );

  // Transform API data to table rows (same fields as My Applications list)
  const rows = useMemo(
    () =>
      activeApplications.map((app, index) => ({
        id: app.id || index + 1,
        applicationNumber: app.applicationNumber,
        unitName: app.unitName || app.organizationName || 'N/A',
        sector: (app.sector || '').toString().toLowerCase(),
        applicationDate: app.submittedAt || app.createdAt || null,
        paymentStatus: app.paymentStatusLabel || 'Yet to Pay',
        status: app.status,
        applicantStatus: app.applicantStatusLabel || app.statusLabel || app.status,
        unitAddress: app.fullUnitAddress || app.unitAddress || 'N/A',
        size: (app.enterpriseClassification || '').toString().toLowerCase(),
        address: app.fullUnitAddress || 'N/A',
      })),
    [activeApplications],
  );

  const hasApplications = applicationList?.data?.length > 0;
  const columns = useMemo(
    () => [
      {
        field: 'action',
        headerName: 'Actions',
        flex: 0.7,
        minWidth: 110,
        sortable: false,
        renderCell: params => <AppButton variant="secondary" size="extraSmall" title={'View'} onClick={() => handleViewApplication(params.row.id)} />,
      },

      {
        field: 'applicationNo',
        headerName: 'Application Number',
        flex: 1.2,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4>{params.row.applicationNumber} </h4>
            <div className="d-flex align-items-center">
              <span className={`text-capitalize ${params.row.sector === 'manufacturing' ? 'primary-color' : 'badge-purple-color'}`}>{params.row.sector || '-'}</span>
              {params.row.size ? (
                <>
                  <div className="dot-separator"></div>
                  <span className="text-3-color text-capitalize">{params.row.size === 'startup' ? 'Start-Up' : params.row.size}</span>
                </>
              ) : null}
            </div>
          </div>
        ),
      },
      {
        field: 'unit',
        headerName: 'Enterprise/Unit Name',
        flex: 2,
        minWidth: 200,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4>{params.row.unitName}</h4>
            <Typography variant="body2" className="heading-color line-clamp" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
              {params.row.unitAddress}
            </Typography>
          </div>
        ),
      },
      {
        field: 'applicantStatus',
        headerName: 'Application Status',
        flex: 1.2,
        minWidth: 140,
        sortable: false,
        renderCell: params => <AppBadge variant={getBadgeVariantByLabel(params.row.status) || getBadgeVariantByLabel(params.value)} label={params.value} />,
      },
      {
        field: 'applicationDate',
        headerName: 'Application Date',
        sortable: false,
        flex: 1,
        minWidth: 120,
        renderCell: params => (
          <div className="double-content">
            <h4>{formatDate(params.row.applicationDate)}</h4>
          </div>
        ),
      },
    ],
    [handleViewApplication],
  );

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="row">
            {showRenewalBanner && (
              <div className="col-12 margin-bottom-20">
                <div className="renewalBanner">
                  <div className="d-flex align-items-center gap-16">
                    <div className="renewalBannerIcon">
                      <img src={Icons.warningInfo} alt="Renewal alert" className="icon-36" />
                    </div>
                    <div>
                      <div className="fs-24 fw-600 heading-color">
                        {renewalCount} {renewalCount === 1 ? 'certificate needs' : 'certificates need'} renewal
                      </div>
                      <div className="fs-14 fw-500 text-3-color">
                        {expiredCount} expired · {expiringCount} expiring soon. Renew to keep your units certified.
                      </div>
                    </div>
                  </div>
                  <AppButton variant="primary" size="medium" title={'Review'} onClick={() => navigate('/documents')} rightIcon={Icons.whiteRightArrow} />
                </div>
              </div>
            )}
            <div className="col-xxl-7 col-xl-7 col-lg-7 col-md-7">
              <div className="row h-100 align-content-between">
                <div className="col-md-6">
                  <div className="statCard" style={{ borderLeftColor: 'var(--info-primary)', cursor: 'pointer' }} {...onActivateLink(() => navigate('/unit-users'))}>
                    <div className="d-flex flex-row gap-16">
                      <div className="statIconContainer">
                        <img src={Icons.buildings} alt="Units" className="icon-36" />
                      </div>
                      <div className="row">
                        <div className="fs-24 fw-600 padding-right-6 heading-color">{getStatValue('units')}</div>
                        <div className="fs-14 fw-500 text-3-color">Total Units</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="statCard" style={{ borderLeftColor: 'var(--badge-green)', cursor: 'pointer' }} {...onActivateLink(() => navigate('/applications/active'))}>
                    <div className="d-flex flex-row gap-16">
                      <div className="statIconContainer" style={{ backgroundColor: 'var(--success-light)' }}>
                        <img src={Icons.greenClipboard} alt="Active Applications" className="icon-36" />
                      </div>
                      <div className="row">
                        <div className="fs-24 fw-600 padding-right-6 heading-color">{getStatValue('active_applications')}</div>
                        <div className="fs-14 fw-500 text-3-color">Active Applications</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="statCard" style={{ borderLeftColor: 'var(--purple-dark)', cursor: 'pointer' }} {...onActivateLink(() => navigate('/documents'))}>
                    <div className="d-flex flex-row gap-16">
                      <div className="statIconContainer" style={{ backgroundColor: '#f3efff' }}>
                        <img src={Icons.certificates} alt="Current Certifications" className="icon-36" />
                      </div>
                      <div className="row">
                        <div className="fs-24 fw-600 padding-right-6 heading-color">{getStatValue('current_certifications')}</div>
                        <div className="fs-14 fw-500 text-3-color">Current Certifications</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="statCard" style={{ borderLeftColor: 'var(--warning-primary)', cursor: 'pointer' }} {...onActivateLink(() => navigate('/applications/draft'))}>
                    <div className="d-flex flex-row gap-16">
                      <div className="statIconContainer" style={{ backgroundColor: 'var(--warning-light)' }}>
                        <img src={Icons.yellowClock} alt="Draft Applications" className="icon-36" />
                      </div>
                      <div className="row">
                        <div className="fs-24 fw-600 padding-right-6 heading-color">{getStatValue('draft_applications')}</div>
                        <div className="fs-14 fw-500 text-3-color">Draft Applications</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-xxl-5 col-xl-5 col-lg-5 col-md-5">
              <div className="quickActionsSection">
                <h6 className="margin-bottom-20 fs-16 fw-600 text-heading-color">Quick Actions</h6>
                <div className="quickActionsGrid">
                  <div className="d-flex align-items-center flex-grow-1 gap-12">
                    <a className="justify-content-start new-application-button" {...onActivate(handleNewApplication)} style={{ width: '49%', textDecoration: 'none', cursor: 'pointer' }}>
                      <img src={Icons.documentText} alt="New Application" className="icon-40" />
                      <div className="fs-14 fw-500 primary-color text-center">Apply For New Application</div>
                    </a>
                    <a className="new-application-button contact-support-outline-button" {...onActivate(handleContactSupport)} style={{ width: '49%', textDecoration: 'none', cursor: 'pointer' }}>
                      <img src={Icons.contactSupport} alt="New Application" className="icon-40" />
                      <div className="fs-14 fw-500 primary-color">Contact Support</div>
                    </a>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-12 margin-top-20">
              <div className="table-container">
                <div className="table-header">
                  <div className="table-header-left">
                    <h1 className="page-heading">Active Applications</h1>
                  </div>
                  {hasApplications && (
                    <div className="table-header-right">
                      <AppButton variant="secondary" size="small" title={'View All'} onClick={() => navigate('/applications')} />
                    </div>
                  )}
                </div>

                <div className="table-wrapper">
                  <AppDataGrid
                    rows={rows}
                    columns={columns}
                    server={false}
                    pageSize={100}
                    emptyTitle="No Active Applications"
                    emptySubtitle="There are currently no active applications available to display."
                    extraProps={{ hideFooter: true }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <AddApplicationModal open={openAddApplicationModal} handleClose={handleCloseAddApplicationModal} />
    </Layout>
  );
};

export default Dashboard;
