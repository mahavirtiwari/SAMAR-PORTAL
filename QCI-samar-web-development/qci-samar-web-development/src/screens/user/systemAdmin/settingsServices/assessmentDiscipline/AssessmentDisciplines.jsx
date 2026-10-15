import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { AppBadge, AppButton, AppDataGrid, AppInput, AppModal, AppToolTip } from '../../../../../components/base';
import { toastError } from '../../../../../components/base/toast';
import { Layout } from '../../../../../components/layout';
import AddDisciplineModal from '../../../../../components/modals/AddDisciplineModal';
import EditDisciplineModal from '../../../../../components/modals/EditDisciplineModal';
import Icons from '../../../../../constants/Icons';
import useDebouncedValue from '../../../../../hooks/useDebouncedValue';
import {
  activateDisciplineAction,
  deactivateDisciplineAction,
  exportDisciplinesAction,
  getDisciplineByIdAction,
  getDisciplinesAction,
} from '../../../../../redux/action/systemAdmin/DisciplinesAction';
import { getBadgeVariantByLabel } from '../../../../../utils/getStatusColors';
import { Logger } from '../../../../../utils/logger';

const AssessmentDisciplines = () => {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const dispatch = useDispatch();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRowData, setEditRowData] = useState(null);
  const [filters, setFilters] = useState({
    name: '',
  });
  const [_serverError, setServerError] = useState('');
  const { disciplines, disciplinesLoading, discipline, activateDisciplineLoading, deactivateDisciplineLoading, activatedDiscipline, deactivatedDiscipline } = useSelector(
    state => state.SystemAdminDisciplines,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showToggleConfirmModal, setShowToggleConfirmModal] = useState(false);
  const [itemToToggle, setItemToToggle] = useState(null);
  // Filter options

  const handleGeneralError = errorMessage => {
    setServerError(errorMessage);
    toastError(errorMessage);
  };

  // Filters drive the fetch directly, so any change starts again from the first page.
  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
    setPage(1);
  };

  const _handleSearch = () => {
    setPage(1);
    dispatch(
      getDisciplinesAction({
        perPage: pageSize,
        page: 1,
        search: filters.name || '',
      }),
    );
  };

  const _handleReset = () => {
    setFilters({ name: '' });
    setPage(1);
    dispatch(
      getDisciplinesAction({
        perPage: pageSize,
        page: 1,
        search: '',
      }),
    );
  };

  const handleExport = async () => {
    try {
      const result = await dispatch(exportDisciplinesAction({ sector: 'service' }));
      if (result.type === 'disciplines/export/fulfilled') {
        const csvData = result.payload;
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `service_disciplines_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      Logger.error('Export failed:', error);
      handleGeneralError(error?.message || 'Export failed');
    }
  };

  // Debounced so typing in the search box sends one request, not one per keystroke.
  const debouncedName = useDebouncedValue(filters.name);

  // Fetch list on mount and pagination change
  useEffect(() => {
    const filtersData = {
      perPage: pageSize,
      page: page,
      search: debouncedName || '',
      sector: 'service',
    };
    dispatch(getDisciplinesAction(filtersData));
  }, [dispatch, page, pageSize, debouncedName]);
  // Refresh list when activate/deactivate is successful
  useEffect(() => {
    if (activatedDiscipline || deactivatedDiscipline) {
      dispatch(
        getDisciplinesAction({
          perPage: pageSize,
          page,
          search: debouncedName || '',
          sector: 'service',
        }),
      );
    }
  }, [activatedDiscipline, deactivatedDiscipline, dispatch, page, pageSize, debouncedName]);

  // Open edit modal when discipline data is received
  useEffect(() => {
    if (editRowData && discipline) {
      setEditModalOpen(true);
    }
  }, [discipline, editRowData]);

  // Handle edit button click
  const handleEditUnitAdmin = useCallback(
    row => {
      setEditRowData(row);
      dispatch(getDisciplineByIdAction(row.id));
    },
    [dispatch],
  );

  const handleCreateNewApplication = () => {
    setAddModalOpen(true);
  };

  // Toggle handling: open confirm modal
  const handleToggle = useCallback((rowId, isCurrentlyActive, itemName) => {
    setItemToToggle({
      id: rowId,
      isActive: isCurrentlyActive,
      name: itemName,
    });
    setShowToggleConfirmModal(true);
  }, []);

  // Confirm toggle and dispatch appropriate action
  const confirmToggleItem = async () => {
    if (!itemToToggle || activateDisciplineLoading || deactivateDisciplineLoading) {
      return;
    }
    const { id, isActive } = itemToToggle;
    try {
      if (isActive) {
        await dispatch(deactivateDisciplineAction(id));
      } else {
        await dispatch(activateDisciplineAction(id));
      }
      setShowToggleConfirmModal(false);
    } catch (err) {
      Logger.error('Toggle discipline failed:', err);
      handleGeneralError(err?.message || 'Toggle discipline failed');
    }
  };

  const columns = useMemo(
    () => [
      {
        field: 'action',
        headerName: 'Actions',
        flex: 2,
        minWidth: 200,
        sortable: false,
        renderCell: params => {
          const isActive = params.row?.isActive ?? true;
          return (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <AppButton variant="secondary" size="extraSmall" title={'Edit'} onClick={() => handleEditUnitAdmin(params.row)} />
              <div className="toggle-btns d-flex">
                {isActive ? (
                  <AppToolTip title="Deactivate Assessment Discipline">
                    <Image src={Icons.active} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleToggle(params.row.id, true, params.row.fullName || params.row.user)} />
                  </AppToolTip>
                ) : (
                  <AppToolTip title="Activate Assessment Discipline">
                    <Image src={Icons.inactive} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleToggle(params.row.id, false, params.row.fullName || params.row.user)} />
                  </AppToolTip>
                )}
              </div>
            </div>
          );
        },
      },
      {
        field: 'discipline',
        headerName: 'Discipline',
        flex: 2,
        minWidth: 200,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4 className="heading-color">{params.row.name}</h4>
            {params.row.description ? (
              <span className="line-clamp" title={params.row.description}>
                {params.row.description}
              </span>
            ) : null}
          </div>
        ),
      },

      {
        field: 'parameters',
        headerName: 'Parameters',
        flex: 1.5,
        minWidth: 180,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4 className="text-1-color">{params.row.parametersCount}</h4>
          </div>
        ),
      },

      {
        field: 'questions',
        headerName: 'Questions',
        flex: 1,
        minWidth: 120,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4 className="text-1-color">{params.row.questionsCount}</h4>
          </div>
        ),
      },
      {
        field: 'status',
        headerName: 'Status',
        flex: 1,
        minWidth: 140,
        sortable: false,
        headerAlign: 'right',
        renderCell: params => (
          <div className="table-flex-end">
            <AppBadge variant={getBadgeVariantByLabel(params.row?.isActive ? 'Active' : 'Inactive')} label={params.row?.isActive ? 'Active' : 'Inactive'} />
          </div>
        ),
      },
    ],
    [handleEditUnitAdmin, handleToggle],
  );
  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="table-container">
            <div className="table-header">
              <div className="table-header-left">
                <h1 className="page-heading">Service Assessment Disciplines</h1>
                <div className="input-search-document d-flex align-items-center gap-2">
                  <AppInput
                    label={'Search'}
                    inputType="search"
                    name="name"
                    customInputClass={'search-input'}
                    value={filters.name}
                    onChange={e => handleFilterChange('name', e.target.value)}
                    placeholder="Search by disciplines"
                    customWidth="100%"
                    leftIcon={Icons.search}
                    marginLeft="6px"
                  />
                </div>
              </div>
              <div className="table-header-right">
                <AppButton variant="secondary" size="small" title={'Export'} leftIcon={Icons.exportFile} leftIconStyle={'icon-14'} onClick={handleExport} />
                <AppButton variant="primary" size="small" title={'Add New'} onClick={handleCreateNewApplication} />
              </div>
            </div>

            <div className="table-wrapper">
              <AppDataGrid
                rows={disciplines?.data}
                columns={columns}
                rowCount={disciplines.pagination?.total || 0}
                page={page}
                pageSize={pageSize}
                onPaginationChange={model => {
                  setPage(model.page);
                  setPageSize(model.pageSize);
                }}
                loading={disciplinesLoading}
                emptyTitle="No Assessment Disciplines"
                emptySubtitle="Assessment Disciplines have not been added yet."
              />
            </div>
            {/* Edit Modal */}
            <EditDisciplineModal open={editModalOpen} handleClose={() => setEditModalOpen(false)} data={discipline?.data} sector="service" onGeneralError={handleGeneralError} />
            {/* Add Modal */}
            <AddDisciplineModal open={addModalOpen} handleClose={() => setAddModalOpen(false)} sector="service" onGeneralError={handleGeneralError} />

            {/* Activate / Deactivate confirmation modal */}
            <AppModal
              modalHeaderStyle={{ backgroundColor: itemToToggle?.isActive ? 'var(--danger-light)' : 'var(--success-light)' }}
              image={itemToToggle?.isActive ? Icons.deleteModal : Icons.successCircle}
              show={showToggleConfirmModal}
              header={itemToToggle?.isActive ? 'Deactivate Discipline?' : 'Activate Discipline?'}
              subHeader={itemToToggle?.isActive ? 'This will no longer be available for selection across the platform.' : 'This will be available for selection across the platform.'}
              twoButtons
              leftButton={'Cancel'}
              leftButtonClassName={'w-100 tertiary'}
              leftButtonDisabled={activateDisciplineLoading || deactivateDisciplineLoading}
              leftButtonOnClick={() => {
                setShowToggleConfirmModal(false);
              }}
              rightButton={itemToToggle?.isActive ? 'Deactivate' : 'Activate'}
              rightButtonClassName={`w-100 ${itemToToggle?.isActive ? 'danger-primary' : 'primary'}`}
              rightButtonOnClick={confirmToggleItem}
              rightButtonLoading={activateDisciplineLoading || deactivateDisciplineLoading}
              rightButtonDisabled={activateDisciplineLoading || deactivateDisciplineLoading}
              onExited={() => setItemToToggle(null)}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AssessmentDisciplines;
