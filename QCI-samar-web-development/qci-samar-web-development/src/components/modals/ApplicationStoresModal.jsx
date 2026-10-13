import AppCommonModal from './AppCommonModal';

const ApplicationStoresModal = ({ open, onClose, stores, type }) => {
  // Modal title
  const modalTitle = <>{type}</>;

  // Get display name for store
  const getDisplayName = item => {
    if (typeof item === 'string') {
      return item;
    }
    return item.storeName || item.labName;
  };

  // Modal content: Render stores dynamically
  const modalContent = (
    <div>
      {stores && stores.length > 0 ? (
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          {stores?.map((store, idx) => (
            <li key={idx} className="fs-14 fw-500 text-1-color" style={{ marginBottom: idx !== stores.length - 1 ? 16 : 0, listStyleType: 'decimal' }}>
              {getDisplayName(store)}
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

export default ApplicationStoresModal;
