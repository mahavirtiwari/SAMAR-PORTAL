import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
// Imported from their files, not the base barrel, so the charting libraries stay in
// this lazily loaded screen's chunks instead of the shared startup bundle.
import AppPieChartCard from '../../../components/base/AppPieChartCard';
import AppStackedBarChartCard from '../../../components/base/AppStackedBarChartCard';
import { Layout } from '../../../components/layout';
import StateWiseEnterpriseTable from '../../../components/shared/StateWiseEnterpriseTable';
import Icons from '../../../constants/Icons';
import { getSystemAdminDashboardAction } from '../../../redux/action/systemAdmin/DashboardAction';
import { onActivateLink } from '../../../utils/a11y';

// Chart color schemes
const CHART_COLORS = ['#FF4C61', '#FFC93E', '#3B82F6', '#8B5CF6', '#22C55E'];

// Icon and color mappings for summary cards
const CARD_CONFIG = {
  'Total Applications': { icon: Icons.documentText, color: 'var(--status-info)', bgColor: 'var(--info-light, #e0f2fe)' },
  'Active Applications': { icon: Icons.greenClipboard, color: 'var(--badge-green)', bgColor: 'var(--success-light)', route: '/applications/active' },
  // Keyed on the label the API sends; `label` overrides it so the card reads the same as every other surface.
  'Pending Payment': { label: 'Payment Pending', icon: Icons.yellowClock, color: 'var(--warning-active)', bgColor: 'var(--warning-light)', route: '/applications/payment-pending' },
  Certified: { icon: Icons.certificates, color: 'var(--status-purple)', bgColor: 'var(--purple-clarity)' },
};

const Dashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Get dashboard data from Redux with safe defaults to avoid null/undefined
  const systemAdmin = useSelector(state => (state && state.SystemAdminDashboard) || {});
  const { dashboardError = null, summaryCards = [], enterpriseDistribution = {}, certifiedVendorsByLevel = {}, stateWiseVendors = [] } = systemAdmin;

  // Fetch dashboard data on mount
  useEffect(() => {
    dispatch(getSystemAdminDashboardAction());
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

  // Get enterprise types for dropdown
  const enterpriseTypes = enterpriseDistribution && typeof enterpriseDistribution === 'object' ? Object.keys(enterpriseDistribution) : [];
  const vendorTypes = certifiedVendorsByLevel && typeof certifiedVendorsByLevel === 'object' ? Object.keys(certifiedVendorsByLevel) : [];

  // Default summary cards if data is not available
  const defaultSummaryCards = [
    { label: 'Total Applications', value: 0 },
    { label: 'Active Applications', value: 0 },
    { label: 'Pending Payment', value: 0 },
    { label: 'Certified', value: 0 },
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
              console.log('Rendering card:', card); // Debugging log
              const config = CARD_CONFIG[card.label] || {};
              const label = config.label ?? card.label;
              // Prefer the local route mapping; fall back to any route the API supplies.
              const targetRoute = config.route || card.route;
              return (
                <div className="four-cards col cus-col" key={idx}>
                  <div
                    className="statCard"
                    style={{
                      ...(config.color ? { borderLeftColor: config.color } : {}),
                      cursor: targetRoute ? 'pointer' : 'default',
                    }}
                    {...onActivateLink(() => targetRoute && navigate(targetRoute))}>
                    <div className="d-flex flex-row gap-16">
                      <div className="statIconContainer" style={config.bgColor ? { backgroundColor: config.bgColor } : undefined}>
                        <img src={config.icon || Icons.documentText} alt={label} className="icon-36" />
                      </div>
                      <div className="row flex-item-content-center dashboard-card">
                        <h4 className="fs-22 fw-600 padding-right-6 heading-color mb-1">{card.value ?? 0}</h4>
                        <span className="fs-14 fw-500 text-3-color">{label}</span>
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
              <div className="details-card" style={vendorTypes.length > 0 ? { height: '380px' } : undefined}>
                {vendorTypes.length > 0 ? (
                  <AppPieChartCard title="Certified" types={vendorTypes} data={vendorPieChartData} defaultType={vendorTypes[0]} />
                ) : (
                  <div style={{ height: '380px', display: 'flex', flexDirection: 'column' }}>
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
                  height={240}
                />
              ) : (
                <div className="details-card">
                  <div style={{ height: '338px', display: 'flex', flexDirection: 'column' }}>
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
            <StateWiseEnterpriseTable rows={stateWiseVendors} />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
