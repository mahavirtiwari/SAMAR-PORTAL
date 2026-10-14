import { Box, FormControl, Typography } from '@mui/material';
import { PieChart } from '@mui/x-charts';
import PropTypes from 'prop-types';
import { useState } from 'react';
import AppDropdown from './AppDropdown';

/**
 * Reusable EnterpriseDistribution component for pie chart with selectable types.
 *
 * Props:
 * - title: string (Card title)
 * - types: array of string (dropdown options)
 * - data: object mapping type to array of { name, value, color }
 * - defaultType: string (initial selected type)
 */
function AppPieChartCard({ title = 'Enterprise Distribution', types, data, defaultType, height = 280 }) {
  const [selectedType, setSelectedType] = useState(defaultType || (types && types[0]));
  const chartData = data[selectedType] || [];

  return (
    <div>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}>
        <h2 className="page-heading">{title}</h2>
        <FormControl sx={{ width: '160px' }}>
          <AppDropdown
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            options={types.map(t => ({ label: t.charAt(0).toUpperCase() + t.slice(1), value: t }))}
            label="Sector"
            searchable={false}
          />
        </FormControl>
      </Box>
      <Box sx={{ width: '100%', height: { height } }}>
        <PieChart
          series={[
            {
              // Relative radii so the pie scales with the container; fixed px
              // overflowed the card once the column narrowed on small screens.
              innerRadius: '35%',
              outerRadius: '92%',
              data: chartData,
              arcLabel: item => (
                <tspan
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    fill: '#ffffff',
                    fontFamily: 'inherit',
                    textShadow: '0 1px 4px rgba(0,0,0,0.08)',
                  }}>
                  {item.value}
                </tspan>
              ),
            },
          ]}
          height={280}
          hideLegend={true}
        />
      </Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          flexWrap: 'wrap',
          mt: 2,
          gap: 2,
        }}>
        {chartData.map(item => (
          <Box
            key={item.label || item.name}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}>
            <Box sx={{ width: 16, height: 16, borderRadius: '50%', background: item.color }} />
            <Typography
              variant="body2"
              sx={{
                fontSize: 12,
                fontWeight: 500,
                color: 'text.secondary',
              }}>
              {item.name}
            </Typography>
          </Box>
        ))}
      </Box>
    </div>
  );
}

AppPieChartCard.propTypes = {
  title: PropTypes.string,
  types: PropTypes.arrayOf(PropTypes.string).isRequired,
  data: PropTypes.object.isRequired,
  defaultType: PropTypes.string,
};

export default AppPieChartCard;
