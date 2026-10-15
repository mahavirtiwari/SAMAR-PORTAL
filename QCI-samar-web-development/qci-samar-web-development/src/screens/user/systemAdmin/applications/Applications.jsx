import { Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppBadge, AppButton, AppDataGrid, AppDropdown, AppInput, RenewalTag } from '../../../../components/base';
import { Layout } from '../../../../components/layout';
import { applicationStatusOptions, applicationTypeOptions, classificationOptions, sectorOptions } from '../../../../constants/filterData';
import Icons from '../../../../constants/Icons';
import { useCsvExport, useListFilters } from '../../../../hooks';
import { exportApplicationsAction } from '../../../../redux/action/common/ApplicationExportAction';
import { getApplicationAction } from '../../../../redux/action/systemAdmin/application/ApplicationAction';
import { resetApplicationDetails } from '../../../../redux/slices/systemAdmin/application/ApplicationSlice';
import { formatDate } from '../../../../utils/formatters';
import { getBadgeVariantByLabel, getStatusLabel } from '../../../../utils/getStatusColors';

const Applications = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [_applicationDate, _setApplicationDate] = useState(null);
  // Filters and pagination are held in the URL so returning from a detail page
  // restores the list the user had filtered down to.
  const { filters, setFilters, appliedFilters, appliedQuery, setAppliedFilters, page, setPage, pageSize, setPageSize, resetFilters } = useListFilters({
    search: '',
    status: '',
    sector: '',
    classification: '',
    applicationType: '',
  });
  // Reopen the filter panel on return when a filter is active, so the restored list shows what it is filtered by.
  const [showFilters, setShowFilters] = useState(() => Object.entries(appliedFilters).some(([key, value]) => key !== 'search' && value !== '' && value != null));
  const { applicationList, applicationListLoading } = useSelector(state => state.SystemAdminApplication);

  const [dropdownResetKey, setDropdownResetKey] = useState(0);

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSearch = () => {
    // Spread the committed state so the live search term survives an Apply of the dropdowns.
    setAppliedFilters(prev => ({
      ...prev,
      status: filters.status,
      sector: filters.sector,
      classification: filters.classification,
      applicationType: filters.applicationType,
    }));
    setPage(1);
  };

  const handleReset = () => {
    resetFilters();
    setDropdownResetKey(prev => prev + 1);
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const filtersData = {
        status: appliedQuery.status || null,
        q: appliedQuery.search || null,
        perPage: pageSize,
        page: page,
        sector: appliedQuery.sector || null,
        classification: appliedQuery.classification || null,
        applicationType: appliedQuery.applicationType || null,
      };
      dispatch(getApplicationAction(filtersData));
      dispatch(resetApplicationDetails());
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [dispatch, page, pageSize, appliedQuery]);

  // The export carries the same applied filters as the list, so the downloaded
  // rows are always the rows on screen rather than the whole table.
  const exportFilters = useMemo(
    () => ({
      search: appliedQuery.search || null,
      status: appliedQuery.status || null,
      sector: appliedQuery.sector || null,
      classification: appliedQuery.classification || null,
      applicationType: appliedQuery.applicationType || null,
    }),
    [appliedQuery],
  );
  const { exporting, handleExport } = useCsvExport(exportApplicationsAction, exportFilters, 'applications_export');

  const handleSearchChange = e => {
    const { value } = e.target;
    setAppliedFilters(prev => ({ ...prev, search: value }));
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
        renderCell: params => <AppButton variant="secondary" size="extraSmall" title={'View'} onClick={() => navigate(`/my-application/application-details/${params.row.id}`)} />,
      },
      {
        field: 'applicationNumber',
        headerName: 'Application Number',
        flex: 1.5,
        minWidth: 180,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4>{params.row.applicationNumber} </h4>
            <RenewalTag application={params.row} />
            <div className="d-flex align-items-center">
              <span className={`text-capitalize ${params.row.sector === 'manufacturing' ? 'primary-color' : 'badge-purple-color'}`}>{params.row.sector}</span>
              <div className="dot-separator"></div>
              <span className="text-3-color text-capitalize">{params.row.enterpriseClassification === 'startup' ? 'Start-Up' : params.row.enterpriseClassification}</span>
            </div>
          </div>
        ),
      },

      {
        field: 'Enterprise/Unit',
        headerName: 'Enterprise/Unit Name',
        flex: 1.5,
        minWidth: 180,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4>{params.row.unitName}</h4>
            <Typography variant="body2" className="text-3-color fs-12 fw-400 line-clamp" sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
              {params.row.unitAddress || '-'}
            </Typography>
          </div>
        ),
      },
      {
        field: 'applicationDate',
        headerName: 'Application Date',
        flex: 1.2,
        minWidth: 140,
        sortable: false,
        renderCell: params => <span className="text-1-color fw-600">{formatDate(params.row.createdAt)}</span>,
      },
      {
        field: 'applicantStatus',
        headerName: 'Application Status',
        flex: 1.2,
        minWidth: 140,
        sortable: false,
        renderCell: params => <AppBadge variant={getBadgeVariantByLabel(params.row?.status) || '-'} label={params.row?.applicantStatusLabel ?? getStatusLabel(params.row?.status)} />,
      },
      {
        field: 'assessmentDate',
        headerName: 'Assessment Date',
        flex: 1,
        minWidth: 120,
        sortable: false,
        renderCell: params => {
          const start = params.row.assessmentScheduledStartDate;
          const endDate = params.row.assessmentScheduledEndDate;
          const formattedStart = start ? formatDate(start) : '-';
          const formattedEnd = endDate ? formatDate(endDate) : '-';
          const formatted = formattedStart === '-' && formattedEnd === '-' ? '-' : `${formattedStart} - ${formattedEnd}`;
          return (
            <div className="double-content">
              <p className="mb-0 fs-12 fw-500 text-2-color">{formatted}</p>
            </div>
          );
        },
      },
    ],
    [navigate],
  );
  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="table-container">
            <div className="table-header">
              <div className="table-header-left">
                <h1 className="page-heading">Applications</h1>
                <div className="input-search-document">
                  <AppInput
                    label={'Search'}
                    inputType="search"
                    name="search"
                    customInputClass={'search-input'}
                    value={appliedFilters.search}
                    onChange={handleSearchChange}
                    placeholder="Application number or enterprise name"
                    customWidth="100%"
                    leftIcon={Icons.search}
                    marginLeft="6px"
                  />
                </div>
              </div>
              <div className="table-header-right">
                <AppButton variant="secondary" size="small" title={'Export'} leftIcon={Icons.exportFile} leftIconStyle={'icon-14'} onClick={handleExport} disabled={exporting} loading={exporting} />
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

            {/* Filter Section */}
            {showFilters && (
              <div className="filter-section">
                <div className="row" style={{ marginBottom: '16px' }}>
                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDropdown
                      name="status"
                      value={filters.status}
                      onChange={e => handleFilterChange('status', e.target.value)}
                      options={applicationStatusOptions}
                      label="Application Status"
                      resetKey={dropdownResetKey}
                    />
                  </div>
                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDropdown name="sector" value={filters.sector} onChange={e => handleFilterChange('sector', e.target.value)} options={sectorOptions} label="Sector" resetKey={dropdownResetKey} />
                  </div>

                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDropdown
                      name="Enterprise Classification"
                      value={filters.classification}
                      onChange={e => handleFilterChange('classification', e.target.value)}
                      options={classificationOptions}
                      label="Enterprise Size"
                      resetKey={dropdownResetKey}
                    />
                  </div>

                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDropdown
                      name="applicationType"
                      value={filters.applicationType}
                      onChange={e => handleFilterChange('applicationType', e.target.value)}
                      options={applicationTypeOptions}
                      label="Application Type"
                      resetKey={dropdownResetKey}
                    />
                  </div>
                </div>

                <div
                  className="filter-actions"
                  style={{
                    display: 'flex',
                    gap: '12px',
                    justifyContent: 'flex-start',
                  }}>
                  <AppButton variant="primary" size="small" title="Apply Filters" leftIcon={Icons.searchWhite} leftIconStyle={'icon-14'} onClick={handleSearch} />
                  <AppButton variant="tertiary" size="small" title="Reset" onClick={handleReset} leftIcon={Icons.closeCircle} leftIconStyle={'icon-14'} />
                </div>
              </div>
            )}

            <div className="table-wrapper">
              <AppDataGrid
                rows={applicationList?.data}
                columns={columns}
                rowCount={applicationList.pagination?.total || 0}
                page={page}
                pageSize={pageSize}
                onPaginationChange={model => {
                  setPage(model.page);
                  setPageSize(model.pageSize);
                }}
                loading={applicationListLoading}
                emptyTitle="No Applications"
                emptySubtitle="There are currently no applications available to display."
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Applications;
