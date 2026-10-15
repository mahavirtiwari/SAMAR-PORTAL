import { Typography, useMediaQuery, useTheme } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { AppBadge, AppButton, AppDataGrid, AppModal, AppToolTip } from '../../../../components/base';
import ListSearchBox from '../../../../components/base/ListSearchBox';
import { toastError } from '../../../../components/base/toast';
import { Layout } from '../../../../components/layout';
import { AddAssessorDomainModal, EditAssessorDomainModal } from '../../../../components/modals';
import Icons from '../../../../constants/Icons';
import { activateAssessorDomainAction, deactivateAssessorDomainAction, listAssessorDomainsAction } from '../../../../redux/action/master/MasterAction';
import { getBadgeVariantByLabel } from '../../../../utils/getStatusColors';
import { Logger } from '../../../../utils/logger';

const getMasterRowId = row => row.id || row.user_id;

// Domain names wrap onto several lines, so cells are top-aligned and headers are allowed to wrap too.
const GRID_SX = {
  '& .MuiDataGrid-cell': {
    alignItems: 'start',
    whiteSpace: 'normal',
    lineHeight: '1.4 !important',
    wordBreak: 'break-word',
    py: 1,
  },
  '& .MuiDataGrid-columnHeaderTitle': {
    whiteSpace: 'normal',
    overflow: 'visible',
    lineHeight: '1.2',
  },
};

