import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppBadge, AppButton, AppDataGrid, AppDropdown, AppInput, RenewalTag } from '../../../../components/base';
import { Layout } from '../../../../components/layout';
import AddApplicationModal from '../../../../components/modals/AddApplicationModal';
import { applicationStatusOptions, applicationTypeOptions, classificationOptions, sectorOptions } from '../../../../constants/filterData';
import Icons from '../../../../constants/Icons';
import { useCsvExport, useListFilters } from '../../../../hooks';
import { exportApplicationsAction } from '../../../../redux/action/common/ApplicationExportAction';
import { getApplicationAction } from '../../../../redux/action/enterpriseAdmin/application/ApplicationAction';
import { resetApplicationDetails } from '../../../../redux/slices/enterpriseAdmin/application/ApplicationSlice';
import { formatDate } from '../../../../utils/formatters';
import { getBadgeVariantByLabel, getStatusLabel } from '../../../../utils/getStatusColors';

// Helper to safely convert values (string or object) to a display string
const getDisplayValue = val => {
  if (val === null || val === undefined) {
    return '-';
  }
  if (typeof val === 'string') {
    return val;
  }
  if (typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }
  if (typeof val === 'object') {
    // Common object shapes -> prefer readable fields
    if (val.name) {
      return String(val.name);
    }
    if (val.title) {
      return String(val.title);
    }
    if (val.contactPersonName) {
      return String(val.contactPersonName);
    }
    if (val.applicationNumber) {
      return String(val.applicationNumber);
    }
    // fallback: try to show a useful primitive if available
    const primitive = Object.values(val).find(v => typeof v === 'string' || typeof v === 'number');
    if (primitive !== undefined) {
      return String(primitive);
    }
    try {
      return JSON.stringify(val);
    } catch {
      return '-';
    }
  }
  return String(val);
};

const MyApplication = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [openAddApplicationModal, setOpenAddApplicationModal] = useState(false);
  // Filters and pagination are held in the URL so returning from a detail page
  // restores the list the user had filtered down to.
  // The search box commits on every keystroke; searchDebounceMs holds the fetch until typing pauses.
  const { filters, setFilters, appliedFilters, appliedQuery, setAppliedFilters, page, setPage, pageSize, setPageSize, resetFilters } = useListFilters(
    {
      search: '',
      status: '',
      sector: '',
      classification: '',
      applicationType: '',
    },
    { searchDebounceMs: 400 },
  );
  // Reopen the filter panel on return when a filter is active, so the restored list shows what it is filtered by.
  const [showFilters, setShowFilters] = useState(() => Object.entries(appliedFilters).some(([key, value]) => key !== 'search' && value !== '' && value != null));
  const { applicationList, applicationListLoading } = useSelector(state => state.EnterpriseAdminApplication);
  // Filter options

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
  };

  useEffect(() => {
    const filtersData = {
      status: appliedQuery.status || null,
      q: appliedQuery.search || null,
      perPage: pageSize,
      page: page,
      sector: appliedQuery.sector || null,
      classification: appliedQuery.classification || null,
      applicationType: appliedQuery.applicationType || null,
    };
    // Abort on change so a slow earlier response cannot overwrite a newer one.
    const request = dispatch(getApplicationAction(filtersData));
    dispatch(resetApplicationDetails());
    return () => request.abort();
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
  const handleCreateNewApplication = () => {
    setOpenAddApplicationModal(true);
  };
  const handleCloseAddApplicationModal = () => {
    setOpenAddApplicationModal(false);
  };

  const columns = useMemo(
    () => [
      {
        field: 'action',
        headerName: 'Actions',
        flex: 0.9,
        minWidth: 160,
        sortable: false,
        renderCell: params => (
          <div className="d-flex align-items-center gap-8">
            <AppButton
              variant="secondary"
              size="extraSmall"
              title={params.row.status === 'draft' ? 'Edit' : 'View'}
              onClick={() => {
                // For service sector, route to service-specific pages
                if (params.row.sector === 'service') {
                  return params.row.status === 'draft' ? navigate(`/draft-application/service-steps/${params.row.id}`) : navigate(`/my-application/application-details/${params.row.id}`);
                }

                // Default: manufacturing or general application details
                return params.row.status === 'draft' ? navigate(`/draft-application/manufacturing-steps/${params.row.id}`) : navigate(`/my-application/application-details/${params.row.id}`);
              }}
            />
          </div>
        ),
      },
      {
        field: 'applicationNo',
        headerName: 'Application Number',
        flex: 1.5,
        minWidth: 180,
        sortable: false,
        renderCell: params => {
          const classification = params.row.enterpriseClassification || '';

          return (
            <div className="double-content">
              <h4>{getDisplayValue(params.row.applicationNumber)}</h4>
              <RenewalTag application={params.row} />
              <div className="d-flex align-items-center">
                <span className={`text-capitalize ${params.row.sector === 'manufacturing' ? 'primary-color' : 'badge-purple-color'}`}>{params.row.sector || '-'}</span>
                {classification && (
                  <>
                    <div className="dot-separator"></div>
                    <span className="text-3-color text-capitalize">{classification === 'startup' ? 'Start-Up' : classification}</span>
                  </>
                )}
              </div>
            </div>
          );
        },
      },

      {
        field: 'unit',
        headerName: 'Enterprise/Unit Name',
        flex: 1.5,
        minWidth: 180,
        sortable: false,
        renderCell: params => {
          const unitName = params.row.unitName || '-';
          const unitAddress = params.row.unitAddress || '-';
          return (
            <div className="double-content">
              <h4 className="text-1-color">{unitName}</h4>
              <h4 className="text-3-color line-clamp fs-400">{unitAddress}</h4>
            </div>
          );
        },
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
                <h1 className="page-heading">My Applications</h1>
                <div className="input-search-document">
                  <AppInput
                    label={'Search'}
                    inputType="search"
                    name="search"
                    customInputClass={'search-input'}
                    value={appliedFilters.search}
                    onChange={handleSearchChange}
                    placeholder="Search by application number"
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
                <AppButton variant="primary" size="small" title={'Apply New Application'} onClick={handleCreateNewApplication} />
              </div>
            </div>

            {/* Filter Section */}
            {showFilters && (
              <div className="filter-section">
                <div className="row" style={{ marginBottom: '16px' }}>
                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDropdown name="status" value={filters.status} onChange={e => handleFilterChange('status', e.target.value)} options={applicationStatusOptions} label="Application Status" />
                  </div>
                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDropdown name="sector" value={filters.sector} onChange={e => handleFilterChange('sector', e.target.value)} options={sectorOptions} label="Sector" />
                  </div>

                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDropdown
                      name="Enterprise Classification"
                      value={filters.classification}
                      onChange={e => handleFilterChange('classification', e.target.value)}
                      options={classificationOptions}
                      label="Enterprise Size"
                    />
                  </div>

                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDropdown
                      name="applicationType"
                      value={filters.applicationType}
                      onChange={e => handleFilterChange('applicationType', e.target.value)}
                      options={applicationTypeOptions}
                      label="Application Type"
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
      <AddApplicationModal open={openAddApplicationModal} handleClose={handleCloseAddApplicationModal} />
    </Layout>
  );
};

export default MyApplication;
