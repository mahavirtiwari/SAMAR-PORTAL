import { useMemo } from 'react';
import { formatDate } from '../../utils/formatters';
import AppCommonModal from './AppCommonModal';

const ServiceDetailModal = ({ open, onClose, service }) => {
  // Compute destination country names - now stored as strings directly
  const destinationCountryNames = useMemo(() => {
    if (!service) {
      return '-';
    }
    const countries = service.exportCountries || [];
    if (!countries.length || !Array.isArray(countries)) {
      return '-';
    }
    // Countries are now stored as string names directly
    return countries.filter(Boolean).join(', ') || '-';
  }, [service]);

  if (!service) {
    return null;
  }

  // Modal title
  const modalTitle = <>Service Details</>;

  // Modal content
  const modalContent = (
    <div className="modal-table">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        <div>
          <div className="fs-12 fw-500 text-2-color mb-1">Name of Service</div>
          <div className="fs-14 fw-600 text-1-color text-capitalize">{service.serviceName || '-'}</div>
        </div>
        <div>
          <div className="fs-12 fw-500 text-2-color mb-1">Is the Service Being Supplied Internationally?</div>
          <div className="fs-14 fw-600 text-1-color">{service.isExported ? 'Yes' : 'No'}</div>
        </div>
        <div>
          <div className="fs-12 fw-500 text-2-color mb-1">Destination Country</div>
          <div className="fs-14 fw-600 text-1-color">{destinationCountryNames}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginTop: 24 }}>
        <div>
          <div className="fs-12 fw-500 text-2-color mb-1">Percentage (%) of Service Supplied Internationally</div>
          <div className="fs-14 fw-600 text-1-color">
            {service.exportPercentage === null || service.exportPercentage === undefined || service.exportPercentage === '' ? '-' : `${service.exportPercentage}%`}
          </div>
        </div>
        <div>
          <div className="fs-12 fw-500 text-2-color mb-1">Total Services Capacity Per Year</div>
          <div className="fs-14 fw-600 text-1-color">{service.totalServicesCapacity || '-'} Number</div>
        </div>
        <div>
          <div className="fs-12 fw-500 text-2-color mb-1">Current Utilized Services Capacity Per Year</div>
          <div className="fs-14 fw-600 text-1-color">{service.currentUtilizedCapacity || '-'} Number</div>
        </div>
      </div>
      <div style={{ marginTop: 24 }}>
        <div className="fs-12 fw-500 text-2-color mb-1">Date of Commencement</div>
        <div className="fs-14 fw-600 text-1-color">{service.commencementDate ? formatDate(service.commencementDate) : '-'}</div>
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

export default ServiceDetailModal;
