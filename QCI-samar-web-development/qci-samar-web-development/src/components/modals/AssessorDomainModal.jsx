import AppCommonModal from './AppCommonModal';

const AssessorDomainModal = ({ open, onClose, domains = [] }) => {
  // Modal title
  const modalTitle = <>Assessor Domains</>;

  // Modal content: Render domains dynamically
  const modalContent = (
    <div>
      {domains && domains.length > 0 ? (
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          {domains.map((domain, idx) => (
            <li key={idx} className="fs-14 fw-500 text-1-color" style={{ marginBottom: idx !== domains.length - 1 ? 16 : 0, listStyleType: 'decimal' }}>
              {domain?.domainName || domain}
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
        width: { xs: 'calc(100% - 16px)', sm: '90%', md: '800px', lg: '700px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

export default AssessorDomainModal;
