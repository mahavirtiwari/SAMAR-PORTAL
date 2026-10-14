import { CircularProgress, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppButton, AppDataGrid, AppInput, AppModal } from '../../../../components/base';
import AppIconButton from '../../../../components/base/AppIconButton';
import { toastError } from '../../../../components/base/toast';
import { Layout } from '../../../../components/layout';
import Icons from '../../../../constants/Icons';
import { getFeedbackFormAction, submitBulkFeedbackAction } from '../../../../redux/action/common/ApplicationFeedbackAction';
import { resetFeedbackForm, resetSubmitState } from '../../../../redux/slices/common/ApplicationFeedbackSlice';

// StarRating component for interactive stars
const StarRating = ({ filled, total = 5, onStarClick }) => (
  <>
    {[...Array(total)].map((_, idx) =>
      onStarClick ? (
        <AppIconButton
          key={idx}
          icon={idx < filled ? Icons.starFilled : Icons.starUnfilled}
          label={`Rate ${idx + 1} out of ${total}`}
          aria-pressed={idx < filled}
          iconClassName="icon-20"
          className="margin-right-8"
          onClick={() => onStarClick(idx + 1)}
        />
      ) : (
        <img key={idx} src={idx < filled ? Icons.starFilled : Icons.starUnfilled} alt={idx < filled ? 'Filled star' : 'Empty star'} className="icon-20 margin-right-8" />
      ),
    )}
  </>
);

const getColumns = (setRowRating, handleStatusChange, isDisabled) => [
  {
    field: 'slno',
    headerName: 'S.No.',
    flex: 0.2,
    minWidth: 30,
    sortable: false,
    renderCell: params => <p className="fs-12 fw-600 mb-0 text-2-color">{params.value}</p>,
  },
  {
    field: 'feedbackQuestions',
    headerName: 'Feedback Questions',
    flex: 1.5,
    minWidth: 180,
    sortable: false,
    renderCell: params => <p className="fs-12 fw-500 mb-0 text-1-color">{params.value}</p>,
  },
  {
    field: 'action',
    headerName: 'Actions',
    flex: 1.2,
    minWidth: 200,
    sortable: false,
    headerAlign: 'right',
    renderCell: params => {
      if (params.row.type === 'star') {
        const filled = Number(params.row.rating) || 0;
        const total = 5;
        return (
          <div className="table-flex-end">
            <StarRating filled={filled} total={total} onStarClick={isDisabled ? undefined : rating => setRowRating(params.row.id, rating)} />
          </div>
        );
      } else if (params.row.type === 'status') {
        const currentValue = params.row.yesNoAnswer === true ? 'yes' : params.row.yesNoAnswer === false ? 'no' : '';
        return (
          <div className="table-flex-end">
            <RadioGroup name={`status-${params.row.id}`} value={currentValue} onChange={e => handleStatusChange(params.row.id, e.target.value)} sx={{ flexDirection: 'row' }}>
              <FormControlLabel
                value="yes"
                disabled={isDisabled}
                control={<Radio icon={<img src={Icons.uncheck} alt="" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="" className="icon-22" />} />}
                label="Yes"
                sx={{
                  marginRight: 2,
                  '& .MuiFormControlLabel-label': {
                    fontSize: '14px',
                  },
                }}
              />
              <FormControlLabel
                value="no"
                disabled={isDisabled}
                control={<Radio icon={<img src={Icons.uncheck} alt="" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="" className="icon-22" />} />}
                label="No"
                sx={{
                  '& .MuiFormControlLabel-label': {
                    fontSize: '14px',
                  },
                }}
              />
            </RadioGroup>
          </div>
        );
      }
      return null;
    },
  },
];

