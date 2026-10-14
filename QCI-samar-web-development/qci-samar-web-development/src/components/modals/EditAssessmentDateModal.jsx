import { useState } from 'react';
import Icons from '../../constants/Icons';
import { AppButton, AppDatePicker } from '../base';
import AppCommonModal from './AppCommonModal';

const EditAssessmentDateModal = ({ open, onClose, handleClose, handleSave, disabled, loading }) => {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  // Modal title
  const modalTitle = <>Edit Assessment Date</>;

  // Modal content
  const modalContent = (
    <div className="row gap-vertical-24">
      <div className="parameter-top-card">
        <div className="row">
          <div className="col-12">
            <div className="d-flex align-items-center">
              <img alt="" src={Icons.locationGrey} className="icon-20" />
              <span className="fs-14 fw-500 text-2-color margin-left-4">Unit Location</span>
              <span className="fs-14 fw-600 heading-color margin-left-8">Gurugram, Haryana</span>
            </div>
          </div>
        </div>
      </div>
      <div className="col-md-6">
        <AppDatePicker label="Assessment Start Date" placeholder="Select date" value={startDate} onChange={setStartDate} isRequired />
      </div>
      <div className="col-md-6">
        <AppDatePicker label="Assessment End Date" placeholder="Select date" value={endDate} onChange={setEndDate} isRequired />
      </div>
    </div>
  );

  // Modal footer
  const modalFooter = (
    <>
      <AppButton variant="tertiary" size="medium" title="Cancel" onClick={onClose} />
      <AppButton variant="primary" size="medium" title="Save" onClick={handleSave || onClose} disabled={disabled} loading={loading} />
    </>
  );

  return (
    <AppCommonModal
      open={open}
      onClose={handleClose}
      modalHeader={modalTitle}
      modalContent={modalContent}
      modalFooter={modalFooter}
      paperSx={{
        width: { xs: 'calc(100% - 16px)', sm: '90%', md: '800px', lg: '700px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
        borderRadius: 3,
        p: 1,
      }}
    />
  );
};

export default EditAssessmentDateModal;
