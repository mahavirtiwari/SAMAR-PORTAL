import { Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppButton, AppDataGrid, AppDropdown } from '../../../../components/base';
import { Layout } from '../../../../components/layout';
import Icons from '../../../../constants/Icons';
import { getIntegrationFailureCategoriesAction, getIntegrationFailuresAction } from '../../../../redux/action/systemAdmin/integrationFailure/IntegrationFailureAction';
import { formatDateTime } from '../../../../utils/formatters';

const IntegrationFailures = () => {
  const dispatch = useDispatch();

  const { failures, failuresPagination, failuresLoading, failuresError, categories } = useSelector(state => state.SystemAdminIntegrationFailure);

  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [category, setCategory] = useState('');

  useEffect(() => {
    dispatch(getIntegrationFailureCategoriesAction());
  }, [dispatch]);

  useEffect(() => {
    dispatch(
      getIntegrationFailuresAction({
        page,
        perPage: pageSize,
        category: category || undefined,
      }),
    );
  }, [dispatch, page, pageSize, category]);

  const categoryOptions = useMemo(() => (Array.isArray(categories) ? categories.map(c => ({ label: c.label, value: c.key })) : []), [categories]);

  const handleReset = () => {
    setCategory('');
    setPage(1);
  };

  const rows = useMemo(
    () =>
      (Array.isArray(failures) ? failures : []).map(failure => ({
        id: failure.id,
        occurredAt: formatDateTime(failure.occurredAt),
        category: failure.category || '-',
        details: failure.details || '-',
        referenceId: failure.referenceId || '-',
      })),
    [failures],
  );

  const columns = useMemo(
    () => [
      {
        field: 'occurredAt',
        headerName: 'Date & Time (IST)',
        flex: 1.2,
        minWidth: 180,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4 className="text-3-color">{params.row.occurredAt}</h4>
          </div>
        ),
      },
      {
        field: 'category',
        headerName: 'Category',
        flex: 1,
        minWidth: 160,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4>{params.row.category}</h4>
          </div>
        ),
      },
      {
        field: 'details',
        headerName: 'Details',
        flex: 2.2,
        minWidth: 280,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <Typography variant="body2" className="text-3-color line-clamp" sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }} title={params.row.details}>
              {params.row.details}
            </Typography>
          </div>
        ),
      },
      {
        field: 'referenceId',
        headerName: 'Reference ID',
        flex: 1,
        minWidth: 150,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4 className="text-3-color">{params.row.referenceId}</h4>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="table-container">
            <div className="table-header">
              <div className="table-header-left">
                <h1 className="page-heading">Error Logs</h1>
              </div>
              <div className="table-header-right">
                <AppButton
                  variant={showFilters ? 'active-filter-btn' : 'filter-btn'}
                  size="small"
                  title={'Filters'}
                  leftIcon={showFilters ? Icons.activeFilter : Icons.filter}
                  leftIconStyle={'icon-14'}
                  onClick={() => setShowFilters(!showFilters)}
                />
              </div>
            </div>

            {showFilters && (
              <div className="filter-section">
                <div className="row" style={{ marginBottom: '16px' }}>
                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDropdown
                      name="category"
                      value={category}
                      onChange={e => {
                        setCategory(e.target.value);
                        setPage(1);
                      }}
                      options={categoryOptions}
                      label="Category"
                    />
                  </div>
                </div>
                <div className="filter-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-start' }}>
                  <AppButton variant="tertiary" size="small" title="Reset" onClick={handleReset} leftIcon={Icons.closeCircle} leftIconStyle={'icon-14'} />
                </div>
              </div>
            )}

            <div className="table-wrapper">
              <AppDataGrid
                rows={rows}
                columns={columns}
                loading={failuresLoading}
                rowCount={failuresPagination?.total || 0}
                page={page}
                pageSize={pageSize}
                onPaginationChange={model => {
                  setPage(model.page);
                  setPageSize(model.pageSize);
                }}
                emptyTitle="No Integration Failures"
                emptySubtitle={failuresError ? 'Failed to load integration failures.' : 'No integration or system-job failures recorded.'}
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default IntegrationFailures;
