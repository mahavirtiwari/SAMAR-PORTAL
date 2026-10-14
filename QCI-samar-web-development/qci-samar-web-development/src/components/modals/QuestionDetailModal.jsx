import { getBadgeVariantByLabel } from '../../utils/getStatusColors';
import { AppBadge } from '../base';
import AppCommonModal from './AppCommonModal';

// helper: convert a string to Title Case (capitalize each word)
const capitalizeWords = str => {
  if (!str) {
    return '';
  }
  return String(str)
    .split(' ')
    .map(word => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ''))
    .join(' ');
};

const QuestionDetailModal = ({ open, handleClose, mandatory, data }) => {
  // Modal title
  const modalTitle = (
    <div className="d-flex align-items-center gap-12">
      Question Details
      <AppBadge variant={getBadgeVariantByLabel(data?.isActive ? 'Active' : 'Inactive')} label={data?.isActive ? 'Active' : 'Inactive'} />
    </div>
  );

  // Modal content
  const modalContent = (
    <div>
      <div className="d-flex question-modal-header">
        <div className="qdSection">
          <div className="number-container margin-right-12">
            <p className="fs-18 fw-500 primary-color mb-0">01</p>
          </div>
          <h2 className="fw-500 fs-18 heading-color mb-2">{data?.questionText}</h2>
          <ul className="d-flex align-items-center question-modal-ul">
            {mandatory && (
              <>
                <li className="fs-12 fw-500 danger-primary-color">Mandatory</li>
                <li className="dot-separator" />
              </>
            )}
            <li className="fs-12 fw-500 text-3-color">
              Weightage: <span className="text-1-color">{data?.weightage}%</span>
            </li>
            <div className="vertical-divider-16" />
            <li className="fs-12 fw-500 text-3-color">
              Category: <span className="text-1-color">{capitalizeWords(data?.category) || '--'}</span>
            </li>
          </ul>
        </div>
      </div>
      <div className="questions-section">
        {data?.options?.map((option, idx) => (
          <p className={`fw-500 fs-14 text-1-color ${idx !== data.options.length - 1 ? 'margin-bottom-16' : ' mb-0'}`} key={option.key}>
            <span className="text-3-color margin-right-12">Option {String.fromCharCode(65 + idx)}:</span>
            {option.optionText}
          </p>
        ))}
      </div>
    </div>
  );

  return (
    <AppCommonModal
      open={open}
      onClose={handleClose}
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

export default QuestionDetailModal;
