import { Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppBadge, AppButton, AppDataGrid, AppDatePicker, AppDropdown, AppInput } from '../../../../components/base';
import { Layout } from '../../../../components/layout';
import Icons from '../../../../constants/Icons';
import { getAuditLogsAction } from '../../../../redux/action/systemAdmin/auditLog/AuditLogAction';
import { formatDateISO, formatDateTime } from '../../../../utils/formatters';

const CATEGORY_OPTIONS = [
  { label: 'All Activity', value: '' },
  { label: 'Data Changes', value: 'data' },
  { label: 'Workflow', value: 'workflow' },
  { label: 'Security', value: 'security' },
  { label: 'Authentication', value: 'authentication' },
];

const ENTITY_OPTIONS = [
  { label: 'All Items', value: '' },
  { label: 'User', value: 'User' },
  { label: 'Application', value: 'Application' },
  { label: 'Assessment', value: 'Assessment' },
  { label: 'Unit', value: 'Unit' },
  { label: 'Role', value: 'Role' },
  { label: 'Document', value: 'Document' },
  { label: 'Organization', value: 'Organization' },
  { label: 'Committee Member', value: 'CommitteeMember' },
  { label: 'Committee Meeting', value: 'CommitteeMeeting' },
];

const CATEGORY_VARIANTS = {
  data: 'blue',
  workflow: 'purple',
  security: 'orange',
  authentication: 'green',
};

const AuditLog = () => {
  const dispatch = useDispatch();

  const { auditLogs, auditLogsPagination, auditLogsLoading, auditLogsError } = useSelector(state => state.SystemAdminAuditLog);

  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    entityType: '',
    dateFrom: null,
    dateTo: null,
  });

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      dispatch(
        getAuditLogsAction({
          page,
          perPage: pageSize,
          search: searchQuery || undefined,
          category: filters.category || undefined,
          entityType: filters.entityType || undefined,
          dateFrom: filters.dateFrom ? formatDateISO(filters.dateFrom) : undefined,
          dateTo: filters.dateTo ? formatDateISO(filters.dateTo) : undefined,
        }),
      );
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [dispatch, page, pageSize, searchQuery, filters]);

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
    setPage(1);
  };

  const handleReset = () => {
    setFilters({ category: '', entityType: '', dateFrom: null, dateTo: null });
    setSearchQuery('');
    setPage(1);
  };

  const rows = useMemo(
    () =>
      (Array.isArray(auditLogs) ? auditLogs : []).map(log => ({
        id: log.id,
        userName: log.userName || 'System',
        userEmail: log.userEmail || '-',
        category: log.category,
        action: log.action || log.event,
        entityType: log.entityType,
        entityId: log.entityId,
        description: log.description || '',
        dateTime: formatDateTime(log.createdAt),
        ipAddress: log.ipAddress || '-',
      })),
    [auditLogs],
  );

  const columns = useMemo(
    () => [
      {
        field: 'user',
        headerName: 'User',
        flex: 1.6,
        minWidth: 200,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4>{params.row.userName}</h4>
            <Typography variant="body2" className="text-3-color fs-12">
              {params.row.userEmail}
            </Typography>
          </div>
        ),
      },
      {
        field: 'action',
        headerName: 'Action',
        flex: 1.2,
        minWidth: 160,
        sortable: false,
        renderCell: params => <AppBadge variant={CATEGORY_VARIANTS[params.row.category] || 'grey'} label={params.row.action} />,
      },
      {
        field: 'item',
        headerName: 'Item',
        flex: 1.6,
        minWidth: 200,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4 className="text-3-color">{params.row.entityType ? `${params.row.entityType} #${params.row.entityId}` : '-'}</h4>
            <Typography variant="body2" className="text-3-color line-clamp fs-12" sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }} title={params.row.description}>
              {params.row.description}
            </Typography>
          </div>
        ),
      },
      {
        field: 'dateTime',
        headerName: 'Date & Time (IST)',
        flex: 1.2,
        minWidth: 170,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4 className="text-3-color">{params.row.dateTime}</h4>
          </div>
        ),
      },
      {
        field: 'ipAddress',
        headerName: 'IP Address',
        flex: 1,
        minWidth: 130,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4>{params.row.ipAddress}</h4>
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
                <h1 className="page-heading">Audit Logs</h1>
                <div className="input-search-document">
                  <AppInput
                    label={'Search'}
                    inputType="search"
                    name="search"
                    customInputClass={'search-input'}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by user name or email"
                    customWidth="100%"
                    leftIcon={Icons.search}
                    marginLeft="6px"
                  />
                </div>
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
                    <AppDropdown name="category" value={filters.category} onChange={e => handleFilterChange('category', e.target.value)} options={CATEGORY_OPTIONS} label="Category" />
                  </div>
                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDropdown name="entityType" value={filters.entityType} onChange={e => handleFilterChange('entityType', e.target.value)} options={ENTITY_OPTIONS} label="Item Type" />
                  </div>
                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDatePicker label="From Date" placeholder="Select date" value={filters.dateFrom} onChange={d => handleFilterChange('dateFrom', d)} maxDate={filters.dateTo || dayjs()} />
                  </div>
                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDatePicker label="To Date" placeholder="Select date" value={filters.dateTo} onChange={d => handleFilterChange('dateTo', d)} maxDate={dayjs()} />
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
                loading={auditLogsLoading}
                rowCount={auditLogsPagination?.total || 0}
                page={page}
                pageSize={pageSize}
                onPaginationChange={model => {
                  setPage(model.page);
                  setPageSize(model.pageSize);
                }}
                emptyTitle="No Audit Entries"
                emptySubtitle={auditLogsError ? 'Failed to load audit logs.' : 'No activity recorded yet.'}
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AuditLog;
