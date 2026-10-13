import { CircularProgress, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppButton, AppDataGrid, AppInput, AppModal } from '../../../../components/base';
import { Layout } from '../../../../components/layout';
import Icons from '../../../../constants/Icons';
import { getFeedbackFormAction, submitBulkFeedbackAction } from '../../../../redux/action/common/ApplicationFeedbackAction';
import { resetFeedbackForm, resetSubmitState } from '../../../../redux/slices/common/ApplicationFeedbackSlice';

// StarRating component for interactive stars
const StarRating = ({ filled, total = 5, onStarClick }) => (
  <>
    {[...Array(total)].map((_, idx) => (
      <img
        key={idx}
        src={idx < filled ? Icons.starFilled : Icons.starUnfilled}
        alt="star"
        className="icon-20 margin-right-8"
        onClick={onStarClick ? () => onStarClick(idx + 1) : undefined}
        style={onStarClick ? { cursor: 'pointer' } : undefined}
      />
    ))}
  </>
);

const getColumns = (setRowRating, handleStatusChange) => [
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
            <StarRating filled={filled} total={total} onStarClick={rating => setRowRating(params.row.id, rating)} />
          </div>
        );
      } else if (params.row.type === 'status') {
        const currentValue = params.row.yesNoAnswer === true ? 'yes' : params.row.yesNoAnswer === false ? 'no' : '';
        return (
          <div className="table-flex-end">
            <RadioGroup name={`status-${params.row.id}`} value={currentValue} onChange={e => handleStatusChange(params.row.id, e.target.value)} sx={{ flexDirection: 'row' }}>
              <FormControlLabel
                value="yes"
                control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
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
                control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
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
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const applicationId = searchParams.get('applicationId');
  const _applicationNo = searchParams.get('applicationNo') || 'Application';

  const { feedbackForm, feedbackFormLoading, feedbackFormError, bulkSubmitLoading, bulkSubmitSuccess } = useSelector(state => state.ApplicationFeedback);

  // Transform API data to rows using useMemo
  const transformedRows = useMemo(() => {
    if (feedbackForm?.questions) {
      return feedbackForm.questions.map((q, index) => ({
        id: q.questionId,
        slno: index + 1,
        feedbackQuestions: q.question_text,
        rating: q.rating || 0,
        yesNoAnswer: q.yes_no_answer,
        type: q.type === 'rating' ? 'star' : 'status',
        remarks: q.remarks || '',
        hasAnswer: q.has_answer,
      }));
    }
    return [];
  }, [feedbackForm?.questions]);

  useEffect(() => {
    setRows(transformedRows);
  }, [transformedRows]);

  // Load feedback form on mount
  useEffect(() => {
    if (applicationId) {
      // Reset form state first to ensure clean loading state
      dispatch(resetFeedbackForm());
      setRows([]);
      setRemarks('');
      dispatch(getFeedbackFormAction(applicationId));
    }

    // Cleanup on unmount
    return () => {
      dispatch(resetFeedbackForm());
    };
  }, [dispatch, applicationId]);

  // Handle successful submission
  useEffect(() => {
    if (bulkSubmitSuccess) {
      setFeedbackSubmittedModal(true);
    }
  }, [bulkSubmitSuccess]);

  // Update the rating for a specific row
  const setRowRating = useCallback((id, rating) => {
    setRows(prevRows => prevRows.map(row => (row.id === id ? { ...row, rating } : row)));
  }, []);

  // Update the status for a specific row (yes/no)
  const handleStatusChange = useCallback((id, status) => {
    setRows(prevRows => prevRows.map(row => (row.id === id ? { ...row, yesNoAnswer: status === 'yes' } : row)));
  }, []);

  const columns = useMemo(() => getColumns(setRowRating, handleStatusChange), [setRowRating, handleStatusChange]);

  // Handle form submission
  const handleSubmit = () => {
    if (!applicationId) {
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

    dispatch(submitBulkFeedbackAction({ id: applicationId, feedbacks, remarks: remarks || null }));
  };

  // Handle modal close
  const handleModalClose = () => {
    setFeedbackSubmittedModal(false);
    dispatch(resetSubmitState());
    navigate(-1);
  };

  // Loading state - show when loading or when we have an applicationId but no data yet
  if (feedbackFormLoading || (applicationId && !feedbackForm && !feedbackFormError)) {
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

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="table-container">
                <div className="table-header">
                  <div className="table-header-left">
                    <img src={Icons.back} alt="back" className="icon-24" onClick={() => navigate(-1)} />
                    <div className="heading-seperator margin-left-8 margin-right-8"></div>
                    <h1 className="heading-createApp">Application Feedback</h1>
                    <div className="heading-seperator"></div>
                    <ul className="breadCrumbHeader">
                      <li>Feedback</li>
                      <div className="dot-separator" />
                      <li>Application Feedback</li>
                    </ul>
                  </div>
                  <div className="table-header-right">
                    <AppButton variant="primary" size="small" title={'Submit'} onClick={handleSubmit} loading={bulkSubmitLoading} disabled={bulkSubmitLoading || feedbackFormLoading} />
                  </div>
                </div>

                <div className="table-wrapper">
                  <AppDataGrid rows={rows} columns={columns} server={false} pageSize={100} extraProps={{ hideFooter: true }} />
                  <div className="margin-top-30">
                    <AppInput
                      inputType="textarea"
                      label="Remarks"
                      name="remarks"
                      placeholder="Enter Remarks"
                      customInputClass="feedback-textarea"
                      customWidth="w-100"
                      multiline={true}
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                    />
                  </div>
                  <div className="rowBetween margin-top-50">
                    <AppButton variant="tertiary" size="medium" title="Cancel" onClick={() => navigate(-1)} />
                    <AppButton title="Save" size="medium" onClick={handleSubmit} loading={bulkSubmitLoading} disabled={bulkSubmitLoading || feedbackFormLoading} />
                  </div>
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
