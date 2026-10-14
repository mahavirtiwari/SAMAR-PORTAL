import { Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppBadge, AppButton, AppDataGrid, AppInput } from '../../../../components/base';
import { Layout } from '../../../../components/layout';
import Icons from '../../../../constants/Icons';
import useDebouncedValue from '../../../../hooks/useDebouncedValue';
import { getApplicationsForFeedbackAction } from '../../../../redux/action/common/ApplicationFeedbackAction';
import { formatDate } from '../../../../utils/formatters';
import { getBadgeVariantByLabel } from '../../../../utils/getStatusColors';

// Same list as Enterprise Admin feedback — live API, same columns/labels.
const RatingFeedback = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { applicationsForFeedback, applicationsForFeedbackLoading, applicationsForFeedbackPagination } = useSelector(state => state.ApplicationFeedback);

  useEffect(() => {
    const params = {
      q: debouncedSearch || null,
      perPage: pageSize,
      page: page,
    };
    // Abort on change so a slow earlier response cannot overwrite a newer one.
    const request = dispatch(getApplicationsForFeedbackAction(params));
    return () => request.abort();
  }, [dispatch, page, pageSize, debouncedSearch]);

  const handleSearchChange = e => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const handlePageSizeChange = newPageSize => {
    setPageSize(newPageSize);
    setPage(1);
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
          <AppButton variant="secondary" size="extraSmall" title={'View'} onClick={() => navigate(`/rating-feedback/application-feedback/${params.row.id}`, { state: { row: params.row } })}>
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
        field: 'unitSector',
        headerName: 'Enterprise/Unit Name',
        flex: 2,
        minWidth: 200,
        sortable: false,
        renderCell: params => {
          const unitName = params.row.unit?.name || '-';
          return (
            <div className="double-content line-clamp">
              <Typography variant="body2" className="heading-color" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                {unitName}
              </Typography>
            </div>
          );
        },
      },
      {
        field: 'applicationDate',
        headerName: 'Application Date',
        flex: 1.2,
        minWidth: 150,
        sortable: false,
        renderCell: params => formatDate(params.row.applicationDate),
      },
      {
        field: 'assessmentDate',
        headerName: 'Assessment Date',
        flex: 1.2,
        minWidth: 150,
        sortable: false,
        renderCell: params => formatDate(params.row.assessmentDate),
      },
      {
        field: 'status',
        headerName: 'Feedback Status',
        flex: 1.2,
        minWidth: 140,
        headerAlign: 'right',
        sortable: false,
        renderCell: params => {
          const status = params.row.feedbackStatus || 'Pending';
          return (
            <div className="table-flex-end">
              <AppBadge variant={getBadgeVariantByLabel(status) || 'warning'} label={status} />
            </div>
          );
        },
      },
    ],
    [navigate],
  );

  const rows = useMemo(
    () =>
      (applicationsForFeedback || []).map(app => ({
        ...app,
        id: app.id,
      })),
    [applicationsForFeedback],
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
                    <h1 className="page-heading">Feedback</h1>
                    <div className="input-search-document">
                      <AppInput
                        label={'Search'}
                        inputType="search"
                        name="searchQuery"
                        customInputClass={'search-input'}
                        value={searchQuery}
                        onChange={handleSearchChange}
                        placeholder="Search by application number"
                        customWidth="100%"
                        leftIcon={Icons.search}
                        marginLeft="6px"
                      />
                    </div>
                  </div>
                  <div className="table-header-right"></div>
                </div>

                <div className="table-wrapper">
                  <AppDataGrid
                    rows={rows}
                    columns={columns}
                    rowCount={applicationsForFeedbackPagination.total}
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
                    loading={applicationsForFeedbackLoading}
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

export default RatingFeedback;
