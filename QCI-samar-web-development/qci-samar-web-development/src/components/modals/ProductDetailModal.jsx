import { useMemo } from 'react';
import { formatDate, formatNumber, parseNumericOrNull } from '../../utils/formatters';
import AppCommonModal from './AppCommonModal';

const ProductDetailModal = ({ open, onClose, product }) => {
  // Compute destination country names - now stored as strings directly
  const destinationCountryNames = useMemo(() => {
    if (!product) {
      return '-';
    }
    const countries = product.exportCountries || [];
    if (!countries.length || !Array.isArray(countries)) {
      return '-';
    }
    // Countries are now stored as string names directly
    return countries.filter(Boolean).join(', ') || '-';
  }, [product]);

  if (!product) {
    return null;
  }
  // Modal title
  const modalTitle = <>Product Details</>;

  // Modal content
  const modalContent = (
    <div className="modal-table">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        <div>
          <div className="fs-12 fw-500 text-2-color mb-1">Name of Product</div>
          <div className="fs-14 fw-600 text-1-color text-capitalize">{product.productName || '-'}</div>
        </div>
        <div>
          <div className="fs-12 fw-500 text-2-color mb-1">Is the Product Being Exported?</div>
          <div className="fs-14 fw-600 text-1-color">{product.isExported ? 'Yes' : 'No'}</div>
        </div>
        <div>
          <div className="fs-12 fw-500 text-2-color mb-1">Export Country</div>
          <div className="fs-14 fw-600 text-1-color">{destinationCountryNames}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginTop: 24 }}>
        <div>
          <div className="fs-12 fw-500 text-2-color mb-1">Percentage(%) of Export of the Product</div>
          <div className="fs-14 fw-600 text-1-color">{product.exportPercentage ? `${product.exportPercentage}%` : '-'}</div>
        </div>
        <div>
          <div className="fs-12 fw-500 text-2-color mb-1">Total Production Capacity Per Year</div>
          <div className="fs-14 fw-600 text-1-color">
            {product.totalProductionCapacity ? formatNumber(parseNumericOrNull(product.totalProductionCapacity)) : '-'} {product.capacityUnit ? ` ${product.capacityUnit}` : ''}
          </div>
        </div>
        <div>
          <div className="fs-12 fw-500 text-2-color mb-1">Current Utilized Capacity Per Year</div>
          <div className="fs-14 fw-600 text-1-color">
            {product.currentUtilizedCapacity ? formatNumber(parseNumericOrNull(product.currentUtilizedCapacity)) : '-'}{' '}
            {product.capacityUnitUtilized || product.capacityUnit ? ` ${product.capacityUnitUtilized || product.capacityUnit}` : ''}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 24 }}>
        <div className="fs-12 fw-500 text-2-color mb-1">Date of Commencement</div>
        <div className="fs-14 fw-600 text-1-color"> {formatDate(product.commencementDate)}</div>
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

export default ProductDetailModal;
