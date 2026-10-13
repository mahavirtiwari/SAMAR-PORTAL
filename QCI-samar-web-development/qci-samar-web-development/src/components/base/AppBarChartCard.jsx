import { FormControl } from '@mui/material';
import PropTypes from 'prop-types';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';
import AppDropdown from './AppDropdown';

/**
 * Reusable BarChartCard component for displaying a bar chart with selectable categories.
 *
 * Props:
 * - title: string (Card title)
 * - categories: array of { value: string, label: string }
 * - chartData: object mapping category value to array of chart data
 * - defaultCategory: string (initial selected category)
 * - xAxisKey: string (data key for X axis)
 * - yAxisKey: string (data key for Y axis)
 * - barColor: string (bar color)
 * - barSize: number (bar size)
 * - yAxisDomain: array [min, max] (Y axis domain)
 */
const AppBarChartCard = ({
  title,
  categories,
  chartData,
  defaultCategory,
  xAxisKey = 'level',
  yAxisKey = 'count',
  barColor = '#4094F7',
  barSize = 50,
  yAxisDomain = [0, 100],
  height = 315,
  searchable = true,
}) => {
  const [selectedCategory, setSelectedCategory] = useState(defaultCategory || categories[0]?.value);

  return (
    <div className="details-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="page-heading">{title}</h2>
        <FormControl variant="outlined" size="small" sx={{ width: '160px' }}>
          <AppDropdown
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            options={categories.map(cat => ({ label: cat.label, value: cat.value }))}
            label="Category"
            searchable={searchable}
          />
        </FormControl>
      </div>
      <BarChart width={'100%'} height={height} data={chartData[selectedCategory] || []}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xAxisKey} tick={{ fontWeight: 500, fontSize: 14 }} tickFormatter={value => (value === 'Startup' ? 'Start-Up' : value)} />
        <YAxis domain={yAxisDomain} tick={{ fontSize: 12 }} />
        {/* show numeric value above each bar */}
        <Bar dataKey={yAxisKey} fill={barColor} radius={[4, 4, 0, 0]} barSize={barSize}>
          <LabelList dataKey={yAxisKey} position="top" fill="#071437" fontSize={12} fontWeight={600} />
        </Bar>
      </BarChart>
    </div>
  );
};

AppBarChartCard.propTypes = {
  title: PropTypes.string.isRequired,
  categories: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    }),
  ).isRequired,
  chartData: PropTypes.object.isRequired,
  defaultCategory: PropTypes.string,
  xAxisKey: PropTypes.string,
  yAxisKey: PropTypes.string,
  barColor: PropTypes.string,
  barSize: PropTypes.number,
  yAxisDomain: PropTypes.array,
  height: PropTypes.number,
};

export default AppBarChartCard;
