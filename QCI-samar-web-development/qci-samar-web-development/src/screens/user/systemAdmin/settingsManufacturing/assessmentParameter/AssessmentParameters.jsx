import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppBadge, AppButton, AppDataGrid, AppDropdown, AppInput, AppModal, AppToolTip } from '../../../../../components/base';
import { toastError } from '../../../../../components/base/toast';
import { Layout } from '../../../../../components/layout';
import AddManufacturingAssessmentParameterModal from '../../../../../components/modals/AddManufacturingAssessmentParameterModal';
import BulkImportAssessmentParameterModal from '../../../../../components/modals/BulkImportAssessmentParameterModal';
import BulkUpdateAssessmentParameterModal from '../../../../../components/modals/BulkUpdateAssessmentParameterModal';
import EditManufacturingAssessmentParameterModal from '../../../../../components/modals/EditManufacturingAssessmentParameterModal';
import { classificationOptions } from '../../../../../constants/filterData';
import Icons from '../../../../../constants/Icons';
import { useListFilters } from '../../../../../hooks';
import { listVendorCategoriesAction } from '../../../../../redux/action/master/MasterAction';
import {
  activateAssessmentParameterAction,
  deactivateAssessmentParameterAction,
  exportAssessmentParametersAction,
  getAssessmentParameterByIdAction,
  getAssessmentParametersAction,
} from '../../../../../redux/action/systemAdmin/AssessmentParameterAction';
import { getDisciplinesAction } from '../../../../../redux/action/systemAdmin/DisciplinesAction';
import { getBadgeVariantByLabel } from '../../../../../utils/getStatusColors';
import { Logger } from '../../../../../utils/logger';

