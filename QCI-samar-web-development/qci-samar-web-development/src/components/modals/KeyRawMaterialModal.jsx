import { formatDate } from '../../utils/formatters';
import { AppButton } from '../base';
import AppCommonModal from './AppCommonModal';

const KeyRawMaterialModal = ({ open, onClose, product }) => {
  if (!product) {
    return null;
  }

  // Modal title
  const modalTitle = <>Key Raw Material: {product.materialName}</>;

  // Modal content
  const modalContent = (
    <div className="modal-table">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        <div>
          <div className="fs-12 fw-500 text-2-color mb-1">Key Raw Materials / Bought-Out Parts</div>
          <div className="fs-14 fw-600 text-1-color">{product.materialType}</div>
        </div>
        <div>
          <div className="fs-12 fw-500 text-2-color mb-1">Name of raw material / Name of Bought-Out Part</div>
          <div className="fs-14 fw-600 text-1-color">{product.materialName ? 'Yes' : 'No'}</div>
        </div>
        <div>
          <div className="fs-12 fw-500 text-2-color mb-1">Whether imported?</div>
          <div className="fs-14 fw-600 text-1-color">{product.isImported ? 'Yes' : 'No'}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginTop: 24 }}>
        <div>
          <div className="fs-12 fw-500 text-2-color mb-1">Percentage(%) imported</div>
          <div className="fs-14 fw-600 text-1-color">{product.importPercentage ? `${product.importPercentage}%` : '-'}</div>
        </div>
        <div>
          <div className="fs-12 fw-500 text-2-color mb-1">Name of country from which the material / part is imported</div>
          <div className="fs-14 fw-600 text-1-color">{product.importCountry}</div>
        </div>
        <div>
          <div className="fs-12 fw-500 text-2-color mb-1">Present Production Capacity Per Year</div>
          <div className="fs-14 fw-600 text-1-color">{product.presentCapacity}</div>
        </div>
      </div>
      <div style={{ marginTop: 24 }}>
        <div className="fs-12 fw-500 text-2-color mb-1">Date of Commencement</div>
        <div className="fs-14 fw-600 text-1-color">{formatDate(product.createdAt)}</div>
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
        width: { xs: '100%', sm: '90%', md: '800px', lg: '700px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

export default KeyRawMaterialModal;
