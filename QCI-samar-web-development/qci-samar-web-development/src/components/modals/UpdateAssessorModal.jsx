import { useState } from 'react';
import Icons from '../../constants/Icons';
import { onActivate } from '../../utils/a11y';
import { AppButton, AppDropdown } from '../base';
import AppCommonModal from './AppCommonModal';

const UpdateAssessorModal = ({ open, onClose, handleClose }) => {
  const [_startDate, _setStartDate] = useState(null);
  const [_endDate, _setEndDate] = useState(null);
  const [leadAssessor, setLeadAssessor] = useState('');
  const [coAssessors, setCoAssessors] = useState(['']);

  // Modal title
  const modalTitle = <>Update Assessor</>;

  // Modal content
  const modalContent = (
    <div className="row gap-vertical-24">
      <div className="col-md-12">
        <AppDropdown label="Lead Assessor" placeholder="Select Lead Assessor" value={leadAssessor} onChange={setLeadAssessor} isRequired />
      </div>

      <div className="col-md-12">
        {coAssessors.map((coAssessor, idx) => (
          <div key={idx} style={{ marginTop: idx === 0 ? 0 : 24 }}>
            {coAssessors.length > 1 && (
              <div
                className="danger-active-color fw-500 fs-12 cursor-pointer d-flex align-items-center justify-content-end margin-bottom-2"
                {...onActivate(() => {
                  if (coAssessors.length > 1) {
                    const updated = coAssessors.filter((_, i) => i !== idx);
                    setCoAssessors(updated);
                  }
                })}>
                Remove
              </div>
            )}
            <AppDropdown
              label={'Co-Assessor'}
              placeholder="Select Co-Assessor"
              value={coAssessor}
              onChange={val => {
                const updated = [...coAssessors];
                updated[idx] = val;
                setCoAssessors(updated);
              }}
              isRequired
            />
          </div>
        ))}
        <div className="d-flex align-items-center cursor-pointer margin-top-6" {...onActivate(() => setCoAssessors([...coAssessors, '']))}>
          <img src={Icons.plusIcon} alt="Add More" />
          <span className="primary-color fw-500 fs-12">Add More</span>
        </div>
      </div>
    </div>
  );

  // Modal footer
  const modalFooter = (
    <>
      <AppButton variant="tertiary" size="medium" title="Cancel" onClick={onClose} />
      <AppButton variant="primary" size="medium" title="Save" onClick={onClose} />
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

export default UpdateAssessorModal;
