import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import AppButton from '../base/AppButton';
import AppInput from '../base/textInput/AppInput';

const AppModal = ({
  show,
  handleClose,
  onExited,
  image,
  header,
  subHeader,
  twoButtons,
  leftButton,
  leftButtonClassName,
  leftButtonLoading,
  leftButtonDisabled,
  rightButton,
  leftButtonOnClick,
  rightButtonClassName,
  rightButtonLoading,
  rightButtonDisabled,
  rightButtonOnClick,
  singleButton,
  buttonClassName,
  buttonLoading,
  buttonDisabled,
  buttonOnClick,
  singleButtonLabel,
  modalHeaderClassName,
  modalHeaderStyle,
  textAreaLabel,
  textAreaPlaceholder,
  isRequiredTextArea,
  textAreaMinLength = 10,
  textAreaMaxLength = 500,
  // Formik integration: optional
  formik,
  textAreaName,
  // Backwards-compatible handlers
  textAreaValue,
  onTextAreaChange,
  textAreaHelperText,
  disableBackdropClick,
  children,
}) => {
  const handleDialogClose = (event, reason) => {
    if (disableBackdropClick && reason === 'backdropClick') {
      return;
    }
    if (handleClose) {
      handleClose(event, reason);
    }
  };

  return (
    <Dialog
      open={show}
      onClose={handleDialogClose}
      fullWidth
      maxWidth="sm"
      className="custom-modal"
      scroll="body"
      slotProps={{
        transition: {
          onExited: onExited,
        },

        paper: {
          sx: {
            maxWidth: '500px !important', // 🔥 Your custom width
            width: '100%',
            borderRadius: '16px',
          },
        },
      }}>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 0,
          position: 'relative',
          background: modalHeaderClassName ? `var(--${modalHeaderClassName})` : undefined,
          ...modalHeaderStyle,
        }}
        className={`custom-modal-header ${modalHeaderClassName ? 'bg-' + modalHeaderClassName : ''}`}>
        <img src={image} alt="" className="img-fluid" />
      </DialogTitle>
      <DialogContent className="margin-top-40 margin-bottom-40">
        {header ? <h4 className="fs-24 fw-600 heading-color mb-0 text-center">{header}</h4> : null}
        {subHeader ? <p className="fs-14 fw-400 mb-0 text-3-color margin-top-8 text-center">{subHeader}</p> : null}
        {textAreaLabel ? (
          <div className="margin-top-32">
            <AppInput
              multiline
              label={textAreaLabel}
              placeholder={textAreaPlaceholder}
              isRequired={isRequiredTextArea}
              // Use Formik when provided, otherwise fall back to provided handlers
              value={formik && textAreaName ? formik.values?.[textAreaName] : textAreaValue}
              onChange={formik && textAreaName ? formik.handleChange : onTextAreaChange}
              onBlur={formik && textAreaName ? formik.handleBlur : undefined}
              name={textAreaName}
              rows={1.3}
              error={formik && textAreaName && formik.touched?.[textAreaName] && Boolean(formik.errors?.[textAreaName])}
              helperText={formik && textAreaName && formik.touched?.[textAreaName] && formik.errors?.[textAreaName] ? formik.errors?.[textAreaName] : textAreaHelperText || ''}
            />
          </div>
        ) : null}
        {children}
      </DialogContent>
      {(twoButtons || singleButton) && (
        <DialogActions className="gap-10 margin-top-10">
          {twoButtons ? (
            <div className="modal-double-btn">
              {leftButton && <AppButton customClass={`flex-1 ${leftButtonClassName}`} onClick={leftButtonOnClick} title={leftButton} loading={leftButtonLoading} disabled={leftButtonDisabled} />}
              {twoButtons && rightButton && (
                <AppButton customClass={`flex-1 ${rightButtonClassName}`} onClick={rightButtonOnClick} title={rightButton} loading={rightButtonLoading} disabled={rightButtonDisabled} />
              )}
            </div>
          ) : singleButton ? (
            <div className="w-100">
              <AppButton customClass={`flex-1 ${buttonClassName}`} onClick={buttonOnClick} title={singleButtonLabel} loading={buttonLoading} disabled={buttonDisabled} />
            </div>
          ) : null}
        </DialogActions>
      )}
    </Dialog>
  );
};

export default AppModal;
