import { CircularProgress } from '@mui/material';
import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { AppButton, AppDataGrid } from '../../../../components/base';
import { Layout } from '../../../../components/layout';
import Icons from '../../../../constants/Icons';
import { exportApplicationFeedbacksAction, getFeedbacksAction } from '../../../../redux/action/common/ApplicationFeedbackAction';

const StarRating = ({ filled, total = 5 }) => (
  <>
    {[...Array(total)].map((_, idx) => (
      <img key={idx} src={idx < filled ? Icons.starFilled : Icons.starUnfilled} alt="star" className="icon-20 margin-right-8" />
    ))}
  </>
);

const columns = [
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
    field: 'answer',
    headerName: 'Answer',
    flex: 1.2,
    minWidth: 200,
    sortable: false,
    headerAlign: 'right',
    renderCell: params => {
      if (params.row.type === 'rating') {
        return (
          <div className="table-flex-end">
            <StarRating filled={Number(params.row.rating) || 0} />
          </div>
        );
      }
      return <div className="table-flex-end">{params.row.formattedAnswer || '-'}</div>;
    },
  },
];

const ApplicantFeedbackDetails = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { id } = useParams();

  const { feedbacks, feedbacksLoading, feedbacksError } = useSelector(state => state.ApplicationFeedback);

  useEffect(() => {
    if (id) {
      dispatch(getFeedbacksAction({ applicationId: id, params: { perPage: 100 } }));
    }
  }, [dispatch, id]);

  const rows = useMemo(
    () =>
      (feedbacks || []).map((feedback, index) => ({
        id: feedback.id,
        slno: index + 1,
        feedbackQuestions: feedback.questionText,
        type: feedback.questionType,
        rating: feedback.rating,
        formattedAnswer: feedback.formattedAnswer,
      })),
    [feedbacks],
  );

  const remarks = (feedbacks || []).find(feedback => feedback.remarks)?.remarks || '';

  const handleExport = async () => {
    const result = await dispatch(exportApplicationFeedbacksAction(id));
    if (exportApplicationFeedbacksAction.fulfilled.match(result)) {
      const blob = new Blob([result.payload], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `feedback_${id}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }
  };

  if (feedbacksLoading) {
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

  if (feedbacksError) {
    return (
      <Layout>
        <div className="main-content-inner">
          <div className="container">
            <div className="row">
              <div className="col-12">
                <div className="table-container">
                  <div className="table-header">
                    <div className="table-header-left table-header-left-without-search">
                      <img src={Icons.back} alt="back" className="icon-24" onClick={() => navigate(-1)} style={{ cursor: 'pointer' }} />
                      <div className="heading-seperator margin-left-8 margin-right-8"></div>
                      <h1 className="heading-createApp">Applicant Feedback</h1>
                    </div>
                  </div>
                  <div className="d-flex flex-column justify-content-center align-items-center" style={{ minHeight: '300px' }}>
                    <img src={Icons.errorStatus} alt="error" className="icon-48 margin-bottom-16" />
                    <p className="text-1-color fs-14 mb-2">Failed to load feedback</p>
                    <p className="text-3-color fs-12 mb-3">{typeof feedbacksError === 'string' ? feedbacksError : 'Please try again later'}</p>
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
                    <img src={Icons.back} alt="back" className="icon-24" onClick={() => navigate(-1)} style={{ cursor: 'pointer' }} />
                    <div className="heading-seperator margin-left-8 margin-right-8"></div>
                    <h1 className="heading-createApp">Applicant Feedback</h1>
                    <div className="heading-seperator"></div>
                    <ul className="breadCrumbHeader">
                      <li>Applicant Feedback</li>
                      <div className="dot-separator" />
                      <li>Feedback Details</li>
                    </ul>
                  </div>
                  {rows.length > 0 && (
                    <div className="table-header-right">
                      <AppButton variant="secondary" size="small" title={'Export'} leftIcon={Icons.exportFile} leftIconStyle={'icon-14'} onClick={handleExport} />
                    </div>
                  )}
                </div>

                <div className="table-wrapper">
                  <AppDataGrid rows={rows} columns={columns} server={false} pageSize={100} extraProps={{ hideFooter: true }} />
                  {remarks && (
                    <div className="margin-top-30">
                      <p className="fs-16 fw-600 text-3-color mb-2">Remarks</p>
                      <p className="fs-14 fw-500 text-1-color mb-0" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', paddingBottom: '16px' }}>
                        {remarks}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ApplicantFeedbackDetails;
