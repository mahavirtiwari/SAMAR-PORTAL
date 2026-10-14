import PropTypes from 'prop-types';
import useContentBlocks from '../../hooks/useContentBlocks';
import { AppButton } from '../base';
import AppDatePicker from '../base/AppDatePicker';
import AppCommonModal from './AppCommonModal';

function ScheduleAssessmentModal({ open, handleClose, onClose, applicationRef, assessmentType, selectedDate, onDateChange, onConfirm, isLoading = false }) {
  // Note text is editable in Settings → Content & Disclaimers.
  const blocks = useContentBlocks(['assessment_schedule_note']);

  // Modal title

  const modalTitle = <>Select Preferred Assessment Date</>;

  // Modal content
  const modalContent = (
    <>
      <div className="modal-table grid-cus">
        <div>
          <div className="fs-12 fw-500 text-2-color mb-1">Application Reference No.</div>
          <div className="fs-14 fw-600 text-1-color">{applicationRef}</div>
        </div>

        <div>
          <div className="fs-12 fw-500 text-2-color mb-1">Assessment Type</div>
          <div className="fs-14 fw-600 text-1-color">{assessmentType}</div>
        </div>
      </div>
      <div style={{ color: '#E53E3E' }} className="fs-12 fw-600 mb-1">
        Note:
      </div>
      <div style={{ fontSize: 14, color: '#374151', marginBottom: 24 }}>
        {blocks.assessment_schedule_note?.body ||
          'Once you select your preferred assessment date, QCI reserves the right to propose an alternative date or reschedule the assessment if necessary. You will receive timely notification if any changes are made to your selected date.'}
      </div>
      <div style={{ marginBottom: 16 }}>
        <AppDatePicker
          customPlacement="top-start"
          label="Preferred Assessment Date"
          minDate={new Date()}
          value={selectedDate}
          onChange={onDateChange}
          placeholder="Select date"
          isRequired={true}
        />{' '}
      </div>
    </>
  );

  // Modal footer
  const modalFooter = (
    <>
      <AppButton variant="tertiary" size="medium" title={'Cancel'} onClick={onClose} disabled={isLoading} />
      <AppButton variant="primary" size="medium" title={'Confirm'} onClick={onConfirm} isLoading={isLoading} disabled={!selectedDate} />
    </>
  );

  return (
    <AppCommonModal
      open={open}
      onClose={onClose || handleClose}
      modalHeader={modalTitle}
      modalContent={modalContent}
      modalFooter={modalFooter}
      paperSx={{
        width: { xs: 'calc(100% - 16px)', sm: '90%', md: '800px', lg: '700px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
}

ScheduleAssessmentModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  applicationRef: PropTypes.string.isRequired,
  enterpriseName: PropTypes.string.isRequired,
  assessmentType: PropTypes.string.isRequired,
  selectedDate: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  onDateChange: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};

export default ScheduleAssessmentModal;
