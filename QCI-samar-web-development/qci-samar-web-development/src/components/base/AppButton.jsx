import ButtonBase from '@mui/material/ButtonBase';
import PropTypes from 'prop-types';
import { Spinner } from 'react-bootstrap';

const AppButton = ({ title, onClick, size = 'medium', variant = 'primary', minWidth, buttonPaddingX, disabled, rightIcon, rightIconStyle, leftIcon, leftIconStyle, customClass, type, loading }) => {
  const classNames = ['app-button', size, variant, customClass].filter(Boolean).join(' ');
  const style = {
    ...(minWidth ? { minWidth: typeof minWidth === 'number' ? `${minWidth}px` : minWidth } : {}),
    ...(buttonPaddingX ? { paddingLeft: buttonPaddingX, paddingRight: buttonPaddingX } : {}),
  };
  return (
    <ButtonBase className={classNames} style={style} onClick={onClick} disabled={disabled} type={type} focusRipple>
      {leftIcon ? <img src={leftIcon} alt="" className={`margin-right-6 ${leftIconStyle}`} /> : null}
      {title}
      {loading ? (
        <Spinner animation="border" role="status" size="sm" className="margin-left-8">
          <span className="visually-hidden"></span>
        </Spinner>
      ) : null}
      {rightIcon ? <img src={rightIcon} alt="" className={`margin-left-4 ${rightIconStyle}`} /> : null}
    </ButtonBase>
  );
};

AppButton.propTypes = {
  title: PropTypes.string.isRequired,
  onClick: PropTypes.any.isRequired,
  size: PropTypes.oneOf(['large', 'medium', 'small', 'extraSmall']),
  variant: PropTypes.oneOf(['primary', 'secondary', 'success', 'success-bg', 'tertiary', 'link', 'danger-primary', 'danger-secondary', 'danger-link', 'filter-btn']),
  minWidth: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  buttonPaddingX: PropTypes.string,
  disabled: PropTypes.bool,
  rightIcon: PropTypes.string,
  rightIconStyle: PropTypes.string,
  leftIcon: PropTypes.string,
  leftIconStyle: PropTypes.string,
  customClass: PropTypes.string,
  type: PropTypes.string,
};

export default AppButton;
