import PropTypes from 'prop-types';

const AppTableEmpty = ({ title = 'No Data Available', subtitle = 'No records to display.', height }) => {
  const resolvedHeight = typeof height === 'number' ? `${height}px` : height || '100%';

  return (
    <div className="tableEmpty text-center d-flex flex-column align-items-center justify-content-center" style={{ height: resolvedHeight }}>
      <div className="fs-16 fw-500 text-2-color">{title}</div>
      {subtitle ? <div className="fs-12 text-3-color mt-1">{subtitle}</div> : null}
    </div>
  );
};

AppTableEmpty.propTypes = {
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  subtitle: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default AppTableEmpty;
