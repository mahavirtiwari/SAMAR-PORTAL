import AppCommonModal from './AppCommonModal';

const ApplicationLabsModal = ({ open, onClose, labs }) => {
  // Modal title
  const modalTitle = <>Services</>;

  // Get display name for lab
  const getDisplayName = item => {
    if (typeof item === 'string') {
      return item;
    }
    return item.labName || item.lab_name || JSON.stringify(item);
  };

  // Modal content: Render labs dynamically
  const modalContent = (
    <div>
      {labs && labs.length > 0 ? (
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          {labs.map((lab, idx) => (
            <li key={idx} className="fs-14 fw-500 text-1-color" style={{ marginBottom: idx !== labs.length - 1 ? 16 : 0, listStyleType: 'decimal' }}>
              {getDisplayName(lab)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="fs-14 fw-500 mb-0 text-1-color text-center">No Data Available.</p>
      )}
    </div>
  );

  return (
    <AppCommonModal
      open={open}
      onClose={onClose}
      modalHeader={modalTitle}
      modalContent={modalContent}
      paperSx={{
        width: { xs: '100%', sm: '90%', md: '800px', lg: '700px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

export default ApplicationLabsModal;
