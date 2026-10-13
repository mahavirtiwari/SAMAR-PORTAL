import { useState } from 'react';
import { Accordion } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { CustomerDetailModal } from '../../../../../components/modals';
import KeyRawMaterialModal from '../../../../../components/modals/KeyRawMaterialModal';
import ProductDetailModal from '../../../../../components/modals/ProductDetailModal';
import Icons from '../../../../../constants/Icons';

const BasicInfoTab = ({ basicInformation, sector, loading }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [keyRawMaterialModalOpen, setKeyRawMaterialModalOpen] = useState(false);
  const [selectedKeyRawMaterial, setSelectedKeyRawMaterial] = useState(null);

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

  const _handleViewKeyRawMaterial = data => {
    setSelectedKeyRawMaterial(data);
    setKeyRawMaterialModalOpen(true);
  };

  const handleCloseKeyRawMaterialModal = () => {
    setKeyRawMaterialModalOpen(false);
    setSelectedKeyRawMaterial(null);
  };

  if (loading) {
    return <div className="details-card text-center p-4">Loading...</div>;
  }

  if (!basicInformation) {
    return <div className="details-card text-center p-4">No basic information available.</div>;
  }

  const isManufacturing = sector !== 'service';

  return (
    <>
      <Accordion defaultActiveKey={['0', '1', '2', '3', '4']} alwaysOpen>
        <Accordion.Item eventKey="0">
          <Accordion.Header>Category & {isManufacturing ? 'Stores' : 'Services'}</Accordion.Header>
          <Accordion.Body className="p-0">
            <div className="details-card">
              <div className="enterpriseInfoMainWrapper">
                <div className="row align-items-center">
                  <div className="col-md-12 align-items-cente">
                    <div className="cus-bx-1 ">
                      <span className="fs-12 fw-400 text-2-color">{isManufacturing ? 'Stores:' : 'Services:'}</span>
                      {(isManufacturing ? basicInformation.mfgDrdoVendorStores : basicInformation.svcDrdoVendorLabs || [])?.map((item, idx) => (
                        <span key={idx} className="margin-left-8 cusTags">
                          {typeof item === 'object' ? item.storeName || item.labName || item.name : item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Accordion.Body>
        </Accordion.Item>
        <Accordion.Item eventKey="1">
          <Accordion.Header>{isManufacturing ? 'Products' : 'Services'} & Customer Details</Accordion.Header>
          <Accordion.Body className="p-0">
            <div className="details-card">
              <div className="enterpriseInfoMainWrapper">
                <div className="row">
                  <div className="col-sm-6 support-form-section">
                    <div className="enterpriseInfoWrapper">
                      <h5 className="dark-text mb-4">{isManufacturing ? 'Product/Articles' : 'Services'}</h5>
                      <table className="table product-details-table">
                        <thead>
                          <tr>
                            <th>S.No</th>
                            <th>{isManufacturing ? 'Name of Product' : 'Name of Service'}</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(isManufacturing ? basicInformation.mfgProducts : basicInformation.svcServices || [])?.map((item, index) => (
                            <tr key={index}>
                              <td>{index + 1}</td>
                              <td className="text-capitalize">{item.productName || item.serviceName}</td>
                              <td>
                                <Link to={''} onClick={() => handleViewProduct(item)}>
                                  View
                                </Link>
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
                          {(basicInformation.customers || []).map((customer, index) => (
                            <tr key={index}>
                              <td>{index + 1}</td>
                              <td className="text-capitalize">{customer.customerName}</td>
                              <td>
                                <Link to={''} onClick={() => handleViewCustomer(customer)}>
                                  View
                                </Link>
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
        <Accordion.Item eventKey="2">
          <Accordion.Header>{isManufacturing ? 'Key Processes' : 'Key Services'}</Accordion.Header>
          <Accordion.Body className="p-0">
            <div className="details-card pt-0">
              <div className="enterpriseInfoMainWrapper">
                <div className="row align-items-center">
                  <div className="col-md-12 align-items-cente">
                    <div className="cus-bx-1 ">
                      <span className="fs-12 fw-400 text-2-color">{isManufacturing ? 'Key Processes:' : 'Key Services:'}</span>
                      {(isManufacturing ? basicInformation.mfgKeyProcesses : basicInformation.svcKeyProcesses || [])?.map((process, idx) => (
                        <span key={idx} className=" margin-left-8 cusTags">
                          {typeof process === 'object' ? process.processName || process.name : process}
                        </span>
                      ))}
                    </div>
                    <div className="cus-bx-1">
                      <span className="fs-12 fw-400 text-2-color">Outsourced Processes:</span>
                      {(isManufacturing ? basicInformation.mfgOutsourcedProcesses : basicInformation.svcOutsourcedProcesses || [])?.map((process, idx) => (
                        <span key={idx} className="margin-left-8 cusTags">
                          {typeof process === 'object' ? process.processName || process.name : process}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Accordion.Body>
        </Accordion.Item>
        {isManufacturing && (
          <Accordion.Item eventKey="3">
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
                      {[
                        ...(basicInformation.mfgRawMaterials || []).map(m => ({ ...m, materialType: 'Key Raw Material' })),
                        ...(basicInformation.mfgBoughtOutParts || []).map(m => ({ ...m, materialType: 'Bought-Out Part' })),
                      ].map((rawMaterial, idx) => (
                        <tr key={idx}>
                          <td>{rawMaterial.materialType}</td>
                          <td>{rawMaterial.materialName}</td>
                          <td>{rawMaterial.isImported ? 'Yes' : 'No'}</td>
                          <td>{rawMaterial.importCountry || '--'}</td>
                          <td>{rawMaterial.importPercentage ? `${rawMaterial.importPercentage}%` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Accordion.Body>
          </Accordion.Item>
        )}
        <Accordion.Item eventKey="4">
          <Accordion.Header>Documents & Declarations</Accordion.Header>
          <Accordion.Body className="p-0">
            <div className="details-card pt-0">
              <div className="enterpriseInfoMainWrapper">
                <div className="row align-items-center">
                  <div className="col-md-12 align-items-cente">
                    <div className="cus-bx-1 ">
                      <img src={Icons.tickSuccess} alt="key-process" className="icon-16 margin-right-8" />
                      <span className="fs-12 fw-400 text-2-color">Third Party Certifications:</span>
                      {(basicInformation.thirdPartyCertificationNames || []).map((certification, idx) => (
                        <span key={idx} className="margin-left-8 cusTags">
                          {certification}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>
      <ProductDetailModal open={modalOpen} onClose={handleCloseModal} product={selectedProduct} />
      <CustomerDetailModal open={customerModalOpen} onClose={handleCloseCustomerModal} customer={selectedCustomer} />
      <KeyRawMaterialModal open={keyRawMaterialModalOpen} onClose={handleCloseKeyRawMaterialModal} product={selectedKeyRawMaterial} />
    </>
  );
};

export default BasicInfoTab;
