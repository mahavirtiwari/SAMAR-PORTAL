import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppButton, AppModal, AppTableEmpty } from '../../../../components/base';
import { toastError } from '../../../../components/base/toast';
import { Layout } from '../../../../components/layout';
import AddDocumentModal from '../../../../components/modals/AddDocumentModal';
import { OPENED_BLOB_URL_TTL_MS } from '../../../../constants/appConstants';
import Icons from '../../../../constants/Icons';
import Images from '../../../../constants/Images';
import { activateDocumentAction, deactivateDocumentAction, downloadDocumentAction, getDocumentsAction } from '../../../../redux/action/common/DocumentAction';
import { resetDocumentCreateUpdateDelete } from '../../../../redux/slices/common/DocumentSlice';
import { onActivate } from '../../../../utils/a11y';
import { Logger } from '../../../../utils/logger';

const UserGuides = () => {
  const dispatch = useDispatch();
  const { documents, uploadedDocument, activateLoading, deactivateLoading, activatedDocument, deactivatedDocument } = useSelector(state => state.SystemAdminDocument);

  const [_localDocuments, setLocalDocuments] = useState([]);
  const [serverError, setServerError] = useState('');
  const [showAddDocumentModal, setShowAddDocumentModal] = useState(false);
  const [success, setSuccess] = useState(false);

  const [showToggleConfirmModal, setShowToggleConfirmModal] = useState(false);
  const [itemToToggle, setItemToToggle] = useState(null);
  const [_viewingDocId, setViewingDocId] = useState(null);

  // Fetch documents on component mount

  const handleGeneralError = errorMessage => {
    setServerError(errorMessage);
    toastError(errorMessage);
  };
  useEffect(() => {
    dispatch(getDocumentsAction()).catch(err => {
      Logger.error('Failed fetching documents:', err);
      handleGeneralError(err?.message || 'Failed to fetch documents');
    });
    dispatch(resetDocumentCreateUpdateDelete());
  }, [dispatch, activatedDocument, deactivatedDocument]);
  // Handle successful upload
  useEffect(() => {
    if (uploadedDocument) {
      setSuccess(true);

      setTimeout(() => {
        setSuccess(false);
      }, 2000);
      // Refresh documents list
      dispatch(getDocumentsAction());
    }
    dispatch(resetDocumentCreateUpdateDelete());
  }, [uploadedDocument, dispatch]);

  // Add new document handler
  const handleAddDocument = newDoc => {
    setLocalDocuments(prevDocs => [
      ...prevDocs,
      {
        ...newDoc,
        id: Date.now(),
        uploadDate: new Date().toISOString().split('T')[0],
        status: 'Pending',
      },
    ]);
    setShowAddDocumentModal(false);
  };

  // View document handler
  const handleViewDocument = async doc => {
    try {
      if (doc.id) {
        setViewingDocId(doc.id);
        // Use download API to get document blob
        const result = await dispatch(downloadDocumentAction(doc.id));

        if (result.type === 'documents/download/fulfilled') {
          // Determine file type based on document name or type
          const fileName = doc.name || doc.fileName || '';
          const fileExtension = fileName.toLowerCase().split('.').pop();

          let mimeType = 'application/pdf'; // Default to PDF
          if (fileExtension === 'docx') {
            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          } else if (fileExtension === 'doc') {
            mimeType = 'application/msword';
          }

          // Create blob URL and handle different file types
          const blob = new Blob([result.payload], { type: mimeType });
          const url = window.URL.createObjectURL(blob);

          // Open all file types directly using blob URL
          window.open(url, '_blank');

          // Keep the blob URL alive so the new tab's viewer can still save the file
          setTimeout(() => {
            window.URL.revokeObjectURL(url);
          }, OPENED_BLOB_URL_TTL_MS);
        } else {
          handleGeneralError('Failed to load document.');
        }
      } else if (doc.downloadUrl && doc.downloadUrl !== '#') {
        // Fallback to direct URL if no ID available
        window.open(doc.downloadUrl, '_blank');
      } else {
        handleGeneralError('No document available to view.');
      }
    } catch (error) {
      Logger.error('View document failed:', error);
      handleGeneralError('Failed to view document. Please try again.');
    } finally {
      setViewingDocId(null);
    }
  };
  const handleToggle = (rowId, isCurrentlyActive, itemName) => {
    setItemToToggle({
      id: rowId,
      isActive: isCurrentlyActive,
      name: itemName,
    });
    setShowToggleConfirmModal(true);
  };

  const handleOpenAddDocumentModal = () => setShowAddDocumentModal(true);
  const handleCloseAddDocumentModal = () => setShowAddDocumentModal(false);
  const confirmToggleItem = () => {
    if (!itemToToggle || activateLoading || deactivateLoading) {
      return;
    }
    const { id, isActive } = itemToToggle;
    try {
      if (isActive) {
        dispatch(deactivateDocumentAction(id))
          .then(() => {
            setShowToggleConfirmModal(false);
          })
          .catch(error => {
            Logger.error('Deactivate document failed:', error);
            handleGeneralError(error?.message || 'Failed to deactivate document');
          });
      } else {
        dispatch(activateDocumentAction(id))
          .then(() => {
            setShowToggleConfirmModal(false);
          })
          .catch(error => {
            Logger.error('Activate document failed:', error);
            handleGeneralError(error?.message || 'Failed to activate document');
          });
      }
    } catch (error) {
      Logger.error('Toggle document failed:', error);
      handleGeneralError(error?.message || 'Failed to toggle document');
    }
  };

  return (
    <>
      <Layout>
        <div className="main-content-inner">
          <div className="container">
            <div className="row">
              <div className="col-12">
                {/* User Guides Section */}
                <div className="table-container">
                  <div className="table-header">
                    <div className="table-header-left">
                      <h1 className="page-heading">User Guides</h1>
                    </div>
                    <div className="table-header-right">
                      <AppButton variant="primary" size="small" title="Add Document" leftIconStyle="icon-14" customClass="add-images-btn text-nowrap" onClick={handleOpenAddDocumentModal} />
                    </div>
                  </div>
                  <div className="table-wrapper">
                    <div className="row document-card-row">
                      {documents && documents.length > 0 ? (
                        // Combine API documents with local documents
                        [...(documents || [])].map(doc => (
                          <div className="col-sm-3" key={doc.id}>
                            <div className="applicantCard">
                              <div className="userGuide-img-container">
                                <img src={Images.dummyUserGuides} alt="document" className="img-fluid" />
                              </div>
                              <div className="applicationCard-bottom">
                                <h4
                                  className="fs-16 fw-500 heading-color"
                                  style={{
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: 'block',
                                    maxWidth: 270,
                                  }}>
                                  {doc.title}
                                </h4>
                                <div className="rowBetween">
                                  {/* <a className="fs-12 fw-600 danger-primary-color text-decoration-none" style={{ cursor: 'pointer' }} onClick={() => handleDeleteDocument(doc)}>
                                    Delete
                                  </a> */}
                                  <div className="toggle-btns d-flex">
                                    {doc.isActive ? (
                                      <a className="fs-12 fw-600 text-decoration-none danger-primary-color" style={{ cursor: 'pointer' }} {...onActivate(() => handleToggle(doc.id, true, doc.title))}>
                                        Deactivate
                                      </a>
                                    ) : (
                                      <a className="fs-12 fw-600 text-decoration-none success-active-color" style={{ cursor: 'pointer' }} {...onActivate(() => handleToggle(doc.id, false, doc.title))}>
                                        Activate
                                      </a>
                                    )}
                                  </div>
                                  <a className="fs-12 fw-600 primary-color text-decoration-none" style={{ cursor: 'pointer' }} {...onActivate(() => handleViewDocument(doc))}>
                                    View
                                  </a>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-12">
                          <AppTableEmpty title="No User Guides" subtitle="There are currently no user guides to display." height="300px" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
      <AddDocumentModal
        open={showAddDocumentModal}
        handleClose={handleCloseAddDocumentModal}
        handleCancel={handleCloseAddDocumentModal}
        handleSave={handleAddDocument}
        serverError={serverError}
        onGeneralError={handleGeneralError}
      />
      {/* <AppSnackBar ref={snackbarRef} severity="error" message={createError} /> */}
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        show={success}
        image={Icons.successCircle}
        header={'Document uploaded successfully'}
        subHeader={'The document has been uploaded and saved.'}
        onClose={() => setSuccess(false)}
      />
      <AppModal
        modalHeaderStyle={{ backgroundColor: itemToToggle?.isActive ? 'var(--danger-light)' : 'var(--success-light)' }}
        image={itemToToggle?.isActive ? Icons.rejectIcon : Icons.successCircle}
        show={showToggleConfirmModal}
        onExited={() => setItemToToggle(null)}
        header={itemToToggle?.isActive ? 'Deactivate Document?' : 'Activate Document?'}
        subHeader={itemToToggle?.isActive ? 'This will no longer be available for selection across the platform.' : 'This will be available for selection across the platform.'}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonDisabled={activateLoading || deactivateLoading}
        leftButtonOnClick={() => setShowToggleConfirmModal(false)}
        rightButton={itemToToggle?.isActive ? 'Deactivate' : 'Activate'}
        rightButtonClassName={`w-100 ${itemToToggle?.isActive ? 'danger-primary' : 'primary'}`}
        rightButtonOnClick={confirmToggleItem}
        rightButtonLoading={activateLoading || deactivateLoading}
        rightButtonDisabled={activateLoading || deactivateLoading}
      />
    </>
  );
};

export default UserGuides;
