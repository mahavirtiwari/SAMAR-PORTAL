import PropTypes from 'prop-types';
import Icons from '../../constants/Icons';
import { formatCurrency } from '../../utils/formatters';

/**
 * Date range and totals above the Payment History table: successful and failed
 * payment counts and the total amount received.
 *
 * The figures come from the API and describe the whole filtered set, not the page on
 * screen, so they follow the date range (and any other filter) the user applies.
 * Shared by all five role screens so the tiles cannot drift apart. [TASK-08026]
 */
const PaymentSummaryTiles = ({ summary, loading = false }) => {
  const tiles = [
    {
      label: 'Total Successful Payments',
      value: summary?.successfulCount,
      icon: Icons.availableTick,
      bgColor: '#ECFDF3',
    },
    {
      label: 'Total Failed Payments',
      value: summary?.failedCount,
      icon: Icons.unavailableIcon,
      bgColor: '#FEF3F2',
    },
    {
      label: 'Total Amount (successful)',
      value: summary?.totalAmount == null ? null : formatCurrency(summary.totalAmount),
      icon: Icons.activePaymentHistory,
      bgColor: '#EAF2FF',
    },
  ];

  return (
    <div className="payment-summary-tiles">
      <div className="row">
        {tiles.map(tile => (
          <div className="col-lg-4 col-sm-6 col-12" key={tile.label}>
            <div className="statCard">
              <div className="d-flex flex-row gap-16">
                <div className="statIconContainer" style={{ backgroundColor: tile.bgColor }}>
                  <img src={tile.icon} alt="" className="icon-24" />
                </div>
                <div className="row flex-item-content-center dashboard-card">
                  {/* A dash while loading, and while the figure is genuinely absent: showing
                      0 would read as "no payments" rather than "not counted yet". */}
                  <h4 className="fs-22 fw-600 padding-right-6 heading-color mb-1">{loading || tile.value == null ? '-' : tile.value}</h4>
                  <span className="fs-14 fw-500 text-3-color">{tile.label}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

PaymentSummaryTiles.propTypes = {
  summary: PropTypes.shape({
    successfulCount: PropTypes.number,
    failedCount: PropTypes.number,
    totalAmount: PropTypes.number,
  }),
  loading: PropTypes.bool,
};

export default PaymentSummaryTiles;
