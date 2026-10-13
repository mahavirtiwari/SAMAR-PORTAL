import OverviewManufacturingTab from '../applicationTab/OverviewManufacturingTab';
import OverviewServiceTab from '../applicationTab/OverviewServiceTab';
import AppCommonModal from './AppCommonModal';

const ViewApplicationDetailsModal = ({ open, onClose, handleClose, applicationDetails }) => {
  // Modal title
  const modalTitle = <>View Application Details</>;

  // Modal content
  const modalContent = (
    <div>{applicationDetails?.sector === 'service' ? <OverviewServiceTab applicationDetails={applicationDetails} /> : <OverviewManufacturingTab applicationDetails={applicationDetails} />}</div>
  );

  return (
    <AppCommonModal
      open={open}
      onClose={onClose || handleClose}
      handleClose={handleClose || onClose}
      modalHeader={modalTitle}
      modalContent={modalContent}
      paperSx={{
        width: { xs: '100%', sm: '90%', md: '800px', lg: '1400px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

export default ViewApplicationDetailsModal;
