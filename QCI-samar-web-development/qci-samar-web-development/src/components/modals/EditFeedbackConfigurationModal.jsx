import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import Icons from '../../constants/Icons';
import useFormModal from '../../hooks/useFormModal';
import { getFeedbackQuestionsAction, updateFeedbackQuestionAction } from '../../redux/action/systemAdmin/FeedbackAction';
import { resetFeedbackCreateUpdateDelete } from '../../redux/slices/systemAdmin/FeedbackSlice';
import { AppButton, AppInput, AppModal } from '../base';
import AppCommonModal from './AppCommonModal';

const validationSchema = Yup.object().shape({
  questionText: Yup.string().trim().max(500, 'Feedback question cannot exceed 500 characters').required('Feedback question is required'),
  type: Yup.string().required('Select a feedback type'),
});

const EditFeedbackConfigurationModal = ({ open, handleClose, data, onGeneralError }) => {
  const dispatch = useDispatch();
  const { updateError } = useSelector(state => state.SystemAdminFeedback);

  const initialValues = useMemo(
    () => ({
      questionText: data?.questionText || '',
      type: data?.type || '',
    }),
    [data],
  );

  const handleSubmit = async values => {
    await dispatch(updateFeedbackQuestionAction({ id: data?.id, ...values })).unwrap();
  };

  const handleSuccess = () => {
    dispatch(getFeedbackQuestionsAction({ page: 1, perPage: 15 }));
    dispatch(resetFeedbackCreateUpdateDelete());
  };

  const { formik, showSuccess, submitButtonProps, cancelButtonProps, getFieldError } = useFormModal({
    initialValues,
    validationSchema,
    onSubmit: handleSubmit,
    onSuccess: handleSuccess,
    onGeneralError,
    open,
    onClose: handleClose,
    serverError: updateError,
    successDuration: 3000,
  });

  const modalContent = (
    <div className="row gap-vertical-30">
      <div className="col-md-12">
        <AppInput
          inputType="textarea"
          label="Feedback Question"
          name="questionText"
          placeholder="Enter Feedback Question"
          customInputClass="feedback-textarea"
          customWidth="w-100"
          multiline={true}
          maxLength={500}
          value={formik.values.questionText}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          isRequired={true}
          error={getFieldError('questionText')}
        />
      </div>
      <div className="col-md-12">
        <FormControl component="fieldset" sx={{ marginBottom: 2, width: '100%' }}>
          <div className="radio-group-bx" style={{ display: 'flex', alignItems: 'center', flexDirection: 'row', gap: 16 }}>
            <span className="label mb-0" style={{ minWidth: 40 }}>
              Type<span className="asterics">*</span>
            </span>
            <RadioGroup name="type" value={formik.values.type} onChange={formik.handleChange} sx={{ flexDirection: 'row' }}>
              <FormControlLabel
                value="rating"
                control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                label="Rating"
                sx={{
                  marginRight: 2,
                  '& .MuiFormControlLabel-label': {
                    fontSize: '14px',
                  },
                }}
              />
              <FormControlLabel
                value="yes_no"
                control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                label="Yes/No"
                sx={{
                  '& .MuiFormControlLabel-label': {
                    fontSize: '14px',
                  },
                }}
              />
            </RadioGroup>
          </div>
          {formik.touched.type && formik.errors.type && <div className="error-text">{formik.errors.type}</div>}
        </FormControl>
      </div>
    </div>
  );

  const modalFooter = (
    <>
      <AppButton variant="tertiary" size="medium" title="Cancel" {...cancelButtonProps} />
      <AppButton title="Save" size="medium" {...submitButtonProps} />
    </>
  );

  if (showSuccess) {
    return <AppModal modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }} show={true} image={Icons.successCircle} header={'Feedback updated successfully'} subHeader={''} />;
  }

  return (
    <AppCommonModal
      open={open}
      onClose={handleClose}
      modalHeader={<>Edit Feedback Question</>}
      modalContent={modalContent}
      modalFooter={modalFooter}
      paperSx={{
        width: { xs: '100%', sm: '90%', md: '800px', lg: '800px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

export default EditFeedbackConfigurationModal;
