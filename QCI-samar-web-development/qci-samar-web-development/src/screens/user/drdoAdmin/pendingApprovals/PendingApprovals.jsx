import { Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppBadge, AppButton, AppDataGrid, AppDropdown, AppInput, RenewalTag } from '../../../../components/base';
import { Layout } from '../../../../components/layout';
import { applicationTypeOptions, classificationOptions, sectorOptions } from '../../../../constants/filterData';
import Icons from '../../../../constants/Icons';
import { useListFilters } from '../../../../hooks';
import { getApplicationAction } from '../../../../redux/action/drdoAdmin/application/ApplicationAction';
import { resetApplicationDetails } from '../../../../redux/slices/drdoAdmin/application/ApplicationSlice';
import { formatDate } from '../../../../utils/formatters';
import { getBadgeVariantByLabel, getStatusLabel } from '../../../../utils/getStatusColors';

const MyApplication = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [_selectStartDate, _setSelectStartDate] = useState(null);

  // Filters and pagination are held in the URL so returning from a detail page
  // restores the list the user had filtered down to.
  const { filters, setFilters, appliedFilters, appliedQuery, setAppliedFilters, page, setPage, pageSize, setPageSize, resetFilters } = useListFilters({
    search: '',
    sector: '',
    classification: '',
    applicationType: '',
  });
  // Reopen the filter panel on return when a filter is active, so the restored list shows what it is filtered by.
  const [showFilters, setShowFilters] = useState(() => Object.entries(appliedFilters).some(([key, value]) => key !== 'search' && value !== '' && value != null));
  const [dropdownResetKey, setDropdownResetKey] = useState(0);
  const { applicationList, applicationListLoading } = useSelector(state => state.DrdoAdminApplication);
  // Filter options

  const handleSearch = () => {
    // Spread the committed state so the live search term survives an Apply of the dropdowns.
    setAppliedFilters(prev => ({
      ...prev,
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
  const handleFilterChange = (field, value) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      [field]: value,
    }));
  };
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const filtersData = {
        status: 'drdo_approval_pending',
        type: null,
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
        renderCell: params => <AppButton variant="secondary" size="extraSmall" title={'View'} onClick={() => navigate(`/pending-approval/application-details/${params.row.id}`)} />,
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
            <Typography variant="body2" className="fs-12 fw-500 text-3-color content line-clamp" sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
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
        field: 'drdoRegisteredVendor',
        headerName: 'DRDO Registered',
        flex: 1.2,
        minWidth: 140,
        sortable: false,
        renderCell: params => {
          const isExistingVendor = params.row?.isExistingDrdoVendor;
          return <AppBadge variant={isExistingVendor ? 'green' : 'grey'} label={isExistingVendor ? 'Yes' : 'No'} />;
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
                <h1 className="page-heading">Pending Approvals</h1>
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
                <AppButton
                  variant={showFilters ? 'active-filter-btn' : 'filter-btn'}
                  size="small"
                  title={'Filters'}
                  leftIcon={showFilters ? Icons.activeFilter : Icons.filter}
                  leftIconStyle={'icon-14'}
                  onClick={() => setShowFilters(!showFilters)}
                />
                {/* <AppButton variant="primary" size="small" title={'Apply New Application'} onClick={handleCreateNewApplication} /> */}
              </div>
            </div>

            {/* Filter Section */}
            {showFilters && (
              <div className="filter-section">
                <div className="row" style={{ marginBottom: '16px' }}>
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
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default MyApplication;
