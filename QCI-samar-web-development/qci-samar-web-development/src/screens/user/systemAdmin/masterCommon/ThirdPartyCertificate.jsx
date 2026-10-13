import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { AppBadge, AppButton, AppDataGrid, AppModal, AppToolTip } from '../../../../components/base';
import { toastError } from '../../../../components/base/toast';
import { Layout } from '../../../../components/layout';
import { AddThirdPartyCertificateModal, EditThirdPartyCertificateModal } from '../../../../components/modals';
import Icons from '../../../../constants/Icons';
import { activateThirdPartyCertAction, deactivateThirdPartyCertAction, getThirdPartyCertAction, listThirdPartyCertsAction } from '../../../../redux/action/master/MasterAction';
import { getBadgeVariantByLabel } from '../../../../utils/getStatusColors';
import { Logger } from '../../../../utils/logger';

const getMasterRowId = row => row.id || row.user_id;

const ThirdPartyCertificate = () => {
  const dispatch = useDispatch();

  const [showAddAssessorModal, setShowAddAssessorModal] = useState(false);
  const [showEditUnitAdminModal, setShowEditUnitAdminModal] = useState(false);
  const [selectedUnitAdmin, setSelectedUnitAdmin] = useState(null);
  const [filters, _setFilters] = useState({
    search: '',
    User: '',
    unitStatus: '',
  });
  const [page, setPage] = useState(1);
  // default pageSize should be one of the options so DataGrid shows the selector correctly
  const [pageSize, setPageSize] = useState(10);
  const [showToggleConfirmModal, setShowToggleConfirmModal] = useState(false);
  const [itemToToggle, setItemToToggle] = useState(null);
  const [_serverError, setServerError] = useState('');

  const { thirdPartyCerts, thirdPartyCertsLoading, getThirdPartyCert, activateThirdPartyCertLoading, deactivateThirdPartyCertLoading, activateThirdPartyCert, deactivateThirdPartyCert } = useSelector(
    state => state.Master,
  );

  // Fetch list on pagination/filter changes
  useEffect(() => {
    const filtersData = {
      search: filters.search,
      perPage: pageSize,
      page: page,
    };
    dispatch(listThirdPartyCertsAction(filtersData));
  }, [dispatch, page, pageSize, filters]);

  const handleGeneralError = error => {
    setServerError(error);
    toastError(error);
  };

  // Open edit modal when userDetails data is received
  useEffect(() => {
    if (selectedUnitAdmin) {
      setShowEditUnitAdminModal(true);
    }
  }, [selectedUnitAdmin]);

  const handleCloseModal = () => {
    setShowAddAssessorModal(false);
  };

  const handleEditUnitAdmin = useCallback(
    unitAdmin => {
      setSelectedUnitAdmin(unitAdmin);
      dispatch(getThirdPartyCertAction(unitAdmin.id));
    },
    [dispatch],
  );

  const handleCloseEditModal = () => {
    setShowEditUnitAdminModal(false);
    setSelectedUnitAdmin(null);
  };

  // Refresh list when activate/deactivate operations complete
  useEffect(() => {
    if (activateThirdPartyCert || deactivateThirdPartyCert) {
      const filtersData = {
        search: filters.search,
        perPage: pageSize,
        page: page,
      };
      dispatch(listThirdPartyCertsAction(filtersData));
    }
  }, [activateThirdPartyCert, deactivateThirdPartyCert, dispatch, filters.search, pageSize, page]);

  const handleToggle = useCallback((rowId, isCurrentlyActive, itemName) => {
    setItemToToggle({
      id: rowId,
      isActive: isCurrentlyActive,
      name: itemName,
    });
    setShowToggleConfirmModal(true);
  }, []);

  const confirmToggleItem = () => {
    if (!itemToToggle || activateThirdPartyCertLoading || deactivateThirdPartyCertLoading) {
      return;
    }
    const { id, isActive } = itemToToggle;
    if (isActive) {
      dispatch(deactivateThirdPartyCertAction(id))
        .then(() => {
          setShowToggleConfirmModal(false);
        })
        .catch(error => {
          Logger.error('Deactivate third party certificate failed:', error);
        });
    } else {
      dispatch(activateThirdPartyCertAction(id))
        .then(() => {
          setShowToggleConfirmModal(false);
        })
        .catch(error => {
          Logger.error('Activate third party certificate failed:', error);
        });
    }
  };

  const columns = useMemo(
    () => [
      {
        field: 'action',
        headerName: 'Actions',
        flex: 0.5,
        minWidth: 150,
        sortable: false,
        renderCell: params => {
          const rowId = params.row?.id;
          const isItemActive = params.row?.isActive ?? true;
          return (
            <div style={{ display: 'flex', gap: '8px' }}>
              <AppButton variant="secondary" size="extraSmall" title={'Edit'} onClick={() => handleEditUnitAdmin(params.row)} />
              <div className="toggle-btns d-flex">
                {isItemActive ? (
                  <AppToolTip title="Deactivate Third Party Certificate">
                    <Image src={Icons.active} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleToggle(rowId, true, params.row.fullName || params.row.user)} />
                  </AppToolTip>
                ) : (
                  <AppToolTip title="Activate Third Party Certificate">
                    <Image src={Icons.inactive} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleToggle(rowId, false, params.row.fullName || params.row.user)} />
                  </AppToolTip>
                )}
              </div>
            </div>
          );
        },
      },
      {
        field: 'certificate',
        headerName: 'Certificate',
        flex: 1.2,
        sortable: false,
        minWidth: 150,
        renderCell: params => (
          <div className="double-content">
            <h4 className="fs-14 fw-500 text-2-color">{params.row.certificationName}</h4>
          </div>
        ),
      },
      {
        field: 'status',
        headerName: 'Status',
        sortable: false,
        flex: 1,
        minWidth: 120,
        renderCell: params => {
          return <AppBadge variant={getBadgeVariantByLabel(params.row?.isActive ? 'Active' : 'Inactive')} label={params.row?.isActive ? 'Active' : 'Inactive'} />;
        },
      },
    ],
    [handleEditUnitAdmin, handleToggle],
  );

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="table-container">
                <div className="table-header">
                  <div className="table-header-left">
                    <h1 className="page-heading">Third Party Certificates</h1>
                  </div>
                  <div className="table-header-right">
                    <AppButton variant="primary" size="small" title={'Add New'} onClick={() => setShowAddAssessorModal(true)} />
                  </div>
                </div>

                <div className="table-wrapper">
                  <AppDataGrid
                    rows={thirdPartyCerts?.data || []}
                    columns={columns}
                    rowCount={thirdPartyCerts?.pagination?.total || 0}
                    page={page}
                    pageSize={pageSize}
                    onPaginationChange={model => {
                      setPage(model.page);
                      setPageSize(model.pageSize);
                    }}
                    getRowId={getMasterRowId}
                    loading={thirdPartyCertsLoading}
                    emptyTitle="No Third-Party Certifications"
                    emptySubtitle="No third-party certifications have been configured yet."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AddThirdPartyCertificateModal open={showAddAssessorModal} handleClose={handleCloseModal} onGeneralError={handleGeneralError} />

      <EditThirdPartyCertificateModal open={showEditUnitAdminModal} handleClose={handleCloseEditModal} data={getThirdPartyCert} onGeneralError={handleGeneralError} />

      <AppModal
        modalHeaderStyle={{ backgroundColor: itemToToggle?.isActive ? 'var(--danger-light)' : 'var(--success-light)' }}
        image={itemToToggle?.isActive ? Icons.rejectIcon : Icons.successCircle}
        show={showToggleConfirmModal}
        header={itemToToggle?.isActive ? 'Deactivate Certificate?' : 'Activate Certificate?'}
        subHeader={itemToToggle?.isActive ? 'This will no longer be available for selection across the platform.' : 'This will be available for selection across the platform.'}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonDisabled={activateThirdPartyCertLoading || deactivateThirdPartyCertLoading}
        leftButtonOnClick={() => {
          setShowToggleConfirmModal(false);
        }}
        rightButton={itemToToggle?.isActive ? 'Deactivate' : 'Activate'}
        rightButtonClassName={`w-100 ${itemToToggle?.isActive ? 'danger-primary' : 'primary'}`}
        rightButtonOnClick={confirmToggleItem}
        rightButtonLoading={activateThirdPartyCertLoading || deactivateThirdPartyCertLoading}
        rightButtonDisabled={activateThirdPartyCertLoading || deactivateThirdPartyCertLoading}
        onExited={() => setItemToToggle(null)}
      />
    </Layout>
  );
};

export default ThirdPartyCertificate;
