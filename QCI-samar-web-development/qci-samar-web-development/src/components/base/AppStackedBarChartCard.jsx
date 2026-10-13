import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AppDropdown from './AppDropdown';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div
        className="custom-tooltip"
        style={{
          backgroundColor: '#fff',
          padding: '12px 16px',
          borderRadius: '8px',
          boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
          border: '1px solid #f0f0f0',
          minWidth: '120px',
        }}>
        <div style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'Inter-SemiBold', color: '#071437', marginBottom: '8px' }}>{data.name === 'Startup' ? 'Start-Up' : data.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4094F7' }}></div>
          <span style={{ fontSize: '13px', color: '#78829D', fontFamily: 'Inter-Medium' }}>Registered</span>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#071437', fontFamily: 'Inter-SemiBold', marginLeft: 'auto' }}>{data.registered || 0}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22C55E' }}></div>
          <span style={{ fontSize: '13px', color: '#78829D', fontFamily: 'Inter-Medium' }}>Certified</span>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#071437', fontFamily: 'Inter-SemiBold', marginLeft: 'auto' }}>{data.certified || 0}</span>
        </div>
      </div>
    );
  }
  return null;
};

const AppStackedBarChartCard = ({ title, categories = [], chartData = {}, defaultCategory, height = 452 }) => {
  const [selectedCategory, setSelectedCategory] = useState(defaultCategory || categories[0]?.value);

  // Get current data based on selected category
  const currentData = chartData[selectedCategory] && chartData[selectedCategory].length > 0 ? chartData[selectedCategory] : [];

  // Auto-calculate Y-axis max from data
  const yMax = Math.max(...currentData.map(d => Math.max(d.registered || 0, d.certified || 0)), 10);

  return (
    <div className="details-card">
      <div className="d-flex align-items-center justify-content-between margin-bottom-20">
        <h2 className="fs-20 fw-600 heading-color">{title}</h2>
        {categories && categories.length > 0 && (
          <AppDropdown
            options={categories}
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            placeholder="Select Type"
            label="Sector"
            dropdownWidth="200px"
            searchable={false}
          />
        )}
      </div>
      {/* Legend */}
      <div className="d-flex align-items-center gap-4 margin-bottom-16" style={{ gap: '24px' }}>
        <div className="d-flex align-items-center" style={{ gap: '8px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#4094F7' }}></div>
          <span style={{ fontSize: '13px', color: '#78829D', fontFamily: 'Inter-Medium' }}>Registered</span>
        </div>
        <div className="d-flex align-items-center" style={{ gap: '8px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#22C55E' }}></div>
          <span style={{ fontSize: '13px', color: '#78829D', fontFamily: 'Inter-Medium' }}>Certified</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={currentData}
          barSize={24}
          barGap={4}
          margin={{
            top: 20,
            right: 20,
            left: 0,
            bottom: 5,
          }}>
          <CartesianGrid strokeDasharray="4 4" stroke="#EBEDF3" vertical={false} />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#78829D', fontFamily: 'Inter-Medium', fontSize: 13 }}
            tickFormatter={name => (name === 'Startup' ? 'Start-Up' : name)}
          />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#78829D', fontFamily: 'Inter-Medium', fontSize: 12 }} width={50} domain={[0, yMax]} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
          <Bar dataKey="registered" fill="#4094F7" radius={[6, 6, 0, 0]} />
          <Bar dataKey="certified" fill="#22C55E" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AppStackedBarChartCard;
