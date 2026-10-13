import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppButton, AppDataGrid, AppInput } from '../../../../components/base';
import { Layout } from '../../../../components/layout';
import { AddMemberModal, AppModal, EditMemberModal } from '../../../../components/modals';
import Icons from '../../../../constants/Icons';
import { deleteCommitteeMemberAction, getCommitteeMembersAction } from '../../../../redux/action/operationsAdmin/CommitteeMemberAction';

const Members = () => {
  const dispatch = useDispatch();
  const [modalOpen, setModalOpen] = useState(false);
  const [addMemberModal, setAddMemberModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  // 10 to match the grid's page-size options; 6 is not among them, so the footer could not
  // represent the active size and MUI warned on every render.
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });

  // Get members from Redux state
  const { members, membersLoading, deleteLoading } = useSelector(state => state.CommitteeMember || {});

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 400);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  // The list is small and admin-managed, so fetch the whole (search-filtered) set once and let
  // the grid paginate client-side — the API does not slice by perPage.
  useEffect(() => {
    dispatch(
      getCommitteeMembersAction({
        params: {
          perPage: 100,
          search: debouncedSearchQuery || undefined,
        },
      }),
    );
  }, [dispatch, debouncedSearchQuery]);

  const handleAddMember = () => {
    setAddMemberModal(true);
  };

  const handleEditMember = member => {
    setSelectedMember(member);
    setModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setMemberToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!memberToDelete) {
      return;
    }
    await dispatch(deleteCommitteeMemberAction({ memberId: memberToDelete.id }));
    // Refresh list after delete
    dispatch(
      getCommitteeMembersAction({
        params: {
          perPage: 100,
          search: searchQuery || undefined,
        },
      }),
    );
    handleCloseDeleteModal();
  };
  const columns = useMemo(
    () => [
      {
        field: 'action',
        headerName: 'Actions',
        flex: 1,
        minWidth: 140,
        sortable: false,
        renderCell: params => (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <AppButton variant="secondary" size="extraSmall" title={'Edit'} onClick={() => handleEditMember(params.row)} />
            <div className="gap-8 d-flex align-items-center margin-left-8">
              {/* <AppButton
              variant="danger-secondary"
              size="extraSmall"
              leftIconStyle={'icon-14 me-0'}
              leftIcon={Icons.trash}
              buttonPaddingX="0"
              minWidth={30}
              onClick={() => handleOpenDeleteModal(params.row)}
              disabled={deleteLoading}
            /> */}
            </div>
          </div>
        ),
      },
      {
        field: 'memberName',
        headerName: 'Member Name',
        flex: 1,
        minWidth: 150,
        sortable: false,
        renderCell: params => <span>{`${params.row.firstName || ''} ${params.row.lastName || ''}`.trim()}</span>,
      },
      {
        field: 'contact',
        headerName: 'Contact',
        flex: 1.2,
        minWidth: 180,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4 className="text-2-color">{params.row.mobileNumber || '-'}</h4>
            <span className="fs-12 fw-400 text-3-color">{params.row.email}</span>
          </div>
        ),
      },
      {
        field: 'designation',
        headerName: 'Designation',
        flex: 1,
        minWidth: 120,
        sortable: false,
        renderCell: params => <span className="text-3-color">{params.row.designation}</span>,
      },
      {
        field: 'organisation',
        headerName: 'Organisation',
        flex: 1,
        minWidth: 120,
        sortable: false,
        renderCell: params => <span className="text-3-color">{params.row.organisation}</span>,
      },
    ],
    [],
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
                    <h1 className="page-heading">Committee Members</h1>
                    <div className="input-search-document">
                      <AppInput
                        label={'Search'}
                        inputType="search"
                        name="search"
                        customInputClass={'search-input'}
                        value={searchQuery}
                        onChange={e => {
                          setSearchQuery(e.target.value);
                          setPaginationModel(prev => (prev.page === 0 ? prev : { ...prev, page: 0 }));
                        }}
                        placeholder="Search by name, email or contact"
                        customWidth="100%"
                        leftIcon={Icons.search}
                        marginLeft="6px"
                      />
                    </div>
                  </div>
                  <div className="table-header-right">
                    <AppButton variant="primary" size="small" title={'Add Member'} leftIcon={Icons.whiteAdd} leftIconStyle={'icon-14'} onClick={() => handleAddMember()} />
                  </div>
                </div>

                <div className="table-wrapper">
                  <AppDataGrid
                    rows={members || []}
                    columns={columns}
                    loading={membersLoading}
                    server={false}
                    page={paginationModel.page + 1}
                    pageSize={paginationModel.pageSize}
                    onPaginationChange={model => setPaginationModel({ page: model.page - 1, pageSize: model.pageSize })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <AddMemberModal
        open={addMemberModal}
        handleClose={() => {
          setAddMemberModal(false);
          // Refresh the list after adding a member
          dispatch(
            getCommitteeMembersAction({
              params: {
                perPage: 100,
                search: searchQuery || undefined,
              },
            }),
          );
        }}
      />
      <EditMemberModal
        open={modalOpen}
        member={selectedMember}
        handleClose={() => {
          setModalOpen(false);
          setSelectedMember(null);
          // Refresh the list after editing a member
          dispatch(
            getCommitteeMembersAction({
              params: {
                perPage: 100,
                search: searchQuery || undefined,
              },
            }),
          );
        }}
      />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--warning-light)' }}
        image={Icons.deleteModal}
        show={showDeleteModal}
        handleClose={handleCloseDeleteModal}
        header={'Delete Member?'}
        subHeader={
          memberToDelete
            ? `${memberToDelete.firstName || ''} ${memberToDelete.lastName || ''} will be removed from this committee. This action cannot be undone.`
            : 'The member will be removed from this committee. This action cannot be undone.'
        }
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonOnClick={handleCloseDeleteModal}
        rightButton={'Delete'}
        rightButtonClassName={'w-100 btn-danger'}
        rightButtonLoading={deleteLoading}
        rightButtonOnClick={handleConfirmDelete}
      />
    </Layout>
  );
};

export default Members;
