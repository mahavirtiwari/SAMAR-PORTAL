import PropTypes from 'prop-types';
import Icons from '../../constants/Icons';

/**
 * Successful and failed payment totals above the Payment History table.
 *
 * The counts come from the API and describe the whole filtered set, not the page on
 * screen, so they keep answering "how many succeeded this month" once a date range or any
 * other filter is applied. Shared by all five role screens so the tiles cannot drift
 * apart. [TASK-08026]
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
  ];

  return (
    <div className="payment-summary-tiles">
      <div className="row">
        {tiles.map(tile => (
          <div className="col-sm-6 col-12" key={tile.label}>
            <div className="statCard">
              <div className="d-flex flex-row gap-16">
                <div className="statIconContainer" style={{ backgroundColor: tile.bgColor }}>
                  <img src={tile.icon} alt={tile.label} className="icon-24" />
                </div>
                <div className="row flex-item-content-center dashboard-card">
                  {/* A dash while loading, and while the count is genuinely absent: showing
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
  }),
  loading: PropTypes.bool,
};

export default PaymentSummaryTiles;
