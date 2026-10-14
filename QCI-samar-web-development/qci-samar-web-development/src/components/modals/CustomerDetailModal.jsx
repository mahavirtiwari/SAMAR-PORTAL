import AppCommonModal from './AppCommonModal';

const CustomerDetailModal = ({ open, onClose, customer }) => {
  if (!customer) {
    return null;
  }

  // Modal title
  const modalTitle = <>Customer Details</>;

  // Modal content
  const modalContent = (
    <div className="modal-table">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        <div>
          <div className="fs-12 fw-500 text-2-color mb-1">Name of the Customer</div>
          <div className="fs-14 fw-600 text-1-color text-capitalize">{customer.customerName}</div>
        </div>
        <div>
          <div className="fs-12 fw-500 text-2-color mb-1">Customer Type</div>
          <div className="fs-14 fw-600 text-1-color text-capitalize">{customer.customerType}</div>
        </div>
        <div>
          <div className="fs-12 fw-500 text-2-color mb-1">Country</div>
          <div className="fs-14 fw-600 text-1-color">{customer.country || '-'}</div>
        </div>
      </div>
    </div>
  );

  // Modal footer
  // const modalFooter = <AppButton variant="primary" size="medium" title={'Close'} onClick={onClose} />;

  return (
    <AppCommonModal
      open={open}
      onClose={onClose}
      modalHeader={modalTitle}
      modalContent={modalContent}
      // modalFooter={modalFooter}
      paperSx={{
        width: { xs: 'calc(100% - 16px)', sm: '90%', md: '800px', lg: '700px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

export default CustomerDetailModal;
