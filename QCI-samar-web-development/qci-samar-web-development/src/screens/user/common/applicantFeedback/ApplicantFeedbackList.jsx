import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppButton, AppDataGrid, AppInput } from '../../../../components/base';
import { Layout } from '../../../../components/layout';
import Icons from '../../../../constants/Icons';
import useDebouncedValue from '../../../../hooks/useDebouncedValue';
import { exportSubmittedFeedbackAction, getSubmittedFeedbackAction } from '../../../../redux/action/common/ApplicationFeedbackAction';
import { formatDate } from '../../../../utils/formatters';

const ApplicantFeedbackList = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [applicationNumber, setApplicationNumber] = useState('');
  const [samarId, setSamarId] = useState('');
  const debouncedApplicationNumber = useDebouncedValue(applicationNumber);
  const debouncedSamarId = useDebouncedValue(samarId);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { feedbackSubmissions, feedbackSubmissionsLoading, feedbackSubmissionsPagination } = useSelector(state => state.ApplicationFeedback);

  useEffect(() => {
    const params = {
      q: debouncedApplicationNumber || null,
      samarId: debouncedSamarId || null,
      perPage: pageSize,
      page: page,
    };
    // Abort on change so a slow earlier response cannot overwrite a newer one.
    const request = dispatch(getSubmittedFeedbackAction(params));
    return () => request.abort();
  }, [dispatch, page, pageSize, debouncedApplicationNumber, debouncedSamarId]);

  const handleApplicationNumberChange = e => {
    setApplicationNumber(e.target.value);
    setPage(1);
  };

  const handleSamarIdChange = e => {
    setSamarId(e.target.value);
    setPage(1);
  };

  const handlePageSizeChange = newPageSize => {
    setPageSize(newPageSize);
    setPage(1);
  };

  const handleExport = async () => {
    const result = await dispatch(
      exportSubmittedFeedbackAction({
        q: applicationNumber || null,
        samarId: samarId || null,
      }),
    );
    if (exportSubmittedFeedbackAction.fulfilled.match(result)) {
      const blob = new Blob([result.payload], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `feedback_submissions_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }
  };

  const columns = useMemo(
    () => [
      {
        field: 'action',
        headerName: 'Actions',
        flex: 0.7,
        minWidth: 110,
        sortable: false,
        renderCell: params => (
          <AppButton variant="secondary" size="extraSmall" title={'View'} onClick={() => navigate(`/applicant-feedback/details/${params.row.id}`, { state: { row: params.row } })}>
            View
          </AppButton>
        ),
      },
      {
        field: 'applicationNumber',
        headerName: 'Application Number',
        flex: 1.5,
        minWidth: 180,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4>{params.row.applicationNumber || '-'}</h4>
          </div>
        ),
      },
      {
        field: 'enterpriseName',
        headerName: 'Enterprise/Unit Name',
        flex: 2.2,
        minWidth: 240,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4>{params.row.enterpriseName || '-'}</h4>
            {params.row.unitName && params.row.unitName !== params.row.enterpriseName ? (
              <span className="text-3-color fs-12" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                {params.row.unitName}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        field: 'userId',
        headerName: 'Samar Id',
        flex: 1.5,
        minWidth: 180,
        sortable: false,
        renderCell: params => params.row.userSamarId || '-',
      },
      {
        field: 'feedbackDate',
        headerName: 'Feedback Date',
        flex: 1.2,
        minWidth: 150,
        sortable: false,
        renderCell: params => formatDate(params.row.feedbackDate) || '-',
      },
    ],
    [navigate],
  );

  const rows = useMemo(
    () =>
      (feedbackSubmissions || []).map(item => ({
        ...item,
        id: item.id,
      })),
    [feedbackSubmissions],
  );

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="table-container">
                <div className="table-header">
                  <div className="table-header-left">
                    <h1 className="page-heading">Applicant Feedback</h1>
                    <div className="input-search-document">
                      <AppInput
                        label={'Search'}
                        inputType="search"
                        name="applicationNumber"
                        customInputClass={'search-input'}
                        value={applicationNumber}
                        onChange={handleApplicationNumberChange}
                        placeholder="Application number or enterprise name"
                        customWidth="100%"
                        leftIcon={Icons.search}
                        marginLeft="6px"
                      />
                    </div>
                    <div className="input-search-document">
                      <AppInput
                        label={'SAMAR ID'}
                        inputType="search"
                        name="samarId"
                        customInputClass={'search-input'}
                        value={samarId}
                        onChange={handleSamarIdChange}
                        placeholder="Search by SAMAR ID"
                        customWidth="100%"
                        leftIcon={Icons.search}
                        marginLeft="6px"
                      />
                    </div>
                  </div>
                  <div className="table-header-right">
                    <AppButton variant="secondary" size="small" title={'Export'} leftIcon={Icons.exportFile} leftIconStyle={'icon-14'} onClick={handleExport} />
                  </div>
                </div>

                <div className="table-wrapper">
                  <AppDataGrid
                    rows={rows}
                    columns={columns}
                    rowCount={feedbackSubmissionsPagination.total}
                    page={page}
                    pageSize={pageSize}
                    onPaginationChange={model => {
                      if (model.page !== page) {
                        setPage(model.page);
                      }
                      if (model.pageSize !== pageSize) {
                        handlePageSizeChange(model.pageSize);
                      }
                    }}
                    loading={feedbackSubmissionsLoading}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ApplicantFeedbackList;
