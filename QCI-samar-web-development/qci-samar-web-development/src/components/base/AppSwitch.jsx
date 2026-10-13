import PropTypes from 'prop-types';
import '../../assets/theme/commonStyles.css';

const AppSwitch = ({ checked = false, onChange = () => undefined, id, ariaLabel, variant = 'positive', labels }) => {
  const className = `app-switch${checked ? ' switch-active' : ''}${variant === 'danger' ? ' app-switch--danger' : ''}`;
  const stateText = labels ? (checked ? labels.on : labels.off) : null;

  const control = (
    <label className={className} htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={onChange} aria-label={ariaLabel} />
      <span className="app-track">
        <span className="app-thumb" />
      </span>
    </label>
  );

  if (!stateText) {
    return control;
  }

  return (
    <span className="app-switch-field">
      {control}
      <span className={`app-switch-label${checked ? ' is-on' : ''}`}>{stateText}</span>
    </span>
  );
};

AppSwitch.propTypes = {
  checked: PropTypes.bool,
  onChange: PropTypes.func,
  id: PropTypes.string,
  ariaLabel: PropTypes.string,
  variant: PropTypes.oneOf(['positive', 'danger']),
  // Wording differs per setting: "Enabled/Disabled" reads backwards for Maintenance Mode,
  // where switching on takes the portal down.
  labels: PropTypes.shape({ on: PropTypes.string.isRequired, off: PropTypes.string.isRequired }),
};

export default AppSwitch;