const AssessmentParameters = () => {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [bulkUpdateModalOpen, setBulkUpdateModalOpen] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRowData, setEditRowData] = useState(null);
  const [_serverError, setServerError] = useState('');
  // Filters and pagination are held in the URL so returning from a parameter's detail
  // page restores the list the user had filtered down to.
  const { filters, setFilters, appliedFilters, appliedQuery, setAppliedFilters, page, setPage, pageSize, setPageSize, resetFilters } = useListFilters({
    name: '',
    type: '',
    enterpriseSize: '',
    discipline: '',
    enterpriseType: '',
    vendorCategory: '',
  });
  // Reopen the filter panel on return when a filter is active, so the restored list shows what it is filtered by.
  const [showFilters, setShowFilters] = useState(() => Object.entries(appliedFilters).some(([key, value]) => key !== 'name' && value !== '' && value != null));
  const [itemToToggle, setItemToToggle] = useState(null);
  const [showToggleConfirmModal, setShowToggleConfirmModal] = useState(false);

  const {
    assessmentParameters,
    assessmentParametersLoading,
    assessmentParameter,
    activateLoading,
    deactivateLoading,
    activatedAssessmentParameter,
    deactivatedAssessmentParameter,
    createdAssessmentParameter,
    updatedAssessmentParameter,
  } = useSelector(state => state.SystemAdminAssessmentParameter);
  const { drdoVendorCategories } = useSelector(state => state.Master);
  const { disciplines } = useSelector(state => state.SystemAdminDisciplines);

  const handleGeneralError = error => {
    const message = error || 'An unexpected error occurred. Please try again.';
    setServerError(message);
    toastError(message);
  };

  // Dummy data for filter dropdowns
  const type = [
    { label: 'All', value: '' },
    { label: 'Mandatory', value: 'mandatory' },
    { label: 'Optional', value: 'optional' },
  ];

  const disciplineOptions = [
    { label: 'All', value: '' },
    ...(disciplines?.data?.map(discipline => ({
      label: discipline.name,
      value: discipline.id,
    })) || []),
  ];

  const _enterpriseTypeOptions = [
    { label: 'All', value: '' },
    { label: 'Manufacturing', value: 'manufacturing' },
    { label: 'Service', value: 'service' },
    { label: 'Trading', value: 'trading' },
  ];

  const vendorCategoryOptions = [
    { label: 'All', value: '' },
    ...(drdoVendorCategories?.data?.map(category => ({
      label: category.categoryName,
      value: category.id,
    })) || []),
  ];

  // Handle filter changes
  const handleFilterChange = (filterName, value) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      [filterName]: value,
    }));
  };

  const handleSearch = () => {
    // Copy current filters to appliedFilters and reset to first page
    setAppliedFilters({
      name: filters.name,
      type: filters.type,
      enterpriseSize: filters.enterpriseSize,
      discipline: filters.discipline,
      enterpriseType: filters.enterpriseType,
      vendorCategory: filters.vendorCategory,
    });
    setPage(1);
  };

  // Debounce applying the name filter for better UX when typing. The equality check
  // matters on mount: without it this would fire once with the value restored from the
  // URL and send the user back to page 1, undoing the page they returned to.
  useEffect(() => {
    const typed = (filters.name || '').trim();
    if (typed === appliedFilters.name) {
      return undefined;
    }

    const id = setTimeout(() => {
      setAppliedFilters(prev => ({ ...prev, name: typed }));
      setPage(1);
    }, 300);

    return () => clearTimeout(id);
  }, [filters.name, appliedFilters.name, setAppliedFilters, setPage]);

  // Loads the full discipline list once for the filter dropdown. filters.name is the
  // parameter-name search, unrelated to disciplines, and was always empty here anyway.
  useEffect(() => {
    dispatch(getDisciplinesAction({ all: true, sector: 'manufacturing' }));
  }, [dispatch]);
  const handleReset = () => {
    resetFilters();
  };

  // Fetch list on mount and pagination change
  useEffect(() => {
    // Convert type filter value to isMandatory boolean for backend
    let isMandatoryValue;
    if (appliedQuery.type === 'mandatory') {
      isMandatoryValue = true;
    } else if (appliedQuery.type === 'optional') {
      isMandatoryValue = false;
    }

    const filtersData = {
      perPage: pageSize,
      page: page,
      search: appliedQuery.name || '',
      sector: 'manufacturing',
      isMandatory: isMandatoryValue,
      enterpriseSize: appliedQuery.enterpriseSize || undefined,
      disciplineId: appliedQuery.discipline || undefined,
      enterpriseType: appliedQuery.enterpriseType || undefined,
      vendorCategoryId: appliedQuery.vendorCategory || undefined,
    };
    dispatch(getAssessmentParametersAction(filtersData));
  }, [dispatch, page, pageSize, appliedQuery]);

  useEffect(() => {
    if (editRowData && String(assessmentParameter?.data?.id) === String(editRowData.id)) {
      setEditModalOpen(true);
    }
  }, [assessmentParameter, editRowData]);

  // Fetch Vendor Categories for dropdown (only active ones)
  useEffect(() => {
    const fetchInitialData = {
      all: true,
      sector: 'manufacturing',
      isActive: true,
    };
    dispatch(listVendorCategoriesAction(fetchInitialData));
  }, [dispatch]);

  // Refresh list when CRUD operations are successful
  useEffect(() => {
    if (activatedAssessmentParameter || deactivatedAssessmentParameter || createdAssessmentParameter || updatedAssessmentParameter) {
      // Convert type filter value to isMandatory boolean for backend
      let isMandatoryValue;
      if (appliedQuery.type === 'mandatory') {
        isMandatoryValue = true;
      } else if (appliedQuery.type === 'optional') {
        isMandatoryValue = false;
      }

      const filtersData = {
        perPage: pageSize,
        page: page,
        search: appliedQuery.name || '',
        sector: 'manufacturing',
        isMandatory: isMandatoryValue,
        enterpriseSize: appliedQuery.enterpriseSize || undefined,
        disciplineId: appliedQuery.discipline || undefined,
        enterpriseType: appliedQuery.enterpriseType || undefined,
        vendorCategoryId: appliedQuery.vendorCategory || undefined,
      };
      dispatch(getAssessmentParametersAction(filtersData));
    }
  }, [activatedAssessmentParameter, deactivatedAssessmentParameter, createdAssessmentParameter, updatedAssessmentParameter, dispatch, appliedQuery, pageSize, page]);

  const handleEditParameter = useCallback(
    row => {
      setEditRowData(row);
      dispatch(getAssessmentParameterByIdAction(row.id));
    },
    [dispatch],
  );

  const handleCreateNewParameter = () => {
    setFilters(prev => ({ ...prev, name: '' }));
    setAppliedFilters(prev => ({ ...prev, name: '' }));
    setPage(1);
    setAddModalOpen(true);
  };

  const handleToggle = useCallback((rowId, isCurrentlyActive, itemName) => {
    setItemToToggle({
      id: rowId,
      isActive: isCurrentlyActive,
      name: itemName,
    });
    setShowToggleConfirmModal(true);
  }, []);

  const confirmToggleItem = () => {
    if (!itemToToggle || activateLoading || deactivateLoading) {
      return;
    }
    const { id, isActive } = itemToToggle;
    if (isActive) {
      dispatch(deactivateAssessmentParameterAction(id))
        .unwrap()
        .then(() => {
          setShowToggleConfirmModal(false);
        })
        .catch(err => {
          setShowToggleConfirmModal(false);
          const errorMessage = err?.message || 'Failed to deactivate parameter';
          handleGeneralError(errorMessage);
        });
    } else {
      dispatch(activateAssessmentParameterAction(id))
        .unwrap()
        .then(() => {
          setShowToggleConfirmModal(false);
        })
        .catch(err => {
          setShowToggleConfirmModal(false);
          const errorMessage = err?.message || 'Failed to activate parameter';
          handleGeneralError(errorMessage);
        });
    }
  };

  const handleExport = async () => {
    try {
      let isMandatoryValue;
      if (appliedFilters.type === 'mandatory') {
        isMandatoryValue = true;
      } else if (appliedFilters.type === 'optional') {
        isMandatoryValue = false;
      }
      const result = await dispatch(
        exportAssessmentParametersAction({
          sector: 'manufacturing',
          search: appliedFilters.name || undefined,
          enterpriseSize: appliedFilters.enterpriseSize || undefined,
          vendorCategoryId: appliedFilters.vendorCategory || undefined,
          disciplineId: appliedFilters.discipline || undefined,
          isMandatory: isMandatoryValue,
        }),
      );
      if (result.type === 'assessmentParameters/export/fulfilled') {
        const csvData = result.payload;
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `manufacturing_assessment_parameters_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      Logger.error('Export failed:', error);
    }
  };

  const columns = useMemo(
    () => [
      {
        field: 'action',
        headerName: 'Actions',
        flex: 1,
        minWidth: 200,
        sortable: false,
        renderCell: params => {
          const rowId = params.row?.id;
          const isItemActive = params.row?.isActive ?? true;
          return (
            <div style={{ display: 'flex', gap: '8px' }}>
              <AppButton variant="secondary" size="extraSmall" title={'View'} onClick={() => navigate(`/manufacturing-assessment-parameter-details/${rowId}`)} />
              <AppToolTip title="Edit Assessment Parameter">
                <AppButton
                  variant="secondary"
                  size="extraSmall"
                  leftIconStyle={'icon-14 me-0'}
                  leftIcon={Icons.edit}
                  buttonPaddingX="0"
                  minWidth={30}
                  onClick={() => handleEditParameter(params.row)}
                />
              </AppToolTip>

              <div className="toggle-btns d-flex">
                {isItemActive ? (
                  <AppToolTip title="Deactivate Assessment Parameter">
                    <Image src={Icons.active} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleToggle(rowId, true, params.row.fullName || params.row.user)} />
                  </AppToolTip>
                ) : (
                  <AppToolTip title="Activate Assessment Parameter">
                    <Image src={Icons.inactive} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleToggle(rowId, false, params.row.fullName || params.row.user)} />
                  </AppToolTip>
                )}
              </div>
            </div>
          );
        },
      },
      {
        field: 'code',
        headerName: 'Parameter ID',
        flex: 0.6,
        minWidth: 110,
        sortable: false,
        renderCell: params => <span className="fs-12 fw-500 heading-color">{params.row.code || '-'}</span>,
      },
      {
        field: 'discipline',
        headerName: 'Discipline',
        flex: 0.8,
        minWidth: 180,
        sortable: false,
        renderCell: params => {
          // discipline can be an array or a string, handle both cases
          const disciplineValue = params?.row?.discipline;
          let displayValue = '';
          if (Array.isArray(disciplineValue)) {
            displayValue = disciplineValue.map(d => d?.name || d).join(', ');
          } else if (typeof disciplineValue === 'object' && disciplineValue !== null) {
            displayValue = disciplineValue.name || '';
          } else if (typeof disciplineValue === 'string') {
            displayValue = disciplineValue;
          }
          return <span className="fs-12 fw-500 heading-color">{displayValue}</span>;
        },
      },
      {
        field: 'parameterName',
        headerName: 'Parameter Name',
        flex: 1.2,
        minWidth: 120,
        sortable: false,
        renderCell: params => <span className="fs-12 fw-500 heading-color">{params.row.name}</span>,
      },
      // {
      //   field: 'type',
      //   headerName: 'Type',
      //   flex: 0.5,
      //   minWidth: 80,
      //   sortable: false,
      //   renderCell: params => {
      //     const isMandatory = params.row.isMandatory;
      //     return (
      //       <span className="fs-12 fw-500" style={{ color: isMandatory ? 'var(--danger-primary)' : 'var(--status-warning)' }}>
      //         {isMandatory ? 'Mandatory' : 'Optional'}
      //       </span>
      //     );
      //   },
      // },
      {
        field: 'enterpriseSize',
        sortable: false,
        headerName: 'Enterprise Size',
        flex: 0.8,
        minWidth: 120,
        renderCell: params => {
          const raw = params.row?.enterpriseSize ?? '';
          const display =
            raw && typeof raw === 'string'
              ? raw
                  .split(' ')
                  .map(part => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ''))
                  .join(' ')
              : '-';
          return <span className="fs-12 fw-500 heading-color">{display === 'Startup' ? 'Start-Up' : display}</span>;
        },
      },

      {
        field: 'vendorCategory',
        sortable: false,
        headerName: 'Category',
        flex: 1,
        minWidth: 110,
        renderCell: params => <span className="fs-12 fw-500 heading-color line-clamp">{params.row.vendorCategoryName || '-'}</span>,
      },
      {
        field: 'totalQuestion',
        sortable: false,
        headerName: 'Questions/Weightage',
        flex: 0.6,
        minWidth: 100,
        renderCell: params => {
          const weightage = params.row.questionsSumWeightage || 0;
          const isComplete = weightage === 100;
          return (
            <div className="double-content">
              <span className="fs-12 fw-500 heading-color">{params.row.questionsCount}</span>
              <span className="fs-12 fw-400 text-3-color" style={{ color: isComplete ? 'var(--success-primary)' : 'var(--text-3-color)' }}>
                {weightage}%
              </span>
            </div>
          );
        },
      },
      // {
      //   field: 'totalWeightage',
      //   sortable: false,
      //   headerName: 'Weightage',
      //   flex: 0.6,
      //   minWidth: 90,
      //   renderCell: params => {
      //     const weightage = params.row.questionsSumWeightage || 0;
      //     const isComplete = weightage === 100;
      //     return (
      //       <span className="fs-12 fw-500" style={{ color: isComplete ? 'var(--success-primary)' : 'var(--text-2-color)' }}>
      //         {weightage}%
      //       </span>
      //     );
      //   },
      // },
      {
        field: 'status',
        headerName: 'Status',
        flex: 0.7,
        minWidth: 85,
        sortable: false,
        renderCell: params => <AppBadge variant={getBadgeVariantByLabel(params.row?.isActive ? 'Active' : 'Inactive')} label={params.row?.isActive ? 'Active' : 'Inactive'} />,
      },
    ],
    [navigate, handleEditParameter, handleToggle],
  );

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="table-container">
            <div className="table-header">
              <div className="table-header-left">
                <h1 className="page-heading">Manufacturing Assessment Parameters</h1>
                <div className="input-search-document d-flex align-items-center gap-2">
                  <AppInput
                    label={'Search'}
                    inputType="search"
                    name="name"
                    customInputClass={'search-input'}
                    value={filters.name}
                    onChange={e => setFilters({ ...filters, name: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        handleSearch();
                      }
                    }}
                    placeholder="Search by parameter name"
                    customWidth="100%"
                    leftIcon={Icons.search}
                    marginLeft="6px"
                  />
                </div>
              </div>
              <div className="table-header-right">
                <AppButton variant="secondary" size="small" title={'Import'} leftIcon={Icons.importFile} leftIconStyle={'icon-14'} onClick={() => setImportModalOpen(true)} />
                <AppButton variant="secondary" size="small" title={'Bulk Update'} leftIcon={Icons.importFile} leftIconStyle={'icon-14'} onClick={() => setBulkUpdateModalOpen(true)} />
                <AppButton variant="secondary" size="small" title={'Export'} leftIcon={Icons.exportFile} leftIconStyle={'icon-14'} onClick={handleExport} />
                <AppButton
                  variant={showFilters ? 'active-filter-btn' : 'filter-btn'}
                  size="small"
                  title={'Filters'}
                  leftIcon={showFilters ? Icons.activeFilter : Icons.filter}
                  leftIconStyle={'icon-14'}
                  onClick={() => setShowFilters(!showFilters)}
                />
                <AppButton variant="primary" size="small" title={'Add New'} onClick={handleCreateNewParameter} />
              </div>
            </div>
            {/* Filter Section */}
            {showFilters && (
              <div className="filter-section">
                <div className="row" style={{ marginBottom: '16px' }}>
                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDropdown name="type" value={filters.type} onChange={e => handleFilterChange('type', e.target.value)} options={type} label="Type" />
                  </div>

                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDropdown
                      name="enterpriseSize"
                      value={filters.enterpriseSize}
                      onChange={e => handleFilterChange('enterpriseSize', e.target.value)}
                      options={classificationOptions}
                      label="Enterprise Size"
                    />
                  </div>
                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDropdown name="discipline" value={filters.discipline} onChange={e => handleFilterChange('discipline', e.target.value)} options={disciplineOptions} label="Discipline" />
                  </div>

                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDropdown
                      name="vendorCategory"
                      value={filters.vendorCategory}
                      onChange={e => handleFilterChange('vendorCategory', e.target.value)}
                      options={vendorCategoryOptions}
                      label="Category"
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
                rows={assessmentParameters?.data}
                columns={columns}
                rowCount={assessmentParameters?.pagination?.total || 0}
                page={page}
                pageSize={pageSize}
                onPaginationChange={model => {
                  setPage(model.page);
                  setPageSize(model.pageSize);
                }}
                loading={assessmentParametersLoading}
                emptyTitle="No Assessment Parameters"
                emptySubtitle="Assessment Parameters have not been added yet."
              />
            </div>
            {/* Edit Modal */}
            <EditManufacturingAssessmentParameterModal
              open={editModalOpen}
              handleClose={() => setEditModalOpen(false)}
              data={assessmentParameter?.data}
              drdoVendorCategories={drdoVendorCategories?.data || []}
              disciplines={disciplines?.data || []}
              onGeneralError={handleGeneralError}
            />
            {/* Add Modal */}
            <AddManufacturingAssessmentParameterModal
              open={addModalOpen}
              handleClose={() => setAddModalOpen(false)}
              drdoVendorCategories={drdoVendorCategories?.data || []}
              disciplines={disciplines?.data || []}
              onGeneralError={handleGeneralError}
            />
            {/* Bulk Import Modal */}
            <BulkImportAssessmentParameterModal
              open={importModalOpen}
              handleClose={() => setImportModalOpen(false)}
              sector="manufacturing"
              drdoVendorCategories={drdoVendorCategories?.data || []}
              onGeneralError={handleGeneralError}
            />
            {/* Bulk Update Modal */}
            <BulkUpdateAssessmentParameterModal open={bulkUpdateModalOpen} handleClose={() => setBulkUpdateModalOpen(false)} sector="manufacturing" onGeneralError={handleGeneralError} />
            <AppModal
              modalHeaderStyle={{ backgroundColor: itemToToggle?.isActive ? 'var(--danger-light)' : 'var(--success-light)' }}
              image={itemToToggle?.isActive ? Icons.rejectIcon : Icons.successCircle}
              show={showToggleConfirmModal}
              onExited={() => setItemToToggle(null)}
              header={itemToToggle?.isActive ? 'Deactivate Assessment Parameter?' : 'Activate Assessment Parameter?'}
              subHeader={itemToToggle?.isActive ? 'This will no longer be available for selection across the platform.' : 'This will be available for selection across the platform.'}
              twoButtons
              leftButton={'Cancel'}
              leftButtonClassName={'w-100 tertiary'}
              leftButtonDisabled={activateLoading || deactivateLoading}
              leftButtonOnClick={() => {
                setShowToggleConfirmModal(false);
              }}
              rightButton={itemToToggle?.isActive ? 'Deactivate' : 'Activate'}
              rightButtonClassName={`w-100 ${itemToToggle?.isActive ? 'danger-primary' : 'primary'}`}
              rightButtonOnClick={confirmToggleItem}
              rightButtonLoading={activateLoading || deactivateLoading}
              rightButtonDisabled={activateLoading || deactivateLoading}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AssessmentParameters;
