import { useEffect, useMemo, useState } from 'react';
import { Accordion } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import CustomerDetailModal from '../../components/modals/CustomerDetailModal';
import EditContactPersonModal from '../../components/modals/EditContactPersonModal';
import ImagePreviewModal from '../../components/modals/ImagePreviewModal';
import KeyRawMaterialModal from '../../components/modals/KeyRawMaterialModal';
import ProductDetailModal from '../../components/modals/ProductDetailModal';
import { DEBOUNCE_DELAY_MS, LARGE_LIST_PAGE_SIZE } from '../../constants/appConstants';
import { ownershipTypeOptions } from '../../constants/filterData';
import Icons from '../../constants/Icons';
import { updateContactPersonAction } from '../../redux/action/enterpriseAdmin/application/ApplicationAction';
import { listKeyProcessesAction, listThirdPartyCertsAction } from '../../redux/action/master/MasterAction';
import { downloadFile } from '../../utils/FileUtils';
import { formatDisplayValue, formatFullAddress, formatNumber, parseNumericOrNull } from '../../utils/formatters';
import { AppButton } from '../base';
import AppIconButton from '../base/AppIconButton';

const OverviewManufacturingTab = ({ applicationDetails, edit }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [keyRawMaterialModalOpen, setKeyRawMaterialModalOpen] = useState(false);
  const [selectedKeyRawMaterial, setSelectedKeyRawMaterial] = useState(null);
  const [imagePreviewSrc, setImagePreviewSrc] = useState(null);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [contactPersonModalOpen, setContactPersonModalOpen] = useState(false);
  const { getKeyProcesses } = useSelector(state => state.Master);
  const dispatch = useDispatch();

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const filtersData = {
        search: '',
        status: 'active',
        perPage: LARGE_LIST_PAGE_SIZE,
        page: 1,
      };
      dispatch(listKeyProcessesAction(filtersData));
      dispatch(listThirdPartyCertsAction(filtersData));
    }, DEBOUNCE_DELAY_MS);
    return () => clearTimeout(timeoutId);
  }, []);
  const handleViewProduct = data => {
    setSelectedProduct(data);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedProduct(null);
  };

  const handleViewCustomer = data => {
    setSelectedCustomer(data);
    setCustomerModalOpen(true);
  };

  const handleCloseCustomerModal = () => {
    setCustomerModalOpen(false);
    setSelectedCustomer(null);
  };

  const handleCloseKeyRawMaterialModal = () => {
    setKeyRawMaterialModalOpen(false);
    setSelectedKeyRawMaterial(null);
  };
  const keyProcessesList = useMemo(() => {
    const selected = applicationDetails?.mfgKeyProcesses || applicationDetails?.keyProcesses || applicationDetails?.processes || [];
    const masterData = Array.isArray(getKeyProcesses?.data) ? getKeyProcesses.data : [];
    if (!selected || selected.length === 0) {
      return [];
    }
    return selected.map(item => {
      if (item && typeof item === 'object') {
        return item.name || item.processName || String(item);
      }
      const primitive = String(item);
      const found = masterData.find(p => String(p.id) === primitive || String(p.name) === primitive || String(p.processName) === primitive);
      if (found) {
        return found.name || found.processName || primitive;
      }
      return primitive;
    });
  }, [applicationDetails, getKeyProcesses]);

  const outsourcedProcessesList = useMemo(() => {
    const selected = applicationDetails?.mfgOutsourcedProcesses || applicationDetails?.outsourcedProcesses || applicationDetails?.processes || [];
    const masterData = Array.isArray(getKeyProcesses?.data) ? getKeyProcesses.data : [];
    if (!selected || selected.length === 0) {
      return [];
    }
    return selected.map(item => {
      if (item && typeof item === 'object') {
        return item.name || item.processName || String(item);
      }
      const primitive = String(item);
      const found = masterData.find(p => String(p.id) === primitive || String(p.name) === primitive || String(p.processName) === primitive);
      if (found) {
        return found.name || found.processName || primitive;
      }
      return primitive;
    });
  }, [applicationDetails, getKeyProcesses]);

  const handleSaveContactPerson = async data => {
    const payload = {
      contactPersonName: data.name,
      contactPersonDesignation: data.designation,
      contactPersonMobile: data.mobileNumber,
      contactPersonEmail: data.emailId,
    };
    await dispatch(updateContactPersonAction({ applicationId: applicationDetails?.id, applicationData: payload }));
    setContactPersonModalOpen(false);
  };

  return (
    <>
      <Accordion defaultActiveKey={['0', '1', '2', '3', '4', '5']} alwaysOpen>
        <Accordion.Item eventKey="0">
          <Accordion.Header>Unit / Plant Location & Contact Details</Accordion.Header>
          <Accordion.Body className="p-0">
            <div className="details-card">
              <div className="enterpriseInfoMainWrapper">
                <div className="row">
                  <div className="col-sm-6">
                    <div className="enterpriseInfoWrapper">
                      <h5 className="dark-text">Unit / Plant Address</h5>
                      <span>{formatFullAddress(applicationDetails?.unitAddress, applicationDetails?.unitDistrict, applicationDetails?.unitState, applicationDetails?.unitPincode)}</span>
                      <ul className="enterpriseInfoUl">
                        <li>
                          <img src={Icons.receiver} alt="" className="icon-20 margin-right-8" />
                          <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Mobile Number:</p>
                          <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{applicationDetails?.unitMobile}</p>
                        </li>
                        <li>
                          <img src={Icons.landline} alt="" className="icon-20 margin-right-8" />
                          <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Landline Number:</p>
                          <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{applicationDetails?.unitLandline || '-'}</p>
                        </li>
                        <li>
                          <img src={Icons.email} alt="" className="icon-20 margin-right-8" />
                          <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Email:</p>
                          <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formatDisplayValue(applicationDetails?.unitEmail)}</p>
                        </li>
                        <li>
                          <img src={Icons.email} alt="" className="icon-20 margin-right-8" />
                          <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Alternate Email:</p>
                          <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formatDisplayValue(applicationDetails?.unitAlternateEmail) || '-'}</p>
                        </li>
                        <li>
                          <img src={Icons.gallery} alt="" className="icon-20 margin-right-8" />
                          <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Picture of Site Exterior:</p>
                          <AppButton
                            size="small"
                            variant="link"
                            title={'View'}
                            onClick={() => {
                              setImagePreviewSrc(applicationDetails?.siteExteriorPhotoUrl);
                              setImagePreviewOpen(true);
                            }}
                          />
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="enterpriseInfoWrapper">
                      <h5 className="dark-text">Registered Office Address</h5>
                      <span>
                        {formatFullAddress(
                          applicationDetails?.registeredOfficeAddress,
                          applicationDetails?.registeredOfficeDistrict,
                          applicationDetails?.registeredOfficeState,
                          applicationDetails?.registeredOfficePincode,
                        )}
                      </span>
                      <ul className="enterpriseInfoUl">
                        <li>
                          <img src={Icons.receiver} alt="" className="icon-20 margin-right-8" />
                          <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Mobile Number:</p>
                          <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{applicationDetails?.registeredOfficeMobile}</p>
                        </li>
                        <li>
                          <img src={Icons.landline} alt="" className="icon-20 margin-right-8" />
                          <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Landline Number:</p>
                          <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{applicationDetails?.registeredOfficeLandline || '-'}</p>
                        </li>
                        <li>
                          <img src={Icons.email} alt="" className="icon-20 margin-right-8" />
                          <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Email:</p>
                          <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formatDisplayValue(applicationDetails?.registeredOfficeEmail)}</p>
                        </li>
                        <li>
                          <img src={Icons.email} alt="" className="icon-20 margin-right-8" />
                          <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Alternate Email:</p>
                          <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formatDisplayValue(applicationDetails?.registeredOfficeAlternateEmail)}</p>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <hr className="divider-small" />
              <h5 className="heading-color">Category & Stores</h5>
              <div className="col-md-12 align-items-center">
                <div className="cus-bx-1 ">
                  <span className="fs-12 fw-400 text-2-color">Category:</span>

                  <span className="fs-14 fw-500 heading-color margin-left-8">{applicationDetails?.vendorCategoryName}</span>
                </div>
                <div className="cus-bx-1 ">
                  <span className="fs-12 fw-400 text-2-color">Stores:</span>
                  {(applicationDetails?.mfgDrdoVendorStores || applicationDetails?.mfgKeyProcesses || [])?.map((item, idx) => (
                    <span key={idx} className="margin-left-8 cusTags">
                      {typeof item === 'object' ? item.storeName || item.processName || item.name : item}
                    </span>
                  ))}
                </div>
              </div>
              <hr className="divider-small" />
              <div className="bottom-EnterpriseInfo">
                <div className="d-flex justify-content-between align-items-start">
                  <h5 className="heading-color">Contact Person</h5>
                  {edit && <AppIconButton icon={Icons.edit} label="Edit contact person" iconClassName="icon-18" onClick={() => setContactPersonModalOpen(true)} />}
                </div>
                <ul className="enterpriseInfoUl enterpriseInfoHorizontalUl">
                  <li>
                    <img src={Icons.user} alt="" className="icon-20 margin-right-8" />
                    <p className="fs-12 fw-400 mb-0 text-3-color">Name:</p>
                    <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formatDisplayValue(applicationDetails?.contactPersonName)}</p>
                  </li>
                  <li>
                    <img src={Icons.designation} alt="" className="icon-20 margin-right-8" />
                    <p className="fs-12 fw-400 mb-0 text-3-color">Designation:</p>
                    <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formatDisplayValue(applicationDetails?.contactPersonDesignation)}</p>
                  </li>
                  <li>
                    <img src={Icons.receiver} alt="" className="icon-20 margin-right-8" />
                    <p className="fs-12 fw-400 mb-0 text-3-color">Mobile Number:</p>
                    <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{applicationDetails?.contactPersonMobile}</p>
                  </li>
                  <li>
                    <img src={Icons.email} alt="" className="icon-20 margin-right-8" />
                    <p className="fs-12 fw-400 mb-0 text-3-color">Email:</p>
                    <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formatDisplayValue(applicationDetails?.contactPersonEmail)}</p>
                  </li>
                </ul>
              </div>
            </div>
          </Accordion.Body>
        </Accordion.Item>
        {applicationDetails?.status !== 'draft' && (
          <>
            <Accordion.Item eventKey="1">
              <Accordion.Header>Operational Details</Accordion.Header>
              <Accordion.Body className="p-0">
                <div className="details-card">
                  <div className="enterpriseInfoMainWrapper">
                    <div className="row">
                      <div className="col-sm-12">
                        <div className="enterpriseInfoWrapper">
                          <ul className="enterpriseInfoUl gap-14">
                            <li>
                              <img src={Icons.tickCircle} alt="" className="icon-20 margin-right-8" />
                              <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-2-color w-auto">Ownership Type:</p>
                              <p className="fs-12 fw-500 mb-0 heading-color margin-left-12 text-capitalize">
                                {ownershipTypeOptions.find(option => option.value === applicationDetails?.ownershipType)?.label}
                              </p>
                            </li>
                            <li>
                              <img src={Icons.users} alt="" className="icon-20 margin-right-8" />
                              <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-2-color w-auto">Number of Employees:</p>
                              <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">
                                {formatNumber(
                                  (Number(applicationDetails?.maleEmployeesCount) || 0) +
                                    (Number(applicationDetails?.femaleEmployeesCount) || 0) +
                                    (Number(applicationDetails?.otherEmployeesCount) || 0),
                                )}
                              </p>
                              <ul className="numberEmployeesUl">
                                <li>(</li>
                                <li>
                                  <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-2-color w-auto">Male Employees</p>
                                  <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formatNumber(parseNumericOrNull(applicationDetails?.maleEmployeesCount))}</p>
                                </li>
                                <li className="enterpriseInfoUl-divider"></li>
                                <li>
                                  <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-2-color w-auto">Female Employees</p>
                                  <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formatNumber(parseNumericOrNull(applicationDetails?.femaleEmployeesCount))}</p>
                                </li>
                                <li className="enterpriseInfoUl-divider"></li>
                                <li className="me-0">
                                  <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-2-color w-auto">Other Employees</p>
                                  <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formatNumber(parseNumericOrNull(applicationDetails?.otherEmployeesCount))}</p>
                                </li>
                                <li>)</li>
                              </ul>
                            </li>
                            <li>
                              <img src={Icons.documentText} alt="" className="icon-20 margin-right-8" />
                              <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-2-color w-auto">GST Number:</p>
                              <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formatDisplayValue(applicationDetails?.gstNumber)}</p>
                              {applicationDetails?.gstCertificateFileUrl && (
                                <AppButton size="small" variant="link" title={'View'} onClick={() => downloadFile(applicationDetails?.gstCertificateFileUrl, 'gst_certificate')} />
                              )}
                            </li>
                            <li>
                              <img src={Icons.organisation} alt="" className="icon-20 margin-right-8" />
                              <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-2-color w-auto">Registered with Government Organisation:</p>
                              <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formatDisplayValue(applicationDetails?.govtOrganisationName)}</p>

                              {applicationDetails?.govtRegistrationCertificateUrl && (
                                <AppButton size="small" variant="link" title={'View'} onClick={() => downloadFile(applicationDetails?.govtRegistrationCertificateUrl, 'govt_registration')} />
                              )}
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Accordion.Body>
            </Accordion.Item>
            <Accordion.Item eventKey="2">
              <Accordion.Header>Products & Customer Details</Accordion.Header>
              <Accordion.Body className="p-0">
                <div className="details-card">
                  <div className="enterpriseInfoMainWrapper">
                    <div className="row">
                      <div className="col-sm-6 support-form-section">
                        <div className="enterpriseInfoWrapper">
                          <h5 className="dark-text mb-4">Product/Articles</h5>
                          <table className="table product-details-table">
                            <thead>
                              <tr>
                                <th>S.No</th>
                                <th>Name of Product</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(applicationDetails?.mfgProducts || []).map((product, index) => (
                                <tr key={index}>
                                  <td>{index + 1}</td>
                                  <td className="text-capitalize">{product.productName}</td>
                                  <td>
                                    <a
                                      href="#"
                                      onClick={e => {
                                        e.preventDefault();
                                        handleViewProduct(product);
                                      }}>
                                      View
                                    </a>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="col-sm-6 contact-info-section">
                        <div className="enterpriseInfoWrapper">
                          <h5 className="dark-text mb-4">Customer Details</h5>
                          <table className="table product-details-table">
                            <thead>
                              <tr>
                                <th>S.No</th>
                                <th>Name of the Customer</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(applicationDetails?.customers || []).map((customer, index) => (
                                <tr key={index}>
                                  <td>{index + 1}</td>
                                  <td className="text-capitalize">{customer.customerName}</td>
                                  <td>
                                    <a
                                      href="#"
                                      onClick={e => {
                                        e.preventDefault();
                                        handleViewCustomer(customer);
                                      }}>
                                      View
                                    </a>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Accordion.Body>
            </Accordion.Item>
            <Accordion.Item eventKey="3">
              <Accordion.Header>Key Manufacturing Processes</Accordion.Header>
              <Accordion.Body className="p-0">
                <div className="details-card pt-0">
                  <div className="enterpriseInfoMainWrapper">
                    <div className="row align-items-center">
                      <div className="col-md-12 align-items-cente">
                        <div className="cus-bx-1 ">
                          <span className="fs-12 fw-400 text-2-color">Key Processes:</span>
                          {keyProcessesList.map((p, i) => (
                            <span key={`kp-${i}`} className="margin-left-8 cusTags">
                              {p}
                            </span>
                          ))}
                        </div>

                        {outsourcedProcessesList.length > 0 && (
                          <div className="cus-bx-1">
                            <span className="fs-12 fw-400 text-2-color">Outsourced Processes:</span>
                            {(outsourcedProcessesList || []).map((p, i) => (
                              <span key={`op-${i}`} className="margin-left-8 cusTags">
                                {p}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Accordion.Body>
            </Accordion.Item>
            <Accordion.Item eventKey="4">
              <Accordion.Header>Key Raw Materials / Bought-Out Parts</Accordion.Header>
              <Accordion.Body className="p-0">
                <div className="details-card pt-0 pb-0">
                  <div className="enterpriseInfoMainWrapper">
                    <table className="table product-details-table firstChildInherit">
                      <thead>
                        <tr>
                          <th>
                            Key Raw Materials /<br /> Bought-Out Parts
                          </th>
                          <th>Name of the Raw Material / Bought-Out Part</th>
                          <th>Whether imported?</th>
                          <th>
                            Name of country from which the
                            <br /> material / part is imported
                          </th>
                          <th>
                            Percentage(%)
                            <br /> imported
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(applicationDetails?.mfgRawMaterials || []).map((rawMaterial, idx) => (
                          <tr key={idx}>
                            <td>Key Raw Material</td>

                            <td>{rawMaterial.materialName}</td>
                            <td>{rawMaterial.isImported ? 'Yes' : 'No'}</td>
                            <td>{rawMaterial.importCountry || '-'}</td>
                            <td>{rawMaterial.importPercentage ? `${rawMaterial.importPercentage}%` : '-'}</td>
                          </tr>
                        ))}
                        {(applicationDetails?.mfgBoughtOutParts || []).map((boughtOutPart, idx) => (
                          <tr key={idx}>
                            <td>Bought-Out Part</td>
                            <td>{boughtOutPart.partName}</td>
                            <td>{boughtOutPart.isImported ? 'Yes' : 'No'}</td>
                            <td>{boughtOutPart.importCountry || '-'}</td>
                            <td>{boughtOutPart.importPercentage ? `${boughtOutPart.importPercentage}%` : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Accordion.Body>
            </Accordion.Item>
            <Accordion.Item eventKey="5">
              <Accordion.Header>Documents & Declarations</Accordion.Header>
              <Accordion.Body className="p-0">
                <div className="details-card pt-0">
                  <div className="enterpriseInfoMainWrapper">
                    <div className="row align-items-center">
                      <div className="col-md-12 align-items-cente">
                        <div className="cus-bx-1 ">
                          <img src={Icons.tickSuccess} alt="key-process" className="icon-16 margin-right-8" />
                          <span className="fs-12 fw-400 text-2-color">Third Party Certifications:</span>
                          {(applicationDetails?.thirdPartyCertificationNames || []).map((certification, idx) => (
                            <span key={idx} className="margin-left-8 cusTags">
                              {formatDisplayValue(certification)}
                            </span>
                          ))}
                        </div>
                        <div className="cus-bx-1">
                          <img src={Icons.tickSuccess} alt="outsourced-process" className="icon-16 margin-right-8" />
                          <span className="fs-12 fw-400 text-2-color">Whether blacklisted/banned ever by any competent authority?</span>
                          {applicationDetails?.isBlacklisted ? (
                            (applicationDetails?.blacklistedOrganizations || []).map((org, idx) => (
                              <span key={idx} className="margin-left-8 cusTags">
                                {formatDisplayValue(org)}
                              </span>
                            ))
                          ) : (
                            <span className="fs-14 fw-500 heading-color margin-left-8">No</span>
                          )}
                        </div>
                        <div className="cus-bx-1">
                          <img src={Icons.danger} alt="outsourced-process" className="icon-16 margin-right-8" />
                          <span className="fs-12 fw-400 text-2-color">Any ongoing enquiry/investigation against firm?</span>
                          <span className="fs-14 fw-500 heading-color margin-left-8">{formatDisplayValue(applicationDetails?.hasOngoingEnquiry ? 'Yes' : 'No')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Accordion.Body>
            </Accordion.Item>
          </>
        )}
      </Accordion>
      <ImagePreviewModal show={imagePreviewOpen} onClose={() => setImagePreviewOpen(false)} src={imagePreviewSrc} alt="Site Exterior" />

      <ProductDetailModal open={modalOpen} onClose={handleCloseModal} product={selectedProduct} data={applicationDetails} />
      <CustomerDetailModal open={customerModalOpen} onClose={handleCloseCustomerModal} customer={selectedCustomer} />
      <EditContactPersonModal show={contactPersonModalOpen} handleClose={() => setContactPersonModalOpen(false)} handleSave={handleSaveContactPerson} initialData={applicationDetails} />
      <KeyRawMaterialModal open={keyRawMaterialModalOpen} onClose={handleCloseKeyRawMaterialModal} product={selectedKeyRawMaterial} />
    </>
  );
};

export default OverviewManufacturingTab;
