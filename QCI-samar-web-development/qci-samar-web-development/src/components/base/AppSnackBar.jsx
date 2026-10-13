import MuiAlert from '@mui/material/Alert';
import Portal from '@mui/material/Portal';
import Slide from '@mui/material/Slide';
import Snackbar from '@mui/material/Snackbar';
import React from 'react';
import Icons from '../../constants/Icons';
import { toastDismiss, useToast } from './toast';

const severityIcons = {
  success: <img src={Icons.successStatus} alt="success" className="toast-icon" />,
  error: <img src={Icons.errorStatus} alt="error" className="toast-icon" />,
  warning: <img src={Icons.warningStatus} alt="warning" className="toast-icon" />,
  info: <img src={Icons.infoStatus} alt="info" className="toast-icon" />,
};

const variantStyles = {
  success: { backgroundColor: '#17C653' },
  error: { backgroundColor: '#F8285A' },
  warning: { backgroundColor: '#F6B100' },
  info: { backgroundColor: '#1B84FF' },
};

const CustomAlert = React.forwardRef(function CustomAlert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" icon={severityIcons[props.severity]} {...props} />;
});

const AppSnackBar = () => {
  const { open, variant, title, message, duration, anchorOrigin, key } = useToast();

  const handleClose = (_event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    toastDismiss();
  };

  return (
    <Portal>
      <Snackbar
        key={key}
        open={open}
        autoHideDuration={duration}
        onClose={handleClose}
        anchorOrigin={anchorOrigin}
        TransitionComponent={Slide}
        ContentProps={{
          sx: {
            width: 'auto',
            boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
            zIndex: 1400,
          },
        }}>
        <CustomAlert severity={variant} sx={{ width: 'auto', ...variantStyles[variant] }}>
          {title && <div style={{ fontWeight: '600', fontSize: 14, marginBottom: 0 }}>{title}</div>}
          {message && <div style={{ fontSize: 12, fontWeight: '500', marginBottom: 0 }}>{message}</div>}
        </CustomAlert>
      </Snackbar>
    </Portal>
  );
};

export default AppSnackBar;
