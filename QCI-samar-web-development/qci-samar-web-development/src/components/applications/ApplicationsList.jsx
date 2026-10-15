import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { applicationStatusOptions, applicationTypeOptions, classificationOptions, sectorOptions } from '../../constants/filterData';
import Icons from '../../constants/Icons';
import { AppButton, AppDataGrid, AppDropdown, AppInput } from '../base';
import { Layout } from '../layout';

// Generic, role-agnostic applications list. Owns the shell (search, filters, server-side
// paginated DataGrid, empty state). All role-specific bits are passed in as props so the
// same component backs every role's Applications + status-filtered views.
//
// Props:
//   heading        – page heading text
//   status         – when set, locks the list to a single status (hides the status filter)
//   selector       – (state) => ({ applicationList, applicationListLoading }) for the role's slice
//   fetchAction    – (filtersData) => redux action that loads the list
//   resetAction    – optional () => redux action dispatched alongside each fetch
//   columns        – DataGrid column definitions (role-specific: row actions, routing, etc.)
//   statusOptions  – optional override for the status filter options (e.g. DRDO excludes draft)
//   extraParams    – optional extra params merged into every fetch (e.g. { excludeStatus: 'draft' })
//   headerRight     – optional node rendered in the header next to the Filters button
//   extraContent    – optional node rendered after the content (e.g. a modal)
const ApplicationsList = ({
  heading = 'Applications',
  status = '',
  selector,
  fetchAction,
  resetAction,
  columns = [],
  statusOptions = applicationStatusOptions,
  extraParams = {},
  headerRight = null,
  extraContent = null,
}) => {
  const dispatch = useDispatch();
  const lockStatus = status !== '';
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownResetKey, setDropdownResetKey] = useState(0);
  const [filters, setFilters] = useState({
    status: status,
    sector: '',
    classification: '',
    applicationType: '',
  });
  // Committed filters — the fetch effect keys on THIS, not the live `filters`, so the API is
  // called only when "Apply Filters" is clicked (not on every dropdown change).
  const [appliedFilters, setAppliedFilters] = useState({
    status: status,
    sector: '',
    classification: '',
    applicationType: '',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { applicationList, applicationListLoading } = useSelector(selector);

  // Stabilise extraParams so it doesn't retrigger the effect on every render.
  const extraParamsKey = JSON.stringify(extraParams);
  const stableExtraParams = useMemo(() => extraParams, [extraParamsKey]);

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSearch = () => {
    // Commit the live filters; only now does the fetch effect (keyed on appliedFilters) re-run.
    setAppliedFilters(filters);
    setPage(1);
  };

  const handleReset = () => {
    const cleared = {
      status: status,
      sector: '',
      classification: '',
      applicationType: '',
    };
    setFilters(cleared);
    setAppliedFilters(cleared);
    setDropdownResetKey(prev => prev + 1);
    setPage(1);
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const filtersData = {
        status: appliedFilters.status || null,
        q: searchQuery || null,
        perPage: pageSize,
        page: page,
        sector: appliedFilters.sector || null,
        classification: appliedFilters.classification || null,
        applicationType: appliedFilters.applicationType || null,
        ...stableExtraParams,
      };
      dispatch(fetchAction(filtersData));
      if (resetAction) {
        dispatch(resetAction());
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [dispatch, fetchAction, resetAction, page, pageSize, searchQuery, appliedFilters, stableExtraParams]);

  const handleSearchChange = e => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="table-container">
            <div className="table-header">
              <div className="table-header-left">
                <h1 className="page-heading">{heading}</h1>
                <div className="input-search-document">
                  <AppInput
                    label={'Search'}
                    inputType="search"
                    name="search"
                    customInputClass={'search-input'}
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Application number or enterprise name"
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
                {headerRight}
              </div>
            </div>

            {/* Filter Section */}
            {showFilters && (
              <div className="filter-section">
                <div className="row" style={{ marginBottom: '16px' }}>
                  {!lockStatus && (
                    <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                      <AppDropdown
                        name="status"
                        value={filters.status}
                        onChange={e => handleFilterChange('status', e.target.value)}
                        options={statusOptions}
                        label="Application Status"
                        resetKey={dropdownResetKey}
                      />
                    </div>
                  )}
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
                rowCount={applicationList?.pagination?.total || 0}
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
      {extraContent}
    </Layout>
  );
};

export default ApplicationsList;
