import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppDataGrid } from '../../../components/base';
// Imported from their files, not the base barrel, so the charting libraries stay in
// this lazily loaded screen's chunks instead of the shared startup bundle.
import AppPieChartCard from '../../../components/base/AppPieChartCard';
import AppStackedBarChartCard from '../../../components/base/AppStackedBarChartCard';
import StepProgressBar from '../../../components/base/StepProgressBar';
import { Layout } from '../../../components/layout';
import Icons from '../../../constants/Icons';
import { getOperationsAdminDashboardAction } from '../../../redux/action/operationsAdmin/DashboardAction';

// Chart color schemes
const CHART_COLORS = ['#FF4C61', '#FFC93E', '#3B82F6', '#8B5CF6', '#22C55E'];
const STATUS_COLORS = {
  'Allocation Pending': 'var(--status-warning)',
  Scheduled: 'var(--status-blue)',
  'In Progress': 'var(--status-info)',
  'Quality Check': 'var(--status-purple)',
  'Quality Check Feedback': 'var(--status-orange)',
  'Ready for Committee Review': 'var(--status-darkGreen)',
  'Committee Review Scheduled': 'var(--purpleAccent)',
  'Committee Review Feedback': 'var(--badge-brown)',
  Certified: 'var(--status-green)',
};

// Table columns for state-wise vendors
const columns = [
  {
    field: 'state',
    headerName: 'State',
    flex: 0.6,
    minWidth: 80,
    sortable: false,
    renderCell: params => (
      <div className="double-content">
        <h4>{params.row.state}</h4>
      </div>
    ),
  },
  {
    field: 'registered',
    headerName: 'Registered Enterprise',
    flex: 0.5,
    minWidth: 90,
    sortable: false,
    renderCell: params => (
      <div className="double-content">
        <h4 className="text-3-color line-clamp">{params.row.registered}</h4>
      </div>
    ),
  },
  {
    field: 'draft',
    headerName: 'Draft Enterprise',
    flex: 0.5,
    minWidth: 90,
    sortable: false,
    renderCell: params => (
      <div className="double-content">
        <span className="text-3-color line-clamp">{params.row.draft}</span>
      </div>
    ),
  },
  {
    field: 'certified',
    headerName: 'Certified Enterprise',
    flex: 1,
    minWidth: 100,
    sortable: false,
    renderCell: params => (
      <div className="double-content">
        <span className="text-3-color line-clamp">{params.row.certified}</span>
      </div>
    ),
  },
];

// Icon and color mappings for summary cards
const CARD_CONFIG = {
  'Total Applications': { icon: Icons.documentDone, color: 'var(--info-primary)', bgColor: 'var(--info-light)', route: '/applications' },
  'Active Applications': { icon: Icons.greenClipboard, color: 'var(--badge-green)', bgColor: 'var(--success-light)', route: '/applications/active' },
  'Payment Pending': { icon: Icons.pendingCoin, color: 'var(--badge-orange)', bgColor: 'var(--badge-bg-orange)', route: '/applications/payment-pending' },
  'Pending Approval': { icon: Icons.stampPendingApprovals, color: 'var(--warning-active)', bgColor: 'var(--warning-light)', route: '/applications/drdo_approval_pending' },
  'In Progress Applications': { icon: Icons.documentText, color: 'var(--status-info)', bgColor: 'var(--info-light, #e0f2fe)', route: '/applications/in-progress' },
  'Ready for Committee Review': { icon: Icons.darkTickCircle, color: 'var(--status-darkGreen)', bgColor: 'var(--badge-bg-darkGreen)', route: '/ready-for-committee-review' },
};

const Dashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [statePagination, setStatePagination] = useState({ page: 1, pageSize: 10 });

  // Get dashboard data from Redux with safe defaults to avoid null/undefined
  const ops = useSelector(state => (state && state.OperationsAdminDashboard) || {});
  const { dashboardLoading = false, dashboardError = null, summaryCards = [], enterpriseDistribution = {}, certifiedVendorsByLevel = {}, assessmentStatusFlow = [], stateWiseVendors = [] } = ops;

  // Fetch dashboard data on mount
  useEffect(() => {
    dispatch(getOperationsAdminDashboardAction());
  }, [dispatch]);

  // Transform enterprise distribution for bar chart
  const enterpriseChartData = useMemo(() => {
    const result = {};
    if (enterpriseDistribution && typeof enterpriseDistribution === 'object') {
      Object.entries(enterpriseDistribution).forEach(([type, data]) => {
        result[type] = Array.isArray(data)
          ? data.map((item, idx) => ({
              ...item,
              color: CHART_COLORS[idx % CHART_COLORS.length],
            }))
          : [];
      });
    }
    return result;
  }, [enterpriseDistribution]);

  // Transform certified vendors for pie chart
  const vendorPieChartData = useMemo(() => {
    const result = {};
    if (certifiedVendorsByLevel && typeof certifiedVendorsByLevel === 'object') {
      Object.entries(certifiedVendorsByLevel).forEach(([type, data]) => {
        result[type] = Array.isArray(data)
          ? data.map((item, idx) => ({
              name: item.level,
              value: item.count,
              color: CHART_COLORS[idx % CHART_COLORS.length],
            }))
          : [];
      });
    }
    return result;
  }, [certifiedVendorsByLevel]);

  // Transform assessment status flow for step progress bar
  const statusFlowSteps = useMemo(() => {
    return Array.isArray(assessmentStatusFlow)
      ? assessmentStatusFlow.map(item => ({
          label: item.label,
          count: item.count,
          color: STATUS_COLORS[item.label] || 'var(--status-info)',
        }))
      : [];
  }, [assessmentStatusFlow]);

  // Transform state-wise vendors for table (add id for DataGrid)
  const tableRows = useMemo(() => {
    return Array.isArray(stateWiseVendors)
      ? stateWiseVendors.map((item, idx) => ({
          id: idx + 1,
          ...item,
        }))
      : [];
  }, [stateWiseVendors]);

  // Get enterprise types for dropdown
  const enterpriseTypes = enterpriseDistribution && typeof enterpriseDistribution === 'object' ? Object.keys(enterpriseDistribution) : [];
  const vendorTypes = certifiedVendorsByLevel && typeof certifiedVendorsByLevel === 'object' ? Object.keys(certifiedVendorsByLevel) : [];

  // Default summary cards if data is not available
  const defaultSummaryCards = [
    { label: 'Active Applications', value: 0 },
    { label: 'Payment Pending', value: 0 },
    { label: 'Pending Approval', value: 0 },
    { label: 'In Progress Applications', value: 0 },
    { label: 'Ready for Committee Review', value: 0 },
  ];

  // Use default cards if summaryCards is undefined or empty
  const displaySummaryCards = summaryCards && summaryCards.length > 0 ? summaryCards : defaultSummaryCards;

  // Show error state
  if (dashboardError) {
    return (
      <Layout>
        <div className="main-content-inner">
          <div className="container">
            <div className="alert alert-danger">Unable to load dashboard data. Please refresh the page or try again later.</div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          {/* Summary Cards */}
          <div className="row margin-bottom-20 row-gap-20">
            {displaySummaryCards.map((card, idx) => {
              const config = CARD_CONFIG[card.label] || {};
              // Prefer the local status route mapping; fall back to any route the API supplies.
              const targetRoute = config.route || card.route;
              return (
                <div className="col-12 col-sm-6 col-xl-4" key={idx}>
                  <div
                    className="statCard"
                    style={{
                      ...(config.color ? { borderLeftColor: config.color } : {}),
                      cursor: targetRoute ? 'pointer' : 'default',
                    }}
                    onClick={() => targetRoute && navigate(targetRoute)}>
                    <div className="d-flex flex-row gap-16">
                      <div className="statIconContainer" style={config.bgColor ? { backgroundColor: config.bgColor } : undefined}>
                        <img src={config.icon || Icons.clipboard} alt={card.label} className="icon-36" />
                      </div>
                      <div className="row flex-item-content-center dashboard-card">
                        <h4 className="fs-22 fw-600 padding-right-6 heading-color mb-1">{card.value ?? 0}</h4>
                        <span className="fs-14 fw-500 text-3-color">{card.label}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Assessment Status Flow */}
          <div className="row">
            <div className="col-12">
              <StepProgressBar steps={statusFlowSteps} loading={dashboardLoading} error={dashboardError} title="Assessment Status Flow" />
            </div>
          </div>

          {/* Charts Row: Pie Chart + Bar Chart */}
          <div className="row">
            <div className="col-xxl-5 col-xl-5 col-lg-12">
              <div className="details-card" style={vendorTypes.length > 0 ? { height: '495px' } : undefined}>
                {vendorTypes.length > 0 ? (
                  <AppPieChartCard title="Certified" types={vendorTypes} data={vendorPieChartData} defaultType={vendorTypes[0]} />
                ) : (
                  <div style={{ height: '495px', display: 'flex', flexDirection: 'column' }}>
                    <h2 className="fs-20 fw-600 heading-color mb-3">Certified</h2>
                    <div className="text-center fs-16 fw-500 text-3-color" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      No certified vendor data available
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="col-xxl-7 col-xl-7 col-lg-12">
              {enterpriseTypes.length > 0 ? (
                <AppStackedBarChartCard
                  title="Enterprise Distribution"
                  categories={enterpriseTypes.slice(0, 2).map(type => ({ value: type, label: type }))}
                  chartData={enterpriseChartData}
                  defaultCategory={enterpriseTypes[0]}
                  height={346}
                />
              ) : (
                <div className="details-card">
                  <div style={{ height: '452px', display: 'flex', flexDirection: 'column' }}>
                    <h2 className="fs-20 fw-600 heading-color mb-3">Enterprise Distribution</h2>
                    <div className="text-center fs-16 fw-500 text-3-color" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      No enterprise distribution data available
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* State-Wise Vendors Table */}
          <div className="margin-bottom-20">
            <div className="table-container">
              <div className="table-header">
                <div className="table-header-left">
                  <h1 className="page-heading">State-Wise Enterprise</h1>
                </div>
              </div>
              <div className="table-wrapper">
                <AppDataGrid
                  rows={tableRows}
                  columns={columns}
                  server={false}
                  page={statePagination.page}
                  pageSize={statePagination.pageSize}
                  onPaginationChange={setStatePagination}
                  extraProps={{ hideFooter: tableRows.length <= 10 }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
