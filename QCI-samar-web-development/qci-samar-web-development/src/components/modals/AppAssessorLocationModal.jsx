import AppCommonModal from './AppCommonModal';

const AppAssessorLocationModal = ({ open, onClose, handleClose, userDetails }) => {
  // Modal title
  const modalTitle = <>Assessor Locations</>;

  // Modal content
  const modalContent = (
    <div>
      <div className="modal-table">
        <div className="fs-12 fw-500 text-2-color mb-1">Address</div>
        {/* <div className="fs-14 fw-600 text-1-color text-capitalize">B-92, 4th Floor, Orion Business Park, Udyog Vihar, Phase V,Gurugram, Haryana – 122016</div> */}
        <div className="fs-14 fw-600 text-1-color text-capitalize">
          {userDetails?.address ? [userDetails.address, userDetails?.district, userDetails?.state, userDetails?.pincode].filter(Boolean).join(', ') : '-'}
        </div>
      </div>
      <div className="margin-top-32">
        <h2 className="fs-16 fw-600 heading-color margin-bottom-16">Assessment Locations</h2>
        <p className="fs-14 fw-500 text-3-color margin-bottom-12">
          Assigned States:<span className="text-1-color margin-left-12">{userDetails?.assignedStates?.length ? userDetails.assignedStates.join(', ') : '-'}</span>
        </p>
      </div>
    </div>
  );

  return (
    <AppCommonModal
      open={open}
      onClose={onClose}
      modalHeader={modalTitle}
      modalContent={modalContent}
      paperSx={{
        width: { xs: 'calc(100% - 16px)', sm: '90%', md: '800px', lg: '700px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

export default AppAssessorLocationModal;
