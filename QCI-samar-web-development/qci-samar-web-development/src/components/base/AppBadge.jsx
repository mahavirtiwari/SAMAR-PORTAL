import PropTypes from 'prop-types';

const AppBadge = ({ label = '', className = '', children, style = {}, variant = 'orange', textCapitalize, circular, icon }) => {
  return (
    <div className={`badge-container ${circular ? 'circularBadgeConatiner' : null} badge-${variant} ${className}`.trim()} style={{ ...style }}>
      {icon ? <img src={icon} alt="icon" className="icon-8 margin-right-4" /> : null}
      <p className={`mb-0 fs-11 fw-600 ${textCapitalize ? 'text-capitalize' : 'text-uppercase'}`}>{children || label}</p>
    </div>
  );
};

AppBadge.propTypes = {
  variant: PropTypes.oneOf(['brown', 'purple', 'blue', 'green', 'darkGreen', 'yellow', 'lightBlue', 'red', 'orange', 'grey']),
  label: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.node,
  style: PropTypes.object,
};

export default AppBadge;
