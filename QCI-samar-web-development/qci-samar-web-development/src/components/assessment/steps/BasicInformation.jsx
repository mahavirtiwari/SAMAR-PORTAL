import { useEffect, useState } from 'react';
import { Accordion, Spinner } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ASSESSMENT_STATUS } from '../../../constants/assessmentStatus';
import Icons from '../../../constants/Icons';
import { getBasicInformationAction } from '../../../redux/action/common/ApplicationAssessmentAction';
import { isMemberExecutionLocked, isServiceSector, resolveTeamRole } from '../../../utils/assessmentExecution';
import CustomerDetailModal from '../../modals/CustomerDetailModal';
import ProductDetailModal from '../../modals/ProductDetailModal';
import ServiceDetailModal from '../../modals/ServiceDetailModal';
import ServiceBasicInformationForm from './ServiceBasicInformationForm';

/**
 * Shared BasicInformation component for Step 5 of Assessment
 * Fetches and displays basic information from the API
 * Supports both manufacturing and services sectors with mfg_/svc_ prefixed fields
 */
const BasicInformation = ({ onSaved }) => {
  const dispatch = useDispatch();
  const { id } = useParams();

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const { basicInformation, basicInformationLoading, basicInformationError, punchStatus } = useSelector(state => state.ApplicationAssessment);
  const { user } = useSelector(state => state.Account);
  const { assessment } = useSelector(state => state.Assessment);

  const assessmentData = assessment?.data?.assessment || assessment?.assessment || assessment;
  const { isLead } = resolveTeamRole(assessmentData, user?.id);
  const isPunchedIn = !!(punchStatus?.isPunchedIn ?? punchStatus?.is_punched_in);
  const isEditableStatus =
    (assessmentData?.status === ASSESSMENT_STATUS.IN_PROGRESS || assessmentData?.status === ASSESSMENT_STATUS.MOBILE_COMPLETE) && !isMemberExecutionLocked(assessmentData, user?.id);
  // Editable throughout the punch-in window; step sequencing no longer gates editing.
  const canEditBasicInformation = isLead && isServiceSector(assessmentData) && isEditableStatus && isPunchedIn;

  useEffect(() => {
    if (id) {
      dispatch(getBasicInformationAction(id));
    }
  }, [dispatch, id]);

  function handleViewProduct(product) {
    setSelectedProduct(product);
    setProductModalOpen(true);
  }

  function handleViewService(service) {
    setSelectedService(service);
    setServiceModalOpen(true);
  }

  function handleViewCustomer(customer) {
    setSelectedCustomer(customer);
    setCustomerModalOpen(true);
  }

  function handleCloseProductModal() {
    setProductModalOpen(false);
    setSelectedProduct(null);
  }

  function handleCloseServiceModal() {
    setServiceModalOpen(false);
    setSelectedService(null);
  }

  function handleCloseCustomerModal() {
    setCustomerModalOpen(false);
    setSelectedCustomer(null);
  }

  // Helper to extract process names from array of objects [{processName: "..."}] or [{process_name: "..."}]
  const extractProcessNames = value => {
    if (!value || !Array.isArray(value)) {
      return [];
    }
    return value
      .map(item => {
        if (typeof item === 'string') {
          return item;
        }
        return item.processName || item.process_name || item.name || String(item);
      })
      .filter(Boolean);
  };

  // Helper to ensure value is an array (handles strings, arrays, and null)
  const ensureArray = value => {
    if (!value) {
      return [];
    }
    if (Array.isArray(value)) {
      return value;
    }
    // Fallback for legacy comma-separated strings
    return value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  };

  // Helper to extract product name from various formats
  const getProductName = product => {
    return product.productName || product.productName || product.name || 'Unknown';
  };

  // Helper to extract customer name from various formats
  const getCustomerName = customer => {
    return customer.customerName || customer.customerName || customer.name || 'Unknown';
  };

  // Helper to extract material name from various formats
  const getMaterialName = material => {
    return material.materialName || material.partName || material.name || 'Unknown';
  };

  if (basicInformationLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (basicInformationError) {
    return (
      <div className="alert alert-danger" role="alert">
        Failed to load basic information: {basicInformationError?.message || 'Unknown error'}
      </div>
    );
  }

  // Handle API response structure
  const info = basicInformation?.basicInformation || basicInformation;

  if (canEditBasicInformation) {
    return <ServiceBasicInformationForm assessmentId={id} basicInformation={info} onSaved={onSaved} />;
  }

  if (!info) {
    return (
      <div className="text-center py-5">
        <p className="text-muted">No basic information recorded yet</p>
      </div>
    );
  }

  // Support both new (mfg_*/svc_*) and old field names for backward compatibility
  // Manufacturing fields (new names have priority)
  const products = info.mfgProducts || [];
  const customers = info.customers || [];

  // Stores/Labs - try new field names first, then legacy
  const storesArray = ensureArray(info.mfgDrdoVendorStores || info.mfgDrdoVendorStores || info.svcDrdoVendorLabs || info.svcDrdoVendorLabs);

  // Key processes - try new field names first (mfg_/svc_), then legacy
  const keyProcessesArray = extractProcessNames(info.mfgKeyProcesses || info.mfgKeyProcesses || info.svcKeyProcesses || info.svcKeyProcesses || info.keyProcesses || info.keyProcesses);

  // Outsourced processes - try new field names first (mfg_/svc_), then legacy
  const outsourcedProcessesArray = extractProcessNames(
    info.mfgOutsourcedProcesses || info.mfgOutsourcedProcesses || info.svcOutsourcedProcesses || info.svcOutsourcedProcesses || info.outsourcedProcesses || info.outsourcedProcesses,
  );

  const certificationsArray = ensureArray(info.thirdPartyCertificationNames || info.thirdPartyCertificationNames);

  // Materials - try new field names first (separate arrays), then legacy combined array
  const rawMaterials = info.mfgRawMaterials || info.mfgRawMaterials || (info.materials || []).filter(m => m.type === 'raw_material' || m.material_type === 'raw_material');
  const boughtOutParts = info.mfgBoughtOutParts || info.mfgBoughtOutParts || (info.materials || []).filter(m => m.type === 'bought_out_part' || m.material_type === 'bought_out_part');

  // Combine materials for display
  const allMaterials = [
    ...(Array.isArray(rawMaterials) ? rawMaterials : []).map(m => ({ ...m, materialType: 'Key Raw Material' })),
    ...(Array.isArray(boughtOutParts) ? boughtOutParts : []).map(m => ({ ...m, materialType: 'Bought-Out Part' })),
  ];

  // Services-specific data
  const services = info.svcServices || info.svcServices || [];
  const keyResources = info.svcKeyResources || [];
  const outsourcedComponents = info.svcOutsourcedComponents || [];

  // Combine key resources and outsourced components for display
  const allServiceResources = [
    ...(Array.isArray(keyResources) ? keyResources : []).map(r => ({ ...r, resourceType: 'Key Service Resource' })),
    ...(Array.isArray(outsourcedComponents) ? outsourcedComponents : []).map(c => ({ ...c, resourceType: 'Outsourced Service Component' })),
  ];

  // Determine if this is a services application
  const isServices = services.length > 0 || info.svcProviderType || info.svcProviderType;

  return (
    <>
      <Accordion defaultActiveKey={['0', '1', '3', '4', '5']} alwaysOpen>
        <Accordion.Item eventKey="0">
          <Accordion.Header>Category & {isServices ? 'Services' : 'Stores'}</Accordion.Header>
          <Accordion.Body className="p-0">
            <div className="details-card pt-0">
              <div className="enterpriseInfoMainWrapper">
                <div className="row align-items-center">
                  <div className="col-md-12 align-items-cente">
                    <div className="cus-bx-1">
                      <span className="fs-12 fw-400 text-2-color">Category:</span>
                      <span className="margin-left-8 fs-14 fw-500 heading-color">{info.category || 'Not specified'}</span>
                    </div>
                    <div className="cus-bx-1">
                      <span className="fs-12 fw-400 text-2-color">{isServices ? 'Services:' : 'Stores:'}</span>
                      {storesArray.length > 0 ? (
                        storesArray.map((store, idx) => (
                          <span key={idx} className="margin-left-8 cusTags">
                            {typeof store === 'string' ? store : store.labName || store.lab_name || store.storeName || store.store_name || store.name}
                          </span>
                        ))
                      ) : (
                        <span className="margin-left-8 text-muted">Not specified</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Accordion.Body>
        </Accordion.Item>
        <div className="bottom-seperator p-0"></div>
        <Accordion.Item eventKey="1">
          <Accordion.Header>{isServices ? 'Services' : 'Products'} & Customer Details</Accordion.Header>
          <Accordion.Body className="p-0">
            <div className="details-card pb-0">
              <div className="enterpriseInfoMainWrapper">
                <div className="row">
                  <div className="col-sm-6 support-form-section">
                    <div className="enterpriseInfoWrapper">
                      <h5 className="dark-text mb-4">{isServices ? 'Services' : 'Product/Articles'}</h5>
                      {isServices ? (
                        services.length > 0 ? (
                          <table className="table product-details-table">
                            <thead>
                              <tr>
                                <th>S.No</th>
                                <th>Name of Service</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {services.map((service, index) => (
                                <tr key={index}>
                                  <td>{index + 1}</td>
                                  <td className="text-capitalize">{service.serviceName || service.service_name || service.name || service}</td>
                                  <td>
                                    <Link
                                      to=""
                                      onClick={e => {
                                        e.preventDefault();
                                        handleViewService(service);
                                      }}>
                                      View
                                    </Link>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="text-muted">No services added</p>
                        )
                      ) : products.length > 0 ? (
                        <table className="table product-details-table">
                          <thead>
                            <tr>
                              <th>S.No</th>
                              <th>Name of Product</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {products.map((product, index) => (
                              <tr key={product.id || index}>
                                <td>{index + 1}</td>
                                <td className="text-capitalize">{getProductName(product)}</td>
                                <td>
                                  <Link
                                    to=""
                                    onClick={e => {
                                      e.preventDefault();
                                      handleViewProduct(product);
                                    }}>
                                    View
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-muted">No products added</p>
                      )}
                    </div>
                  </div>
                  <div className="col-sm-6 contact-info-section">
                    <div className="enterpriseInfoWrapper">
                      <h5 className="dark-text mb-4">Customer Details</h5>
                      {customers.length > 0 ? (
                        <table className="table product-details-table">
                          <thead>
                            <tr>
                              <th>S.No</th>
                              <th>Name of the Customer</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customers.map((customer, index) => (
                              <tr key={customer.id || index}>
                                <td>{index + 1}</td>
                                <td className="text-capitalize">{getCustomerName(customer)}</td>
                                <td>
                                  <Link
                                    to=""
                                    onClick={e => {
                                      e.preventDefault();
                                      handleViewCustomer(customer);
                                    }}>
                                    View
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-muted">No customers added</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Accordion.Body>
        </Accordion.Item>
        <div className="bottom-seperator p-0"></div>
        <Accordion.Item eventKey="3">
          <Accordion.Header>{isServices ? 'Key Services' : 'Key Manufacturing Processes'}</Accordion.Header>
          <Accordion.Body className="p-0">
            <div className="details-card pt-0">
              <div className="enterpriseInfoMainWrapper">
                <div className="row align-items-center">
                  <div className="col-md-12 align-items-cente">
                    <div className="cus-bx-1">
                      <span className="fs-12 fw-400 text-2-color">{isServices ? 'Key Service:' : 'Key Manufacturing Processes:'}</span>
                      {keyProcessesArray.length > 0 ? (
                        keyProcessesArray.map((process, idx) => (
                          <span key={idx} className="margin-left-8 cusTags">
                            {process}
                          </span>
                        ))
                      ) : (
                        <span className="margin-left-8 text-muted">Not specified</span>
                      )}
                    </div>
                    <div className="cus-bx-1">
                      <span className="fs-12 fw-400 text-2-color">{isServices ? 'Outsourced Services:' : 'Outsourced Processes:'}</span>
                      {outsourcedProcessesArray.length > 0 ? (
                        outsourcedProcessesArray.map((process, idx) => (
                          <span key={idx} className="margin-left-8 cusTags">
                            {process}
                          </span>
                        ))
                      ) : (
                        <span className="margin-left-8 text-muted">-</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Accordion.Body>
        </Accordion.Item>
        <div className="bottom-seperator p-0"></div>
        <Accordion.Item eventKey="4">
          <Accordion.Header>{isServices ? 'Key Service Resources / Outsourced Service Component' : 'Key Raw Materials / Bought-Out Parts'}</Accordion.Header>
          <Accordion.Body className="p-0">
            <div className="details-card pt-0 pb-0">
              <div className="enterpriseInfoMainWrapper">
                {isServices ? (
                  allServiceResources.length > 0 ? (
                    <table className="table product-details-table firstChildInherit">
                      <thead>
                        <tr>
                          <th>
                            Key Service Resources /<br /> Outsourced Service Components
                          </th>
                          <th>
                            Name of Resource /<br />
                            Name of Component
                          </th>
                          <th>From Overseas?</th>
                          <th>Source Country</th>
                          <th>Overseas Sourcing (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allServiceResources.map((resource, idx) => (
                          <tr key={idx}>
                            <td>{resource.resourceType}</td>
                            <td>{resource.resourceName || resource.resource_name || resource.componentName || resource.component_name || resource.name || '-'}</td>
                            <td>{resource.isImported || resource.is_imported ? 'Yes' : 'No'}</td>
                            <td>{resource.importCountry || resource.import_country || '-'}</td>
                            <td>{resource.importPercentage || resource.import_percentage ? `${resource.importPercentage || resource.import_percentage}%` : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-muted p-3">No key resources added</p>
                  )
                ) : allMaterials.length > 0 ? (
                  <table className="table product-details-table firstChildInherit">
                    <thead>
                      <tr>
                        <th>
                          Key Raw Materials /<br /> Bought-Out Parts
                        </th>
                        <th>
                          Name of Raw Material /<br />
                          Name of Bought-Out Part
                        </th>
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
                      {allMaterials.map((material, idx) => (
                        <tr key={material.id || idx}>
                          <td>{material.materialType}</td>
                          <td>{getMaterialName(material)}</td>
                          <td>{material.isImported || material.isImported ? 'Yes' : 'No'}</td>
                          <td>{material.importCountry || material.importCountry || '-'}</td>
                          <td>{material.importPercentage ? `${material.importPercentage}%` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-muted p-3">No materials added</p>
                )}
              </div>
            </div>
          </Accordion.Body>
        </Accordion.Item>
        <div className="bottom-seperator p-0"></div>
        <Accordion.Item eventKey="5">
          <Accordion.Header>Documents & Declarations</Accordion.Header>
          <Accordion.Body className="p-0">
            <div className="details-card pt-0">
              <div className="enterpriseInfoMainWrapper">
                <div className="row align-items-center">
                  <div className="col-md-12 align-items-cente">
                    <div className="cus-bx-1">
                      {certificationsArray.length > 0 && <img src={Icons.tickSuccess} alt="certifications" className="icon-16 margin-right-8" />}
                      <span className="fs-12 fw-400 text-2-color">Third Party Certifications:</span>
                      {certificationsArray.length > 0 ? (
                        certificationsArray.map((cert, idx) => (
                          <span key={idx} className="margin-left-8 cusTags">
                            {cert}
                          </span>
                        ))
                      ) : (
                        <span className="margin-left-8 text-muted">None</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>

      <ProductDetailModal open={productModalOpen} onClose={handleCloseProductModal} product={selectedProduct} />
      <ServiceDetailModal open={serviceModalOpen} onClose={handleCloseServiceModal} service={selectedService} />
      <CustomerDetailModal open={customerModalOpen} onClose={handleCloseCustomerModal} customer={selectedCustomer} />
    </>
  );
};

export default BasicInformation;
