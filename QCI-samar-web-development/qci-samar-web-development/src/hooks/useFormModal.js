import { useFormik } from 'formik';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Logger } from '../utils/logger';
import useServerErrors from './useServerErrors';

/**
 * Custom hook for managing form modals with consistent behavior.
 *
 * This hook encapsulates common form modal logic including:
 * - Form state management (via Formik)
 * - Submission loading state
 * - Server error handling (via useServerErrors)
 * - Success modal state
 * - Form reset on modal close
 * - Error clearing on modal close
 *
 * @param {Object} options - Configuration options
 * @param {boolean} options.open - Whether the modal is open
 * @param {Function} options.onClose - Callback when modal should close
 * @param {Object} options.initialValues - Initial form values
 * @param {Object} options.validationSchema - Yup validation schema
 * @param {Function} options.onSubmit - Async function to handle form submission (receives values)
 * @param {any} [options.serverError] - Server error from Redux state
 * @param {Function} [options.resetError] - Redux action creator to reset error state
 * @param {Function} [options.onGeneralError] - Callback for general/toast errors
 * @param {Object} [options.fieldMapping] - Map server field names to form field names
 * @param {string} [options.successMessage] - Message to show on success (for logging)
 * @param {number} [options.successDuration=2000] - Duration to show success modal (ms)
 * @param {boolean} [options.enableReinitialize=true] - Whether to reinitialize form when initialValues change
 * @param {Function} [options.onSuccess] - Additional callback after successful submission
 * @param {Function} [options.onError] - Additional callback when submission fails
 * @param {Function} [options.validate] - Custom validation function (in addition to schema)
 *
 * @returns {Object} Hook return values
 * @returns {Object} returns.formik - Formik instance with all form methods/state
 * @returns {boolean} returns.isSubmitting - Whether form is currently submitting
 * @returns {boolean} returns.showSuccess - Whether to show success modal
 * @returns {Function} returns.setShowSuccess - Setter for success modal visibility
 * @returns {Object} returns.submitButtonProps - Props to spread on submit button
 * @returns {Object} returns.cancelButtonProps - Props to spread on cancel button
 * @returns {Function} returns.clearErrors - Function to clear server errors
 * @returns {Function} returns.resetForm - Function to reset form to initial values
 *
 * @example
 * const {
 *   formik,
 *   isSubmitting,
 *   showSuccess,
 *   submitButtonProps,
 *   cancelButtonProps,
 * } = useFormModal({
 *   open,
 *   onClose: handleClose,
 *   initialValues: { name: '', email: '' },
 *   validationSchema: Yup.object({ name: Yup.string().required() }),
 *   onSubmit: async (values) => {
 *     await dispatch(createSomethingAction(values)).unwrap();
 *   },
 *   serverError: createError,
 *   resetError: resetCreateError,
 *   onGeneralError: (msg) => toast.error(msg),
 * });
 */
const useFormModal = ({
  // Required
  open,
  onClose,
  initialValues,
  validationSchema,
  onSubmit,

  // Error Handling
  serverError,
  resetError,
  onGeneralError,
  fieldMapping = {},

  // Optional
  successMessage,
  successDuration = 2000,
  enableReinitialize = true,
  onSuccess,
  onError,
  validate,
}) => {
  const dispatch = useDispatch();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Memoize initial values to prevent unnecessary re-renders
  const memoizedInitialValues = useMemo(() => initialValues, [JSON.stringify(initialValues)]);

  const formik = useFormik({
    initialValues: memoizedInitialValues,
    validationSchema,
    enableReinitialize,
    validate,
    onSubmit: async values => {
      setIsSubmitting(true);
      try {
        await onSubmit(values);

        if (successMessage) {
          Logger.info(successMessage);
        }

        onClose?.();
        setShowSuccess(true);

        if (successDuration > 0) {
          setTimeout(() => setShowSuccess(false), successDuration);
        }

        onSuccess?.();
      } catch (error) {
        Logger.error('Form submission failed:', error);
        onError?.(error);
        // Server errors are handled by useServerErrors hook
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  // If server error comes in after submission, hide success popup
  useEffect(() => {
    if (serverError && showSuccess) {
      setShowSuccess(false);
    }
  }, [serverError, showSuccess]);

  // Handle server errors using the dedicated hook
  const { clearErrors } = useServerErrors({
    serverError,
    setFieldError: formik.setFieldError,
    setFieldTouched: formik.setFieldTouched,
    fieldMapping,
    onGeneralError: message => {
      onGeneralError?.(message);
    },
    resetError,
    dispatch,
  });

  // Reset form and clear errors when modal closes
  useEffect(() => {
    if (!open) {
      // Clear errors immediately to prevent them from being re-applied
      clearErrors();
      // Delay form reset to allow close animation to complete
      const timer = setTimeout(() => {
        // Reset form with explicit initial values and clear all states
        formik.resetForm({
          values: memoizedInitialValues,
          errors: {},
          touched: {},
          isSubmitting: false,
          isValidating: false,
          submitCount: 0,
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Reset the form when the data behind it changes while the modal is open — but never
  // over the top of edits the user has already made. This used to overwrite live form
  // state unconditionally: a screen that opened the modal before its fetch resolved would
  // let someone start typing, then wipe every keystroke the moment the response landed,
  // and the save that followed quietly stored the original text.
  useEffect(() => {
    if (open && enableReinitialize && !formik.dirty) {
      formik.setValues(memoizedInitialValues);
    }
  }, [memoizedInitialValues, open, enableReinitialize, formik.dirty, formik.setValues]);

  // Convenience function to reset form manually
  const resetForm = useCallback(() => {
    formik.resetForm();
    clearErrors();
  }, [formik, clearErrors]);

  // Convenience props for submit button
  const submitButtonProps = useMemo(
    () => ({
      onClick: formik.handleSubmit,
      loading: isSubmitting,
      disabled: isSubmitting,
      type: 'submit',
    }),
    [formik.handleSubmit, isSubmitting],
  );

  // Convenience props for cancel button
  const cancelButtonProps = useMemo(
    () => ({
      onClick: onClose,
      disabled: isSubmitting,
    }),
    [onClose, isSubmitting],
  );

  // Helper to get field error (only shows error if field has been touched)
  const getFieldError = useCallback(fieldName => ((formik.touched[fieldName] || formik.submitCount > 0) && formik.errors[fieldName]) || '', [formik.touched, formik.errors, formik.submitCount]);

  return {
    // Formik instance
    formik,

    // State
    isSubmitting,
    showSuccess,
    setShowSuccess,

    // Button props
    submitButtonProps,
    cancelButtonProps,

    // Utilities
    clearErrors,
    resetForm,
    getFieldError,
  };
};

export default useFormModal;
