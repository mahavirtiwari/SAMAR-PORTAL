import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import Icons from '../../constants/Icons';
import useFormModal from '../../hooks/useFormModal';
import { getAssessmentsAction } from '../../redux/action/common/AssessmentAction';
import { addCommitteeMeetingAction } from '../../redux/action/operationsAdmin/CommitteeMeetingAction';
import { getCommitteeMembersAction } from '../../redux/action/operationsAdmin/CommitteeMemberAction';
import { getFirstServerError } from '../../utils/serverErrorUtils';
import { AppButton, AppDatePicker, AppDropdown, AppInput, AppModal, AppMultiSelectDropdown } from '../base';
import AppTimePicker from '../base/AppTimePicker';
import AppCommonModal from './AppCommonModal';

const validationSchema = Yup.object({
  title: Yup.string().trim().max(255, 'Title cannot exceed 255 characters').required('Title is required'),
  members: Yup.array().min(1, 'Select at least one member').required('Select at least one member'),
  chair: Yup.mixed().required('Select a chair'),
  convenor: Yup.mixed().required('Select a convenor'),
  assessments: Yup.array().min(1, 'Select at least one application').required('Select at least one application'),
  meetingType: Yup.string().required('Select a meeting type'),
  meetingLink: Yup.string().when('meetingType', {
    is: 'Online',
    then: schema => schema.required('Meeting link is required').url('Enter a valid URL'),
    otherwise: schema => schema.notRequired(),
  }),
  venue: Yup.string()
    .max(500, 'Location cannot exceed 500 characters')
    .when('meetingType', {
      is: 'Offline',
      then: schema => schema.required('Location is required'),
      otherwise: schema => schema.notRequired(),
    }),
  date: Yup.string().required('Select a date'),
  time: Yup.string()
    .required('Select a time')
    .test('not-past', 'Time cannot be in the past', function (value) {
      const { date } = this.parent;
      if (!value || !date) {
        return true;
      }
      const selectedDate = dayjs(date);
      if (!selectedDate.isValid()) {
        return true;
      }
      // Only restrict the time when the meeting is scheduled for today
      if (!selectedDate.isSame(dayjs(), 'day')) {
        return true;
      }
      const [hours, minutes] = value.split(':').map(Number);
      const selectedDateTime = selectedDate.hour(hours).minute(minutes).second(0).millisecond(0);
      return selectedDateTime.isAfter(dayjs());
    }),
});