const ApplicationFeedback = () => {
  const [feedbackSubmittedModal, setFeedbackSubmittedModal] = useState(false);
  const [rows, setRows] = useState([]);
  const [remarks, setRemarks] = useState('');
  const [validationError, setValidationError] = useState('');
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { id } = useParams();
  const location = useLocation();
  const status = location?.state?.row;

  const { feedbackForm, feedbackFormLoading, feedbackFormError, bulkSubmitLoading, bulkSubmitSuccess, bulkSubmitError } = useSelector(state => state.ApplicationFeedback);

  // Load feedback form on mount
  useEffect(() => {
    if (id) {
      // Reset form state first to ensure clean loading state
      dispatch(resetFeedbackForm());
      setRows([]);
      setRemarks('');
      dispatch(getFeedbackFormAction(id));
    }

    // Cleanup on unmount
    return () => {
      dispatch(resetFeedbackForm());
    };
  }, [dispatch, id]);

  // Transform API data to rows
  useEffect(() => {
    if (feedbackForm?.questions) {
      const transformedRows = feedbackForm.questions.map((q, index) => ({
        id: q.questionId,
        slno: index + 1,
        feedbackQuestions: q.questionText,
        rating: q.rating || 0,
        yesNoAnswer: q.yesNoAnswer,
        type: q.type === 'rating' ? 'star' : 'status',
        hasAnswer: q.hasAnswer,
      }));
      setRows(transformedRows);
      // Set existing remarks if available
      if (feedbackForm.remarks) {
        setRemarks(feedbackForm.remarks);
      }
    }
  }, [feedbackForm]);

  // Handle successful submission
  useEffect(() => {
    if (bulkSubmitSuccess) {
      setFeedbackSubmittedModal(true);
    }
  }, [bulkSubmitSuccess]);

  // Handle submission error
  useEffect(() => {
    if (bulkSubmitError) {
      toastError(getErrorMessage(), { duration: 5000 });
    }
  }, [bulkSubmitError]);

  // Update the rating for a specific row
  const setRowRating = useCallback((id, rating) => {
    setRows(prevRows => prevRows.map(row => (row.id === id ? { ...row, rating } : row)));
    setValidationError('');
  }, []);

  // Update the status for a specific row (yes/no)
  const handleStatusChange = useCallback((id, status) => {
    setRows(prevRows => prevRows.map(row => (row.id === id ? { ...row, yesNoAnswer: status === 'yes' } : row)));
    setValidationError('');
  }, []);

  const isCompleted = status?.feedbackStatus === 'completed';

  const columns = useMemo(() => getColumns(setRowRating, handleStatusChange, isCompleted), [setRowRating, handleStatusChange, isCompleted]);

  // Validate form before submission
  const validateForm = () => {
    // Check if all rating questions have been answered
    const unansweredRatings = rows.filter(row => row.type === 'star' && (!row.rating || row.rating === 0));
    if (unansweredRatings.length > 0) {
      setValidationError(`Please provide ratings for all questions. ${unansweredRatings.length} question(s) remaining.`);
      return false;
    }

    // Check if all yes/no questions have been answered
    const unansweredStatus = rows.filter(row => row.type === 'status' && row.yesNoAnswer === undefined);
    if (unansweredStatus.length > 0) {
      setValidationError(`Please answer all Yes/No questions. ${unansweredStatus.length} question(s) remaining.`);
      return false;
    }

    setValidationError('');
    return true;
  };

  // Handle form submission
  const handleSubmit = () => {
    if (!id) {
      return;
    }

    if (!validateForm()) {
      toastError(getErrorMessage(), { duration: 5000 });
      return;
    }

    const feedbacks = rows.map(row => {
      const feedback = {
        feedbackQuestionId: row.id,
      };

      if (row.type === 'star') {
        feedback.rating = row.rating || null;
      } else {
        feedback.yesNoAnswer = row.yesNoAnswer ?? null;
      }

      return feedback;
    });
    const data = {
      feedbacks,
      remarks: remarks || null,
      id,
    };
    dispatch(submitBulkFeedbackAction(data));
  };

  // Handle modal close
  const handleModalClose = () => {
    setFeedbackSubmittedModal(false);
    dispatch(resetSubmitState());
    navigate(-1);
  };

  // Get error message for toast
  const getErrorMessage = () => {
    if (validationError) {
      return validationError;
    }
    if (bulkSubmitError) {
      return typeof bulkSubmitError === 'string' ? bulkSubmitError : bulkSubmitError?.message || 'Failed to submit feedback. Please try again.';
    }
    return 'An unexpected error occurred. Please try again.';
  };

  // Loading state - show when loading or when we have an applicationId but no data yet
  if (feedbackFormLoading || (id && !feedbackForm && !feedbackFormError)) {
    return (
      <Layout>
        <div className="main-content-inner">
          <div className="container">
            <div className="row">
              <div className="col-12">
                <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
                  <CircularProgress />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Error state for loading
  if (feedbackFormError && !feedbackForm) {
    return (
      <Layout>
        <div className="main-content-inner">
          <div className="container">
            <div className="row">
              <div className="col-12">
                <div className="table-container">
                  <div className="table-header">
                    <div className="table-header-left table-header-left-without-search">
                      <AppIconButton icon={Icons.back} label="Go back" iconClassName="icon-24" onClick={() => navigate(-1)} />
                      <div className="heading-seperator margin-left-8 margin-right-8"></div>
                      <h1 className="heading-createApp">Application Feedback</h1>
                    </div>
                  </div>
                  <div className="d-flex flex-column justify-content-center align-items-center" style={{ minHeight: '300px' }}>
                    <img src={Icons.errorStatus} alt="error" className="icon-48 margin-bottom-16" />
                    <p className="text-1-color fs-14 mb-2">Failed to load feedback form</p>
                    <p className="text-3-color fs-12 mb-3">{typeof feedbackFormError === 'string' ? feedbackFormError : 'Please try again later'}</p>
                    <AppButton variant="secondary" size="small" title="Go Back" onClick={() => navigate(-1)} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="table-container">
                <div className="table-header">
                  <div className="table-header-left table-header-left-without-search">
                    <AppIconButton icon={Icons.back} label="Go back" iconClassName="icon-24" onClick={() => navigate(-1)} />
                    <div className="heading-seperator margin-left-8 margin-right-8"></div>
                    <h1 className="heading-createApp">Application Feedback</h1>
                    <div className="heading-seperator"></div>
                    <ul className="breadCrumbHeader">
                      <li>Feedback</li>
                      <div className="dot-separator" />
                      <li>Application Feedback</li>
                    </ul>
                  </div>
                </div>

                <div className="table-wrapper">
                  <AppDataGrid rows={rows} columns={columns} server={false} pageSize={100} extraProps={{ hideFooter: true }} />
                  {isCompleted ? (
                    remarks && (
                      <div className="margin-top-30">
                        <p className="fs-16 fw-600 text-3-color mb-2">Remarks</p>
                        <p className="fs-14 fw-500 text-1-color mb-0" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', paddingBottom: '16px' }}>
                          {remarks}
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="margin-top-30">
                      <AppInput
                        inputType="textarea"
                        label="Remarks (Optional)"
                        name="remarks"
                        placeholder="Enter any additional remarks or comments"
                        customInputClass="feedback-textarea"
                        customWidth="w-100"
                        multiline={true}
                        value={remarks}
                        onChange={e => setRemarks(e.target.value)}
                      />
                    </div>
                  )}
                  {!isCompleted && (
                    <div className="rowBetween margin-top-50">
                      <AppButton variant="tertiary" size="medium" title="Cancel" onClick={() => navigate(-1)} disabled={bulkSubmitLoading} />
                      <AppButton title="Submit" size="medium" onClick={handleSubmit} loading={bulkSubmitLoading} disabled={bulkSubmitLoading || feedbackFormLoading || rows.length === 0} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        show={feedbackSubmittedModal}
        image={Icons.successCircle}
        header={'Feedback submitted successfully'}
        subHeader={'Thank you for sharing your thoughts. We appreciate your input.'}
        singleButton={true}
        buttonClassName={'w-100 primary medium'}
        buttonOnClick={handleModalClose}
        singleButtonLabel={'OK'}
      />
    </Layout>
  );
};

export default ApplicationFeedback;
