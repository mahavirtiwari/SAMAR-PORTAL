import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import Icons from '../../constants/Icons';
import { useFormModal } from '../../hooks';
import { addAssessmentQuestionOptionAction, createAssessmentQuestionAction, getAssessmentParameterQuestionsAction } from '../../redux/action/systemAdmin/AssessmentParameterAction';
import { resetAssessmentQuestionErrors } from '../../redux/slices/systemAdmin/AssessmentParameterSlice';
import { Logger } from '../../utils/logger';
import { AppButton, AppInput, AppInputWithDropdown, AppModal } from '../base';
import AppCommonModal from './AppCommonModal';

const optionLabels = ['A', 'B', 'C', 'D', 'E'];

const initialValues = {
  questionText: '',
  category: 'planning',
  weightage: '',
  options: [{ optionText: '' }, { optionText: '' }, { optionText: '' }, { optionText: '' }, { optionText: '' }],
};

const AddAssessmentQuestionModal = ({ open, handleClose, parameterId, onGeneralError, existingQuestions = [] }) => {
  const dispatch = useDispatch();

  // Get error state from Redux
  const { createQuestionError } = useSelector(state => state.SystemAdminAssessmentParameter);

  // Calculate remaining weightage dynamically from existing questions
  const totalExistingWeightage = useMemo(() => existingQuestions.reduce((sum, q) => sum + (parseInt(q.weightage, 10) || 0), 0), [existingQuestions]);
  const remainingWeightage = useMemo(() => Math.max(0, 100 - totalExistingWeightage), [totalExistingWeightage]);

  // Track current input for real-time display
  const [currentInputWeightage, setCurrentInputWeightage] = useState(0);
  const displayedRemainingWeightage = useMemo(() => Math.max(0, remainingWeightage - currentInputWeightage), [remainingWeightage, currentInputWeightage]);

  // Memoize validation schema so it updates when remainingWeightage changes
  const validationSchema = useMemo(
    () =>
      Yup.object({
        questionText: Yup.string().max(1000, 'Question cannot exceed 1000 characters').required('Question is required'),
        category: Yup.string().required('Select a category'),
        weightage: Yup.number()
          .typeError('Enter a valid number')
          .required('Weightage is required')
          .integer('Weightage must be a whole number')
          .min(1, 'Weightage must be at least 1%')
          .max(100, 'Weightage cannot exceed 100%')
          .test('max-remaining', `Weightage cannot exceed remaining ${remainingWeightage}%`, function (value) {
            if (value === undefined || value === null) {
              return true;
            }
            return value <= remainingWeightage;
          }),
        options: Yup.array()
          .of(
            Yup.object({
              optionText: Yup.string().max(1000, 'Option cannot exceed 1000 characters').required('Option text is required'),
            }),
          )
          .length(5, 'Exactly 5 options are required'),
      }),
    [remainingWeightage],
  );

  // Custom validation for duplicate options
  const validateDuplicateOptions = values => {
    const errors = {};
    const texts = values.options.map(o => (o.optionText || '').trim().toLowerCase());
    const duplicates = texts.filter((t, i) => t && texts.indexOf(t) !== i);

    if (duplicates.length > 0) {
      const duplicateSet = new Set(duplicates);
      const optionErrors = values.options.map(opt => (duplicateSet.has((opt.optionText || '').trim().toLowerCase()) ? { optionText: 'Duplicate option text' } : undefined));

      if (optionErrors.some(e => e)) {
        errors.options = optionErrors;
      }
    }

    return errors;
  };

  // Submit handler
  const handleSubmit = async values => {
    // Step 1: Create the question
    const questionPayload = {
      parameterId: parameterId,
      questionText: values.questionText,
      category: values.category,
      weightage: values.weightage,
      code: 'QMS-03',
    };
    const questionRes = await dispatch(createAssessmentQuestionAction(questionPayload)).unwrap();
    const questionId = questionRes?.data?.id || questionRes?.id;

    // Step 2: Add options with scores 1,2,3,4,5
    for (const [idx, option] of values.options.entries()) {
      await dispatch(
        addAssessmentQuestionOptionAction({
          id: questionId,
          data: {
            optionText: option.optionText,
            score: idx + 1,
          },
        }),
      ).unwrap();
    }

    // Reset slice error flags (but not activate/deactivate flags to avoid triggering parent refresh)
    dispatch(resetAssessmentQuestionErrors());

    // Fetch the questions list (parent will handle parameter refresh)
    if (parameterId) {
      try {
        await dispatch(getAssessmentParameterQuestionsAction({ parameterId, perPage: 10, page: 1 }));
      } catch (err) {
        Logger.error('Failed to fetch questions after create:', err);
      }
    }
  };

  // Use the form modal hook
  const { formik, showSuccess, submitButtonProps, cancelButtonProps } = useFormModal({
    open,
    onClose: handleClose,
    initialValues,
    validationSchema,
    validate: validateDuplicateOptions,
    onSubmit: handleSubmit,
    serverError: createQuestionError,
    resetError: resetAssessmentQuestionErrors,
    onGeneralError,
    successMessage: 'Assessment Question Added Successfully',
  });

  // Reset weightage tracking when modal closes
  useEffect(() => {
    if (!open) {
      setCurrentInputWeightage(0);
    }
  }, [open]);

  // Modal content
  const modalContent = (
    <form onSubmit={formik.handleSubmit}>
      <div className="row gap-vertical-24">
        <div className="col-md-12">
          <AppInput
            inputType="textarea"
            label="Question"
            name="questionText"
            placeholder="Enter Question"
            customInputClass="feedback-textarea"
            customWidth="w-100"
            multiline={true}
            maxLength={1000}
            value={formik.values.questionText}
            onChange={formik.handleChange}
            isRequired={true}
            error={formik.touched.questionText && Boolean(formik.errors.questionText)}
            helperText={formik.touched.questionText && formik.errors.questionText}
          />
          <div className="fs-12 text-3-color" style={{ textAlign: 'right', marginTop: '4px' }}>
            <span className="fs-14">{formik.values.questionText.length}</span>/1000
          </div>
        </div>
        <div className="col-md-12">
          <FormControl component="fieldset" sx={{ marginBottom: 2, width: '100%' }}>
            <div className="radio-group-bx" style={{ display: 'flex', alignItems: 'center', flexDirection: 'row', gap: 16 }}>
              <span className="label mb-0" style={{ minWidth: 40 }}>
                Category<span className="asterics">*</span>
              </span>
              <RadioGroup value={formik.values.category} name="category" onChange={formik.handleChange} sx={{ flexDirection: 'row' }}>
                <FormControlLabel
                  value="planning"
                  control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                  label="Planning"
                  sx={{
                    marginRight: 2,
                    '& .MuiFormControlLabel-label': {
                      fontSize: '14px',
                    },
                  }}
                />
                <FormControlLabel
                  value="deployment"
                  control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                  label="Deployment"
                  sx={{
                    '& .MuiFormControlLabel-label': {
                      fontSize: '14px',
                    },
                  }}
                />
                <FormControlLabel
                  value="monitoring"
                  control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                  label="Monitoring"
                  sx={{
                    '& .MuiFormControlLabel-label': {
                      fontSize: '14px',
                    },
                  }}
                />
              </RadioGroup>
            </div>
          </FormControl>
        </div>
        <div className="col-md-12">
          <div className="rowBetween horizontal-seperator-24 mb-0">
            <div>
              <AppInputWithDropdown
                label="Weightage"
                name="weightage"
                placeholder="Enter Weightage"
                value={formik.values.weightage}
                onChange={e => {
                  // Allow only digits, limit to 3 chars and cap at 100
                  const raw = e && e.target ? String(e.target.value) : '';
                  const digits = raw.replace(/\D/g, '').slice(0, 3);
                  const num = digits === '' ? '' : String(Math.min(Number(digits), 100));
                  formik.setFieldValue('weightage', num);
                  setCurrentInputWeightage(num === '' ? 0 : Number(num));
                }}
                isRequired={true}
                error={formik.touched.weightage && formik.errors.weightage}
                helperText={formik.touched.weightage && formik.errors.weightage}
                disableDropdown
                unit="%"
              />
            </div>

            <div className={`weightage-remaining-container ${displayedRemainingWeightage === 0 ? 'danger-color-container' : ''}`}>
              <h4 className="mb-0">
                <span className={`fs-18 fw-600 ${displayedRemainingWeightage === 0 ? 'danger-active-color' : 'info-active-color'}`}>{displayedRemainingWeightage}%</span> weightage remaining
              </h4>
            </div>
          </div>
        </div>

        <div className="col-md-12">
          <div className="fs-16 fw-600 text-2-color margin-bottom-16 text-uppercase">Options</div>
          {formik.values.options.map((option, idx) => (
            <div key={idx} style={{ marginBottom: 8 }}>
              <div className="assessment-question-container">
                <span className="question-score">
                  Score: <span className="text-1-color">{idx + 1}</span>
                </span>
              </div>

              <AppInput
                label={`Option ${optionLabels[idx]}`}
                name={`options[${idx}].optionText`}
                placeholder={`Enter Option ${optionLabels[idx]}`}
                value={option.optionText}
                onChange={e => formik.setFieldValue(`options[${idx}].optionText`, e.target.value)}
                isRequired={true}
                error={formik.touched.options?.[idx]?.optionText && formik.errors.options?.[idx]?.optionText}
                inputType="textarea"
                customInputClass="feedback-textarea"
                customWidth="w-100"
                multiline={true}
                maxLength={1000}
                inputProps={{
                  placeholder: `Enter Option`,
                }}
              />
              <div className="fs-12 text-3-color" style={{ textAlign: 'right', marginTop: '4px' }}>
                <span className="fs-14">{option.optionText.length}</span>/1000
              </div>
            </div>
          ))}
        </div>
      </div>
    </form>
  );

  // Modal footer
  const modalFooter = (
    <>
      <AppButton variant="tertiary" size="medium" title="Cancel" {...cancelButtonProps} />
      <AppButton title="Save" size="medium" {...submitButtonProps} />
    </>
  );

  return (
    <>
      <AppCommonModal
        open={open}
        onClose={handleClose}
        modalHeader={<>Add Assessment Question</>}
        modalContent={modalContent}
        modalFooter={modalFooter}
        paperSx={{
          width: { xs: '100%', sm: '90%', md: '800px', lg: '700px' },
          maxWidth: '98vw',
          margin: { xs: 1, sm: 2, md: 3 },
        }}
      />
      <AppModal modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }} show={showSuccess} image={Icons.successCircle} header={'Assessment question added successfully'} subHeader={''} />
    </>
  );
};

export default AddAssessmentQuestionModal;