const AddMeetingModal = ({ open, handleClose, handleSave, disabled, loading, onGeneralError }) => {
  const dispatch = useDispatch();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Get loading state and data from Redux
  const { createLoading } = useSelector(state => state.CommitteeMeeting || {});
  const { members: committeeMembers, membersLoading } = useSelector(state => state.CommitteeMember || {});
  const { assessments } = useSelector(state => state.Assessment);

  const isLoading = loading || createLoading;

  // Fetch committee members when modal opens
  useEffect(() => {
    if (open) {
      dispatch(getCommitteeMembersAction({ params: { perPage: 100 } }));
    }
  }, [open, dispatch]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const timeoutId = setTimeout(() => {
      dispatch(
        getAssessmentsAction({
          status: 'ready_for_committee',
        }),
      );
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [open, dispatch]);
  // Convert committee members to dropdown options
  const baseMemberOptions = useMemo(() => {
    if (!committeeMembers || !Array.isArray(committeeMembers)) {
      return [];
    }
    return committeeMembers.map(member => ({
      label: `${member.firstName} ${member.lastName}`.trim() || member.name || 'Unknown',
      value: member.id,
    }));
  }, [committeeMembers]);

  // Filtered options will be computed after formik is available

  const assessmentsOptions = useMemo(() => {
    if (!assessments || !Array.isArray(assessments)) {
      return [];
    }
    return assessments.map(assessment => ({
      label: assessment.application.applicationNumber,
      description: assessment.application.unitName,
      value: assessment.application.id,
    }));
  }, [assessments]);

  const initialValues = useMemo(
    () => ({
      title: '',
      members: [],
      chair: '',
      convenor: '',
      assessments: [],
      meetingType: 'Online',
      meetingLink: '',
      venue: '',
      date: '',
      time: '',
      remarks: '',
    }),
    [],
  );

  const onSubmit = async values => {
    try {
      // If custom handleSave is provided, use it
      if (typeof handleSave === 'function') {
        await handleSave(values);
        setShowSuccessModal(true);
        return;
      }

      // Otherwise, dispatch the action to create the meeting
      const result = await dispatch(addCommitteeMeetingAction({ payload: values })).unwrap();
      if (result) {
        setShowSuccessModal(true);
      }
    } catch (error) {
      if (typeof onGeneralError === 'function') {
        onGeneralError(getFirstServerError(error));
      }
    }
  };

  const { formik, submitButtonProps, cancelButtonProps, getFieldError } = useFormModal({
    initialValues,
    validationSchema,
    onSubmit,
    open,
    onClose: handleClose,
    onGeneralError,
    serverError: null,
  });

  // Filtered options so selected roles are excluded from other selects
  const chairOptions = useMemo(() => {
    return baseMemberOptions.filter(opt => opt.value !== formik.values.convenor && !formik.values.members?.includes(opt.value));
  }, [baseMemberOptions, formik.values.convenor, formik.values.members]);

  const convenorOptions = useMemo(() => {
    return baseMemberOptions.filter(opt => opt.value !== formik.values.chair && !formik.values.members?.includes(opt.value));
  }, [baseMemberOptions, formik.values.chair, formik.values.members]);

  const membersOptions = useMemo(() => {
    return baseMemberOptions.filter(opt => opt.value !== formik.values.chair && opt.value !== formik.values.convenor);
  }, [baseMemberOptions, formik.values.chair, formik.values.convenor]);

  const handleCloseSubmitModal = () => {
    setShowCancelModal(false);
  };

  // Modal title
  const modalTitle = <>Add Committee Meeting</>;

  // Modal content
  const modalContent = (
    <div className="row gap-vertical-30">
      <div className="col-md-12">
        <AppInput
          label="Title"
          placeholder="Enter Title"
          name="title"
          value={formik.values.title}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          isRequired
          error={getFieldError('title')}
        />
      </div>

      <div className="col-md-6">
        <AppDropdown
          label="Select Chair"
          placeholder="Select Chair"
          options={chairOptions}
          name="chair"
          value={formik.values.chair}
          onChange={e => formik.setFieldValue('chair', e.target.value)}
          isRequired
          error={getFieldError('chair')}
          disabled={membersLoading}
        />
      </div>
      <div className="col-md-6">
        <AppDropdown
          label="Select Convenor"
          placeholder="Select Convenor"
          options={convenorOptions}
          name="convenor"
          value={formik.values.convenor}
          onChange={e => formik.setFieldValue('convenor', e.target.value)}
          isRequired
          error={getFieldError('convenor')}
          disabled={membersLoading}
        />
      </div>
      <div className="col-md-12">
        <AppMultiSelectDropdown
          label="Select Members"
          placeholder={membersLoading ? 'Loading members...' : 'Select Members'}
          options={membersOptions}
          name="members"
          value={formik.values.members}
          onChange={value => formik.setFieldValue('members', value)}
          isRequired
          error={getFieldError('members')}
          disabled={membersLoading}
        />
      </div>
      <div className="col-md-12">
        <AppMultiSelectDropdown
          richOptions
          label="Application(s)"
          placeholder="Select Application(s)"
          options={assessmentsOptions}
          name="assessments"
          value={formik.values.assessments}
          onChange={v => formik.setFieldValue('assessments', v)}
          isRequired
          error={getFieldError('assessments')}
        />
      </div>
      <div className="col-md-12">
        <FormControl component="fieldset" sx={{ marginBottom: 2, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <span className="label mb-0">Meeting Type</span>

            <RadioGroup value={formik.values.meetingType} onChange={(e, v) => formik.setFieldValue('meetingType', v ?? e?.target?.value ?? e)} row sx={{ gap: 2 }}>
              <FormControlLabel
                value="Online"
                control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                label="Online"
                sx={{
                  marginRight: 3,
                  '& .MuiFormControlLabel-label': { fontSize: '14px' },
                }}
              />

              <FormControlLabel
                value="Offline"
                control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                label="Offline"
                sx={{
                  '& .MuiFormControlLabel-label': { fontSize: '14px' },
                }}
              />
            </RadioGroup>
          </div>
        </FormControl>
      </div>
      {formik.values.meetingType === 'Online' && (
        <div className="col-md-12">
          <AppInput
            label="Meeting Link"
            placeholder="Enter Meeting Link"
            name="meetingLink"
            value={formik.values.meetingLink}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            isRequired={true}
            error={getFieldError('meetingLink')}
            multiline
          />
        </div>
      )}
      {formik.values.meetingType === 'Offline' && (
        <div className="col-md-12">
          <AppInput
            label="Location"
            placeholder="Enter Location"
            name="venue"
            value={formik.values.venue}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            isRequired={true}
            error={getFieldError('venue')}
          />
        </div>
      )}
      <div className="col-md-6">
        <AppDatePicker
          label="Date"
          placeholder="Select date"
          name="date"
          value={formik.values.date}
          onChange={value => formik.setFieldValue('date', value)}
          isRequired
          error={getFieldError('date')}
          minDate={new Date()}
        />
      </div>
      <div className="col-md-6">
        <AppTimePicker
          label="Time"
          placeholder="Select Time"
          name="time"
          value={formik.values.time}
          onChange={value => formik.setFieldValue('time', value)}
          isRequired
          error={getFieldError('time')}
          minTime={formik.values.date && dayjs(formik.values.date).isSame(dayjs(), 'day') ? dayjs() : undefined}
        />
        {/* <AppDatePicker label="Time" placeholder="Select Time" name="time" value={formik.values.time} onChange={value => formik.setFieldValue('time', value)} isRequired error={getFieldError('time')} /> */}
      </div>
      <div className="col-md-12">
        <AppInput
          label="Remarks"
          multiline
          rows={2}
          placeholder="Enter Remarks"
          name="remarks"
          value={formik.values.remarks}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={getFieldError('remarks')}
        />
      </div>
    </div>
  );

  // Modal footer
  const modalFooter = (
    <>
      <AppButton variant="tertiary" size="medium" title="Cancel" onClick={() => setShowCancelModal(true)} {...cancelButtonProps} />
      <AppButton variant="primary" size="medium" title="Schedule Meeting" {...submitButtonProps} disabled={disabled || isLoading} loading={isLoading} />
    </>
  );

  return (
    <>
      <AppCommonModal
        open={open}
        onClose={handleClose}
        modalHeader={modalTitle}
        modalContent={modalContent}
        modalFooter={modalFooter}
        paperSx={{
          width: { xs: '100%', sm: '90%', md: '800px', lg: '700px' },
          maxWidth: '98vw',
          margin: { xs: 1, sm: 2, md: 3 },
        }}
      />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--danger-light)' }}
        image={Icons.rejectIcon}
        show={showCancelModal}
        handleClose={handleCloseSubmitModal}
        header={'Confirm Cancellation?'}
        subHeader={'Any details you entered will be lost.'}
        twoButtons
        leftButton={'No, Continue'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonOnClick={handleCloseSubmitModal}
        rightButton={'Yes, Cancel'}
        rightButtonClassName={'w-100 danger-primary'}
        rightButtonOnClick={() => {
          handleCloseSubmitModal(); // close AppModal
          handleClose(); // close parent AppCommonModal
        }}
      />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        image={Icons.successCircle}
        show={showSuccessModal}
        handleClose={() => setShowSuccessModal(false)}
        header="Meeting scheduled successfully"
        subHeader="The committee meeting has been scheduled and members will be notified."
        singleButton
        singleButtonLabel="OK"
        buttonOnClick={() => {
          setShowSuccessModal(false);
          handleClose();
        }}
        buttonClassName="w-100 btn-primary"
      />
    </>
  );
};

export default AddMeetingModal;