const AssessorDomain = () => {
  const dispatch = useDispatch();
  const [_apiError, setApiError] = useState('');

  const [showAddAssessorModal, setShowAddAssessorModal] = useState(false);
  const [showEditUnitAdminModal, setShowEditUnitAdminModal] = useState(false);
  const [selectedUnitAdmin, setSelectedUnitAdmin] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    User: '',
    unitStatus: '',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showToggleConfirmModal, setShowToggleConfirmModal] = useState(false);
  const [itemToToggle, setItemToToggle] = useState(null);

  const { assessorDomains, assessorDomainsLoading, activateAssessorDomain, deactivateAssessorDomain, activateAssessorDomainLoading, deactivateAssessorDomainLoading } = useSelector(
    state => state.Master,
  );

  // Fetch assessor domains
  useEffect(() => {
    const filtersData = {
      search: filters.search,
      status: filters?.unitStatus,
      perPage: pageSize,
      page: page,
    };
    dispatch(listAssessorDomainsAction(filtersData));
  }, [dispatch, page, pageSize, filters]);

  // Refresh list when activate/deactivate operations complete
  useEffect(() => {
    if (activateAssessorDomain || deactivateAssessorDomain) {
      const filtersData = {
        search: filters.search,
        status: filters?.unitStatus,
        perPage: pageSize,
        page: page,
      };
      dispatch(listAssessorDomainsAction(filtersData));
    }
  }, [activateAssessorDomain, deactivateAssessorDomain, dispatch, filters.search, filters.unitStatus, pageSize, page]);

  // Handle general error callback from modal (for non-field errors)
  const handleGeneralError = errorMessage => {
    setApiError(errorMessage);
    toastError(errorMessage);
  };

  // Open edit modal when selectedUnitAdmin is set
  useEffect(() => {
    if (selectedUnitAdmin) {
      setShowEditUnitAdminModal(true);
    }
  }, [selectedUnitAdmin]);

  const handleCloseModal = () => {
    setShowAddAssessorModal(false);
  };

  const handleEditUnitAdmin = useCallback(unitAdmin => {
    setSelectedUnitAdmin(unitAdmin);
  }, []);

  const handleCloseEditModal = () => {
    setShowEditUnitAdminModal(false);
    setSelectedUnitAdmin(null);
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
    if (!itemToToggle || activateAssessorDomainLoading || deactivateAssessorDomainLoading) {
      return;
    }
    const { id, isActive } = itemToToggle;
    try {
      if (isActive) {
        dispatch(deactivateAssessorDomainAction(id))
          .then(() => {
            setShowToggleConfirmModal(false);
          })
          .catch(error => {
            Logger.error('Deactivate assessor domain failed:', error);
          });
      } else {
        dispatch(activateAssessorDomainAction(id))
          .then(() => {
            setShowToggleConfirmModal(false);
          })
          .catch(error => {
            Logger.error('Activate assessor domain failed:', error);
          });
      }
    } catch (error) {
      Logger.error('Toggle assessor domain failed:', error);
    }
  };

  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const isSm = useMediaQuery(theme.breakpoints.between('sm', 'md'));

  const columns = useMemo(() => {
    const cols = [];

    // Hide action column on very small screens to save space
    if (!isXs) {
      cols.push({
        field: 'action',
        headerName: 'Actions',
        sortable: false,
        minWidth: 130,
        renderCell: params => {
          const rowId = params.row?.id;
          const isItemActive = params.row?.isActive ?? true;
          return (
            <div style={{ display: 'flex', gap: '8px' }}>
              <AppButton variant="secondary" size="extraSmall" title={'Edit'} onClick={() => handleEditUnitAdmin(params.row)} />
              <div className="toggle-btns d-flex">
                {isItemActive ? (
                  <AppToolTip title="Deactivate Assessor Domain">
                    <Image src={Icons.active} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleToggle(rowId, true, params.row.fullName || params.row.user)} />
                  </AppToolTip>
                ) : (
                  <AppToolTip title="Activate Assessor Domain">
                    <Image src={Icons.inactive} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleToggle(rowId, false, params.row.fullName || params.row.user)} />
                  </AppToolTip>
                )}
              </div>
            </div>
          );
        },
      });
    }

    cols.push({
      field: 'domainNo',
      headerName: 'Domain No.',
      sortable: false,
      flex: isXs ? 0.5 : 1,
      minWidth: 90,
      renderCell: params => {
        const rows = assessorDomains?.data || [];
        const indexOnPage = rows.findIndex(row => (row.id || row.user_id) === params.id);
        return (
          <Typography variant="body2" className="heading-color">
            {(page - 1) * pageSize + indexOnPage + 1}
          </Typography>
        );
      },
    });

    cols.push({
      field: 'domain',
      headerName: 'Domain',
      sortable: false,
      flex: isXs ? 2 : isSm ? 3 : 6,
      minWidth: 280,
      renderCell: params => (
        <Typography variant="body2" className="heading-color line-clamp" sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
          {params.row.domainName}
        </Typography>
      ),
    });

    cols.push({
      field: 'status',
      headerName: 'Status',
      sortable: false,
      // headerAlign: 'right',
      flex: 1,
      minWidth: 100,
      renderCell: params => (
        <div>
          <AppBadge variant={getBadgeVariantByLabel(params.row?.isActive ? 'Active' : 'Inactive')} label={params.row?.isActive ? 'Active' : 'Inactive'} />
        </div>
      ),
    });

    return cols;
  }, [isXs, isSm, handleEditUnitAdmin, handleToggle, page, pageSize, assessorDomains?.data]);
  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="table-container">
                <div className="table-header">
                  <div className="table-header-left">
                    <h1 className="page-heading">Assessor Domains</h1>
                    <div className="input-search-document">
                      <ListSearchBox
                        value={filters.search}
                        placeholder="Search assessor domains"
                        onSearch={value => {
                          setFilters(prev => ({ ...prev, search: value }));
                          setPage(1);
                        }}
                      />
                    </div>
                  </div>
                  <div className="table-header-right">
                    <AppButton variant="primary" size="small" title={'Add New'} onClick={() => setShowAddAssessorModal(true)} />
                  </div>
                </div>

                <div className="table-wrapper">
                  <AppDataGrid
                    rows={assessorDomains?.data || []}
                    columns={columns}
                    rowCount={assessorDomains?.pagination?.total || 0}
                    page={page}
                    pageSize={pageSize}
                    onPaginationChange={model => {
                      setPage(model.page);
                      setPageSize(model.pageSize);
                    }}
                    getRowId={getMasterRowId}
                    loading={assessorDomainsLoading}
                    emptyTitle="No Assessor Domains"
                    emptySubtitle="Assessor Domains have not been configured yet."
                    sx={GRID_SX}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AddAssessorDomainModal open={showAddAssessorModal} handleClose={handleCloseModal} onGeneralError={handleGeneralError} />

      <EditAssessorDomainModal open={showEditUnitAdminModal} handleClose={handleCloseEditModal} data={selectedUnitAdmin} onGeneralError={handleGeneralError} />

      <AppModal
        modalHeaderStyle={{ backgroundColor: itemToToggle?.isActive ? 'var(--danger-light)' : 'var(--success-light)' }}
        image={itemToToggle?.isActive ? Icons.rejectIcon : Icons.successCircle}
        show={showToggleConfirmModal}
        header={itemToToggle?.isActive ? 'Deactivate Assessor Domain?' : 'Activate Assessor Domain?'}
        subHeader={itemToToggle?.isActive ? 'This will no longer be available for selection across the platform.' : 'This will be available for selection across the platform.'}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonDisabled={activateAssessorDomainLoading || deactivateAssessorDomainLoading}
        leftButtonOnClick={() => {
          setShowToggleConfirmModal(false);
        }}
        rightButton={itemToToggle?.isActive ? 'Deactivate' : 'Activate'}
        rightButtonClassName={`w-100 ${itemToToggle?.isActive ? 'danger-primary' : 'primary'}`}
        rightButtonOnClick={confirmToggleItem}
        rightButtonLoading={activateAssessorDomainLoading || deactivateAssessorDomainLoading}
        rightButtonDisabled={activateAssessorDomainLoading || deactivateAssessorDomainLoading}
        onExited={() => setItemToToggle(null)}
      />
    </Layout>
  );
};

export default AssessorDomain;
