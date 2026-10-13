import Box from '@mui/material/Box';
import { PieChart } from '@mui/x-charts';
import PropTypes from 'prop-types';

function AppDonutChartCard({ title = 'User Distribution', data = [], height = 230 }) {
  const total = data.reduce((s, d) => s + (d.value || 0), 0);

  const chartData = data.map(item => {
    const percent = total ? Math.round((item.value / total) * 100) : 0;
    return {
      name: item.name,
      value: percent,
      color: item.color,
      label: `${item.name} (${percent}%)`,
    };
  });

  return (
    <div className="details-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px', color: '#1E293B' }}>{title}</h3>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', justifyContent: 'center' }}>
          <PieChart
            series={[
              {
                innerRadius: '2%',
                outerRadius: '100%',
                data: chartData,
                arcLabel: item => (
                  <tspan
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      fill: '#ffffff',
                      fontFamily: 'inherit',
                      textShadow: '0 1px 4px rgba(0,0,0,0.08)',
                    }}>
                    {`${item.value}%`}
                  </tspan>
                ),
              },
            ]}
            height={height}
            hideLegend={true}
          />
        </div>

        <Box sx={{ width: { xs: '100%', sm: 200 } }}>
          {chartData.map(item => (
            <Box key={item.label || item.name} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Box sx={{ width: 16, height: 16, borderRadius: '50%', background: item.color }} />
              <Box sx={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14, color: '#4B5675' }}>{item.name}</div>
              </Box>
            </Box>
          ))}
        </Box>
      </div>
    </div>
  );
}

AppDonutChartCard.propTypes = {
  title: PropTypes.string,
  data: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string,
      value: PropTypes.number,
      color: PropTypes.string,
    }),
  ),
};

export default AppDonutChartCard;
