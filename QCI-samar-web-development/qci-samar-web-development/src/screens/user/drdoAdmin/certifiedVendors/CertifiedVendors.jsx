import { Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppButton, AppDataGrid, AppDatePicker, AppDropdown, AppInput } from '../../../../components/base';
import { Layout } from '../../../../components/layout';
import { classificationOptions, ratingOptions, storesServicesOptions } from '../../../../constants/filterData';
import Icons from '../../../../constants/Icons';
import { useListFilters } from '../../../../hooks';
import { getAssessmentsAction } from '../../../../redux/action/common/AssessmentAction';
import { listVendorCategoriesAction } from '../../../../redux/action/master/MasterAction';
import { formatParameterScore } from '../../../../utils/assessmentScoreUtils';
import { formatDate, formatDateISO } from '../../../../utils/formatters';

const Certified = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { assessments, assessmentsPagination, assessmentsLoading } = useSelector(state => state.Assessment);
  const { drdoVendorCategories } = useSelector(state => state.Master);

  // Filters and pagination are held in the URL so returning from a detail page
  // restores the list the user had filtered down to.
  const { filters, setFilters, appliedFilters, appliedQuery, setAppliedFilters, page, setPage, pageSize, setPageSize, resetFilters } = useListFilters({
    search: '',
    enterpriseSize: '',
    rating: '',
    sector: '',
    vendorCategory: '',
    assessmentStartDate: null,
  });
  // Reopen the filter panel on return when a filter is active, so the restored list shows what it is filtered by.
  const [showFilters, setShowFilters] = useState(() => Object.entries(appliedFilters).some(([key, value]) => key !== 'search' && value !== '' && value != null));

  const [dropdownResetKey, setDropdownResetKey] = useState(0);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      dispatch(
        getAssessmentsAction({
          status: 'certified',
          page,
          perPage: pageSize,
          ...appliedQuery,
        }),
      );
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [dispatch, page, pageSize, appliedQuery]);

  useEffect(() => {
    dispatch(listVendorCategoriesAction({ all: true, isActive: true }));
  }, [dispatch]);

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSearch = useCallback(() => {
    // Spread the committed state so the live search term survives an Apply of the dropdowns.
    setAppliedFilters(prev => ({
      ...prev,
      enterpriseSize: filters.enterpriseSize || undefined,
      rating: filters.rating || undefined,
      sector: filters.sector || undefined,
      vendorCategory: filters.vendorCategory || undefined,
      assessmentStartDate: filters.assessmentStartDate ? formatDateISO(filters.assessmentStartDate) : undefined,
    }));
    setPage(1);
  }, [filters, setAppliedFilters, setPage]);

  const handleReset = () => {
    resetFilters();
    setDropdownResetKey(prev => prev + 1);
  };

  const vendorCategoryOptions = useMemo(
    () => [{ value: '', label: 'All' }, ...(drdoVendorCategories?.data?.map(category => ({ value: category.categoryName, label: category.categoryName })) || [])],
    [drdoVendorCategories],
  );

  const rows = useMemo(
    () =>
      assessments.map((assessment, index) => ({
        id: assessment.id || index + 1,
        applicationNo: assessment.application?.applicationNumber || '-',
        unit: assessment.application?.sector || 'Manufacturing',
        size: assessment.application?.enterpriseClassification || '-',
        enterprise: assessment.application?.unitName || '-',
        location: assessment.application?.unitAddress || '-',
        startDate: assessment.scheduledStartDate ? formatDate(assessment.scheduledStartDate) : '-',
        endDate: assessment.scheduledEndDate ? formatDate(assessment.scheduledEndDate) : '-',
        certificationDate: assessment.completedAt ? formatDate(assessment.completedAt) : '-',
        certificateLevel: assessment.rating || '-',
        totalScore: assessment.totalScore || '-',
      })),
    [assessments],
  );

  const columns = useMemo(
    () => [
      {
        field: 'action',
        headerName: 'Actions',
        flex: 0.7,
        minWidth: 110,
        sortable: false,
        renderCell: params => <AppButton variant="secondary" size="extraSmall" title={'View'} onClick={() => navigate(`/certified-vendors/application-details/${params.row.id}`)} />,
      },
      {
        field: 'applicationNo',
        headerName: 'Application Number',
        flex: 1.5,
        minWidth: 180,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4>{params.row.applicationNo}</h4>
            <div className="d-flex align-items-center">
              <span className={`text-capitalize ${params.row.unit === 'manufacturing' ? 'primary-color' : 'badge-purple-color'}`}>{params.row.unit}</span>
              <div className="dot-separator-small"></div>
              <span className="text-3-color text-capitalize">{params.row.size === 'startup' ? 'Start-Up' : params.row.size}</span>
            </div>
          </div>
        ),
      },
      {
        field: 'enterprise',
        headerName: 'Enterprise/Unit Name',
        flex: 2.4,
        minWidth: 260,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4>{params.row.enterprise}</h4>
            <Typography variant="body2" className="text-3-color line-clamp fs-12" sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
              {params.row.location}
            </Typography>
          </div>
        ),
      },
      {
        field: 'assessmentDate',
        headerName: 'Assessment Date',
        flex: 1.3,
        minWidth: 150,
        sortable: false,
        renderCell: params => (
          <span className="text-1-color fw-600">
            {params.row.startDate} - {params.row.endDate}
          </span>
        ),
      },
      {
        field: 'totalScore',
        headerName: 'Score',
        flex: 1,
        minWidth: 120,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4>{formatParameterScore(params.row.totalScore)}</h4>
          </div>
        ),
      },
      {
        field: 'certificateLevel',
        headerName: 'Rating',
        flex: 1,
        minWidth: 120,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4>{params.row.certificateLevel}</h4>
          </div>
        ),
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
                <h1 className="page-heading">Certified</h1>
                <div className="input-search-document">
                  <AppInput
                    label={'Search'}
                    inputType="search"
                    name="search"
                    customInputClass={'search-input'}
                    value={appliedFilters.search}
                    onChange={e => {
                      const { value } = e.target;
                      setAppliedFilters(prev => ({ ...prev, search: value }));
                      setPage(1);
                    }}
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
              </div>
            </div>

            {showFilters && (
              <div className="filter-section">
                <div className="row" style={{ marginBottom: '16px' }}>
                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDropdown
                      name="enterpriseSize"
                      value={filters.enterpriseSize}
                      onChange={e => handleFilterChange('enterpriseSize', e.target.value)}
                      options={classificationOptions}
                      label="Enterprise Size"
                      resetKey={dropdownResetKey}
                    />
                  </div>
                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDropdown name="rating" value={filters.rating} onChange={e => handleFilterChange('rating', e.target.value)} options={ratingOptions} label="Rating" resetKey={dropdownResetKey} />
                  </div>
                 

                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDropdown
                      name="vendorCategory"
                      value={filters.vendorCategory}
                      onChange={e => handleFilterChange('vendorCategory', e.target.value)}
                      options={vendorCategoryOptions}
                      label="Category"
                      resetKey={dropdownResetKey}
                    />
                  </div>

                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDatePicker
                      label="Assessment Start Date"
                      placeholder="Select date"
                      value={filters.assessmentStartDate}
                      onChange={d => handleFilterChange('assessmentStartDate', d)}
                      maxDate={dayjs()}
                    />
                  </div>
                </div>
                <div className="filter-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-start' }}>
                  <AppButton variant="primary" size="small" title="Apply Filters" leftIcon={Icons.searchWhite} leftIconStyle={'icon-14'} onClick={handleSearch} />
                  <AppButton variant="tertiary" size="small" title="Reset" onClick={handleReset} leftIcon={Icons.closeCircle} leftIconStyle={'icon-14'} />
                </div>
              </div>
            )}

            <div className="table-wrapper">
              <AppDataGrid
                rows={rows}
                columns={columns}
                loading={assessmentsLoading}
                rowCount={assessmentsPagination?.total || 0}
                page={page}
                pageSize={pageSize}
                onPaginationChange={model => {
                  setPage(model.page);
                  setPageSize(model.pageSize);
                }}
                emptyTitle="No Assessments"
                emptySubtitle="There are no certified assessments to display."
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Certified;
