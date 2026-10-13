import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppDataGrid, AppPieChartCard, AppStackedBarChartCard } from '../../../components/base';
import { Layout } from '../../../components/layout';
import Icons from '../../../constants/Icons';
import { getDRDOAdminDashboardAction } from '../../../redux/action/drdoAdmin/DashboardAction';

// Chart color schemes
const CHART_COLORS = ['#FF4C61', '#FFC93E', '#3B82F6', '#8B5CF6', '#22C55E'];

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
  'Active Applications': { icon: Icons.greenClipboard, color: 'var(--badge-green)', bgColor: 'var(--success-light)', route: '/applications/active' },
  'Pending Approval': { icon: Icons.stampPendingApprovals, color: 'var(--warning-active)', bgColor: 'var(--warning-light)', route: '/pending-approval' },
  'In Progress Applications': { icon: Icons.documentText, color: 'var(--status-info)', bgColor: 'var(--info-light, #e0f2fe)', route: '/applications/in-progress' },
  Certified: { icon: Icons.certificates, color: 'var(--badge-purple)', bgColor: 'var(--purple-clarity)', route: '/certified-vendors' },
  'Committee Review Scheduled': { icon: Icons.pplCalendarTick, color: 'var(--badge-purple)', bgColor: 'var(--purple-clarity)', route: '/committee-review-scheduled' },
};

const Dashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Get dashboard data from Redux
  const { dashboardError, summaryCards, enterpriseDistribution, certifiedVendorsByLevel, stateWiseVendors } = useSelector(state => state.DRDOAdminDashboard);

  // Fetch dashboard data on mount
  useEffect(() => {
    dispatch(getDRDOAdminDashboardAction());
  }, [dispatch]);

  // Transform enterprise distribution for bar chart
  const enterpriseChartData = useMemo(() => {
    const result = {};
    Object.entries(enterpriseDistribution || {}).forEach(([type, data]) => {
      result[type] = Array.isArray(data)
        ? data.map((item, idx) => ({
            ...item,
            color: CHART_COLORS[idx % CHART_COLORS.length],
          }))
        : [];
    });
    return result;
  }, [enterpriseDistribution]);

  // Transform certified vendors for pie chart
  const vendorPieChartData = useMemo(() => {
    const result = {};
    Object.entries(certifiedVendorsByLevel || {}).forEach(([type, data]) => {
      result[type] = Array.isArray(data)
        ? data.map((item, idx) => ({
            name: item.level,
            value: item.count,
            color: CHART_COLORS[idx % CHART_COLORS.length],
          }))
        : [];
    });
    return result;
  }, [certifiedVendorsByLevel]);

  // Transform state-wise vendors for table (add id for DataGrid)
  const tableRows = useMemo(() => {
    return (stateWiseVendors || []).map((item, idx) => ({
      id: idx + 1,
      ...item,
    }));
  }, [stateWiseVendors]);

  // Get enterprise types for dropdown
  const enterpriseTypes = Object.keys(enterpriseDistribution || {});
  const vendorTypes = Object.keys(certifiedVendorsByLevel || {});

  // Default summary cards if data is not available
  const defaultSummaryCards = [
    { label: 'Active Applications', value: 0 },
    { label: 'Pending Approval', value: 0 },
    { label: 'In Progress Applications', value: 0 },
    { label: 'Certified', value: 0 },
    { label: 'Committee Review Scheduled', value: 0 },
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
              // Prefer the local route mapping; fall back to any route the API supplies.
              const targetRoute = config.route || card.route;
              return (
                <div className="col cus-col" key={idx}>
                  <div
                    className="statCard"
                    style={{
                      ...(config.color ? { borderLeftColor: config.color } : {}),
                      cursor: targetRoute ? 'pointer' : 'default',
                    }}
                    onClick={() => targetRoute && navigate(targetRoute)}>
                    <div className="d-flex flex-row gap-16">
                      <div className="statIconContainer" style={config.bgColor ? { backgroundColor: config.bgColor } : undefined}>
                        <img src={config.icon || Icons.documentText} alt={card.label} className="icon-36" />
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

          {/* Charts Row 1: Pie Chart + Bar Chart */}
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
                  page={page}
                  pageSize={pageSize}
                  onPaginationChange={model => {
                    setPage(model.page);
                    setPageSize(model.pageSize);
                  }}
                  extraProps={{
                    hideFooter: tableRows.length <= 10,
                  }}
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
