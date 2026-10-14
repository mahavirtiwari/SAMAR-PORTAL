import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Icons from '../../constants/Icons';

/**
 * AppCommonModal
 * A reusable modal component with customizable styling, title, content, and footer via props.
 *
 * Props:
 * - open: boolean (modal open state)
 * - onClose: function (close handler)
 * - title: string | ReactNode (modal title)
 * - modalContent: ReactNode (main modal content)
 * - modalFooter: ReactNode (footer actions/buttons)
 * - dialogProps: object (extra Dialog props)
 * - paperSx: object (custom PaperProps sx styling)
 */
const AppCommonModal = ({ open, onClose, modalHeader, modalContent, modalFooter, dialogProps = {}, paperSx = {}, crossBtn }) => {
  // Keep the modal open when the user clicks the backdrop; only close via the
  // close button, Escape key, or a programmatic call.
  const handleClose = (event, reason) => {
    if (reason === 'backdropClick') {
      return;
    }
    onClose?.(event, reason);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth={false}
      {...dialogProps}
      slotProps={{
        paper: { sx: paperSx },
      }}>
      {modalHeader && (
        <DialogTitle className="model-header">
          {modalHeader}
          {!crossBtn && (
            <IconButton onClick={onClose}>
              <img src={Icons.modalCross} alt="Close" className="icon-24" />
            </IconButton>
          )}
        </DialogTitle>
      )}
      <DialogContent className="model-content">{modalContent}</DialogContent>
      {modalFooter ? <DialogActions className="model-footer">{modalFooter}</DialogActions> : null}
    </Dialog>
  );
};

export default AppCommonModal;
