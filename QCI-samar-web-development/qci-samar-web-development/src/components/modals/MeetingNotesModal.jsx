import AppCommonModal from './AppCommonModal';

const MeetingNotesModal = ({ open, handleClose, notes }) => {
  const modalContent = (
    <div className="row gap-vertical-30">
      <div className="col-md-12">
        <p className="fs-16 fw-500 text-1-color">{notes}</p>
      </div>
    </div>
  );

  return (
    <AppCommonModal
      open={open}
      onClose={handleClose}
      modalHeader={<>Meeting Notes</>}
      modalContent={modalContent}
      paperSx={{
        width: { xs: '100%', sm: '90%', md: '800px', lg: '800px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

export default MeetingNotesModal;
