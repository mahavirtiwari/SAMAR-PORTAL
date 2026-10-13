import { AppButton } from '../base';
import AppCommonModal from './AppCommonModal';

const ServiceResourceDetailModal = ({ open, onClose, resource }) => {
  if (!resource) {
    return null;
  }

  // Modal title
  const modalTitle = <>Service Resource Details</>;

  // Modal content
  const modalContent = (
    <div className="modal-table">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
        <div>
          <div className="fs-12 fw-500 text-2-color mb-1">Resource Type</div>
          <div className="fs-14 fw-600 text-1-color text-capitalize">{resource.resourceType === 'service_resource' ? 'Service Resource' : 'Outsourced Component'}</div>
        </div>
        <div>
          <div className="fs-12 fw-500 text-2-color mb-1">Resource Name</div>
          <div className="fs-14 fw-600 text-1-color text-capitalize">{resource.resourceName || '-'}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginTop: 24 }}>
        <div>
          <div className="fs-12 fw-500 text-2-color mb-1">Is from Overseas?</div>
          <div className="fs-14 fw-600 text-1-color">{resource.isImported === 'yes' || resource.isImported === true ? 'Yes' : 'No'}</div>
        </div>
        {(resource.isImported === 'yes' || resource.isImported === true) && (
          <>
            <div>
              <div className="fs-12 fw-500 text-2-color mb-1">Source Country</div>
              <div className="fs-14 fw-600 text-1-color">{resource.importCountry || '-'}</div>
            </div>
            <div>
              <div className="fs-12 fw-500 text-2-color mb-1">Overseas Sourcing (%)</div>
              <div className="fs-14 fw-600 text-1-color">{resource.importPercentage || '-'}%</div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // Modal footer
  const modalFooter = <AppButton variant="primary" size="medium" title={'Close'} onClick={onClose} />;

  return (
    <AppCommonModal
      open={open}
      onClose={onClose}
      modalHeader={modalTitle}
      modalContent={modalContent}
      modalFooter={modalFooter}
      paperSx={{
        width: { xs: '100%', sm: '90%', md: '600px', lg: '500px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

export default ServiceResourceDetailModal;
