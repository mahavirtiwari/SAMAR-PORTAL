import PropTypes from 'prop-types';

const baseStyle = {
  background: 'none',
  border: 0,
  padding: 6,
  lineHeight: 0,
  cursor: 'pointer',
  minWidth: 32,
  minHeight: 32,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

// Icon-only action button: a real <button> so it is focusable and keyboard/touch operable.
// `label` is the accessible name (and default tooltip); the icon itself is decorative.
const AppIconButton = ({ icon, label, title, onClick, disabled, className = '', iconClassName, style, ...rest }) => (
  <button type="button" className={`app-icon-button ${className}`.trim()} aria-label={label} title={title ?? label} onClick={onClick} disabled={disabled} style={{ ...baseStyle, ...style }} {...rest}>
    <img src={icon} alt="" className={iconClassName} />
  </button>
);

AppIconButton.propTypes = {
  icon: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  title: PropTypes.string,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  iconClassName: PropTypes.string,
  style: PropTypes.object,
};

export default AppIconButton;
