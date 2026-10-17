// StepProgressBar is now reusable and accepts props
const StepProgressBar = ({ steps = [], loading = false, error = null, title = 'Assessment Status Flow', height }) => {
  // Calculate total count for percentage width
  const total = steps.reduce((sum, s) => sum + (s.count || 0), 0);

  return (
    <div className="details-card" style={{ height: height }}>
      <div className="d-flex align-items-baseline justify-content-between flex-wrap gap-2 margin-bottom-16">
        <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: 0, color: '#1E293B' }}>{title}</h3>
        {!loading && !error && total > 0 ? <span className="fs-13 text-3-color">{total} assessments across all stages</span> : null}
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748B', fontSize: '16px' }}>Loading status...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#EF4444', fontSize: '16px' }}>{error}</div>
      ) : (
        // Each stage as a tile in flow order: step number, count and name side by
        // side, coloured like the stage. Total and share shown under the count.
        <div className="status-flow-grid">
          {steps.map((step, index) => {
            const share = total > 0 ? Math.round(((step.count || 0) / total) * 100) : 0;
            return (
              <div key={step.label} className="status-flow-tile" style={{ '--status-color': step.color }}>
                <span className="status-flow-tile__step">{String(index + 1).padStart(2, '0')}</span>
                <span className="status-flow-tile__count">{step.count ?? 0}</span>
                <span className="status-flow-tile__label">{step.label}</span>
                <span className="status-flow-tile__bar" aria-hidden="true">
                  <span style={{ width: `${share}%` }} />
                </span>
                <span className="status-flow-tile__share">{share}% of assessments</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StepProgressBar;
