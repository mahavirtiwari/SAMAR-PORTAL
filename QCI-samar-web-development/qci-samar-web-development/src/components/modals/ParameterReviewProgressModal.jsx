import { getBadgeVariantByLabel } from '../../utils/getStatusColors';
import { AppBadge, AppButton } from '../base';
import AppCommonModal from './AppCommonModal';

const ParameterReviewProgressModal = ({ open, handleClose, isService = false }) => {
  const parameters = [
    {
      id: 1,
      parameter: 'Organisation and Leadership Mindset for Quality',
      assessorScore: 5,
      committeeScore: 5,
      status: 'REVIWED',
      statusVariant: 'green',
    },
    {
      id: 2,
      parameter: 'Risk Management',
      assessorScore: 3,
      committeeScore: 2,
      status: 'CLARIFICATION REQUIRED',
      statusVariant: 'red',
    },
    {
      id: 3,
      parameter: 'Defence Quality Standards',
      assessorScore: 4,
      committeeScore: 5,
      status: 'PENDING',
      statusVariant: 'orange',
    },
  ];

  const handleReviewParameter = _parameterId => {
    // Add your review logic here
  };

  // Modal title
  const modalTitle = <>Parameter Review Progress</>;

  // Modal content
  const modalContent = (
    <div className="parameter-review-table">
      {/* Table Header */}
      <div
        className="parameter-table-header"
        style={{
          display: 'grid',
          gridTemplateColumns: '150px 2fr 150px 180px 200px',
          gap: '16px',
          padding: '12px 0',
          borderBottom: '1px solid var(--outline)',
        }}>
        <div className="fs-12 fw-600 text-4-color">ACTION</div>
        <div className="fs-12 fw-600 text-4-color">PARAMETER</div>
        <div className="fs-12 fw-600 text-4-color">{isService ? 'RA SCORE' : 'SA SCORE'}</div>
        <div className="fs-12 fw-600 text-4-color">{isService ? 'RA SCORE' : 'RC SCORE'}</div>
        <div className="fs-12 fw-600 text-4-color">STATUS</div>
      </div>

      {/* Table Rows */}
      {parameters.map(param => (
        <div
          key={param.id}
          className="parameter-table-row"
          style={{
            display: 'grid',
            gridTemplateColumns: '150px 2fr 150px 180px 200px',
            gap: '16px',
            padding: '20px 0',
            borderBottom: '1px solid #F0F0F0',
            alignItems: 'center',
          }}>
          <div>
            <AppButton variant="secondary" size="extraSmall" title="Review" onClick={() => handleReviewParameter(param.id)} />
          </div>
          <div className="fs-12 fw-500 heading-color">{param.parameter}</div>
          <div className="fs-14 fw-600 text-2-color">{param.assessorScore}</div>
          <div className="fs-14 fw-600 text-2-color">{param.committeeScore}</div>
          <div>
            <AppBadge variant={getBadgeVariantByLabel(param.statusVariant)} label={param.status} />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <AppCommonModal
      open={open}
      onClose={handleClose}
      modalHeader={modalTitle}
      modalContent={modalContent}
      paperSx={{
        width: { xs: '100%', sm: '90%', md: '1200px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

export default ParameterReviewProgressModal;
