// StepProgressBar is now reusable and accepts props
const StepProgressBar = ({ steps = [], loading = false, error = null, title = 'Assessment Status Flow', height }) => {
  // Calculate total count for percentage width
  const total = steps.reduce((sum, s) => sum + (s.count || 0), 0);

  return (
    <div className="details-card" style={{ height: height }}>
      <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px', color: '#1E293B' }}>{title}</h3>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748B', fontSize: '16px' }}>Loading status...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#EF4444', fontSize: '16px' }}>{error}</div>
      ) : (
        <>
          <div className="stepProgressBarTrack">
            {steps.map(step => {
              const percent = total > 0 ? (step.count / total) * 100 : 0;
              return (
                <div
                  key={step.label}
                  style={{
                    background: step.color,
                    color: '#fff',
                    width: `${percent}%`,
                    minWidth: percent < 8 ? '60px' : undefined,
                    padding: '9px 5px',
                    boxSizing: 'border-box',
                    borderRadius: 4,
                    textAlign: 'center',
                    fontWeight: 600,
                    fontSize: '12px',
                    letterSpacing: '0.5px',
                    position: 'relative',
                    transition: 'transform 0.2s',
                    // borderRight: '2px solid #fff',
                    boxShadow: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  aria-label={step.label}>
                  {step.count}
                  {/* <div style={{ fontSize: '13px', fontWeight: 500, marginTop: '6px', color: 'rgba(255,255,255,0.92)' }}>{step.label}</div> */}
                </div>
              );
            })}
          </div>
          <div className="progressBarLabels">
            {steps.map(step => (
              <div key={step.label + '-legend'} style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '180px' }}>
                <span className="label-color-box" style={{ background: step.color }}></span>
                <span style={{ color: '#4B5675', fontSize: '14px', fontWeight: 500 }}>{step.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default StepProgressBar;
