import { useCallback, useEffect, useRef, useState } from 'react';
import { getFirstServerError, hasFieldErrors, mapServerErrorsToFormik } from '../utils/serverErrorUtils';

/**
 * Custom hook for handling server-side validation errors in forms.
 *
 * This hook automatically maps server validation errors to Formik field errors
 * and provides a general error message for toast notifications.
 *
 * @param {Object} options - Configuration options
 * @param {Object} options.serverError - The error object from Redux state (e.g., createApplicationError)
 * @param {Function} options.setFieldError - Formik's setFieldError function
 * @param {Function} options.setFieldTouched - Formik's setFieldTouched function (optional, for marking fields as touched)
 * @param {Function} options.onGeneralError - Callback for general errors (for toast display)
 * @param {Function} options.resetError - Redux action to reset the error state (optional)
 * @param {Object} options.dispatch - Redux dispatch function (required if resetError is provided)
 *
 * @returns {Object} - { generalError, hasFieldErrors, clearErrors }
 *
 * @example
 * // In your form component:
 * const { createApplicationError } = useSelector(state => state.Application);
 *
 * const formik = useFormik({
 *   initialValues: { email: '', name: '' },
 *   validationSchema,
 *   onSubmit: handleSubmit,
 * });
 *
 * const { generalError } = useServerErrors({
 *   serverError: createApplicationError,
 *   setFieldError: formik.setFieldError,
 *   setFieldTouched: formik.setFieldTouched,
 *   onGeneralError: (message) => {
 *     setApiErrors(message);
 *     toastError(message);
 *   },
 *   resetError: resetCreateApplicationError,
 *   dispatch,
 * });
 */
const useServerErrors = ({ serverError, setFieldError, setFieldTouched, onGeneralError, resetError, dispatch, fieldMapping = {} }) => {
  const [generalError, setGeneralError] = useState(null);
  const processedErrorRef = useRef(null);

  /**
   * Maps a server field name to its Formik field name.
   * Useful when server returns different field names (e.g., 'Email' vs 'email').
   */
  const mapFieldName = useCallback(
    serverFieldName => {
      // Check if there's a custom mapping
      if (fieldMapping[serverFieldName]) {
        return fieldMapping[serverFieldName];
      }

      // Convert PascalCase to camelCase if needed
      if (serverFieldName && serverFieldName[0] === serverFieldName[0].toUpperCase()) {
        return serverFieldName[0].toLowerCase() + serverFieldName.slice(1);
      }

      return serverFieldName;
    },
    [fieldMapping],
  );

  /**
   * Custom setFieldError that applies field name mapping.
   */
  const mappedSetFieldError = useCallback(
    (fieldName, error) => {
      const mappedName = mapFieldName(fieldName);
      setFieldError(mappedName, error);

      // Mark the field as touched so the error shows immediately
      if (setFieldTouched) {
        setFieldTouched(mappedName, true, false);
      }
    },
    [setFieldError, setFieldTouched, mapFieldName],
  );

  /**
   * Process server errors when they change.
   */
  useEffect(() => {
    if (!serverError || !setFieldError) {
      return;
    }

    // Avoid processing the same error twice
    const errorKey = JSON.stringify(serverError);
    if (processedErrorRef.current === errorKey) {
      return;
    }
    processedErrorRef.current = errorKey;

    const error = mapServerErrorsToFormik(serverError, mappedSetFieldError);
    setGeneralError(error);

    // If there's a general error or no field errors, call the general error handler
    if (error || !hasFieldErrors(serverError)) {
      const errorMessage = error || getFirstServerError(serverError);
      if (onGeneralError && errorMessage) {
        onGeneralError(errorMessage);
      }
    }
  }, [serverError, mappedSetFieldError, onGeneralError]);

  /**
   * Clear errors and reset state.
   */
  const clearErrors = useCallback(() => {
    setGeneralError(null);
    processedErrorRef.current = null;

    if (resetError && dispatch) {
      dispatch(resetError());
    }
  }, [resetError, dispatch]);

  return {
    generalError,
    hasFieldErrors: serverError ? hasFieldErrors(serverError) : false,
    clearErrors,
    getFirstError: () => (serverError ? getFirstServerError(serverError) : null),
  };
};

export default useServerErrors;
