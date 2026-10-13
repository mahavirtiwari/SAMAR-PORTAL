import { useState } from 'react';
import { OperationsManagerAssessmentParameter } from '../../../../../../../components/base';
import { AppOperationsManagerQuestionModal, CustomerDetailModal } from '../../../../../../../components/modals';
import KeyRawMaterialModal from '../../../../../../../components/modals/KeyRawMaterialModal';
import ProductDetailModal from '../../../../../../../components/modals/ProductDetailModal';
import BasicInformation from './assessmentSteps/BasicInformation';
import ClosingMeeting from './assessmentSteps/ClosingMeeting';
import OpeningMeeting from './assessmentSteps/OpeningMeeting';
import ParameterAllocation from './assessmentSteps/ParameterAllocation';
import SitePictures from './assessmentSteps/SitePictures';
import SiteTour from './assessmentSteps/SiteTour';

const sidebarSteps = [
  { number: 1, label: 'Parameter Allocation' },
  { number: 2, label: 'Site Pictures' },
  { number: 3, label: 'Opening Meeting' },
  { number: 4, label: 'Site Tour' },
  { number: 5, label: 'Basic Information' },
  { number: 6, label: 'Assessment Parameter' },
  { number: 7, label: 'Closing Meeting' },
];

const AssessmentTab = ({ assessment }) => {
  const [activeTab, setActiveTab] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [keyRawMaterialModalOpen, setKeyRawMaterialModalOpen] = useState(false);
  const [selectedKeyRawMaterial, setSelectedKeyRawMaterial] = useState(null);

  // State for AppSingleParameterQuestionsModal
  const [singleParameterModalOpen, setSingleParameterModalOpen] = useState(false);
  const [singleParameterModalData, setSingleParameterModalData] = useState(null);
  const [singleParameterModalQuestions, setSingleParameterModalQuestions] = useState([]);
  const [singleParameterInitialQuestionIndex, setSingleParameterInitialQuestionIndex] = useState(0);
  // Handler to open AppSingleParameterQuestionsModal
  const handleOpenSingleParameterModal = (parameterData, questions, index) => {
    // parameterData: parameter object
    // questions: array of questions for the parameter
    // index: index of the clicked question
    setSingleParameterModalData(parameterData);
    setSingleParameterModalQuestions(Array.isArray(questions) ? questions : parameterData?.questions || []);
    setSingleParameterInitialQuestionIndex(Number.isFinite(index) ? index : 0);
    setSingleParameterModalOpen(true);
  };

  const handleCloseSingleParameterModal = () => {
    setSingleParameterModalOpen(false);
    setSingleParameterModalData(null);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedProduct(null);
  };

  const handleCloseCustomerModal = () => {
    setCustomerModalOpen(false);
    setSelectedCustomer(null);
  };

  const handleCloseKeyRawMaterialModal = () => {
    setKeyRawMaterialModalOpen(false);
    setSelectedKeyRawMaterial(null);
  };

  const _handleEditComment = _comment => {
    // Add your edit comment logic here
    // Example: open an edit modal or navigate to edit page
    // setSelectedComment(_comment);
    // setEditCommentModalOpen(true);
  };

  return (
    <div className="details-card assessment-tab-main" style={{ borderRadius: '20px', paddingBottom: '25px' }}>
      <div className="row">
        {/* Bootstrap Vertical Tabs */}
        <div className="col-12 col-md-3 border-right assessment-tab-sidebar">
          <ul className="nav flex-column nav-pills py-3 assessment-tab" id="assessment-tab" role="tablist" aria-orientation="vertical">
            {sidebarSteps.map(step => (
              <li className="nav-item" key={step.number}>
                <a
                  className={`nav-link ${activeTab === step.number ? 'active' : ''}`}
                  id={`tab-step-${step.number}`}
                  href="#"
                  role="tab"
                  aria-selected={activeTab === step.number}
                  onClick={e => {
                    e.preventDefault();
                    setActiveTab(step.number);
                  }}>
                  <span className={`assessment-tab-number${activeTab === step.number ? ' active' : ''}`}>{step.number}</span>
                  {step.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        {/* Bootstrap Tab Content */}
        <div className="col-12 col-md-9">
          <div className="tab-content padding-left-10" id="assessment-tabContent">
            {/* Parameter Allocation */}
            <div className={`tab-pane fade${activeTab === 1 ? ' show active' : ''}`} id="tab-pane-1" role="tabpanel" aria-labelledby="tab-step-1">
              {activeTab === 1 && <ParameterAllocation showQuestionNumbers={true} />}
            </div>
            {/* Site Pictures */}
            <div className={`tab-pane fade${activeTab === 2 ? ' show active' : ''}`} id="tab-pane-2" role="tabpanel" aria-labelledby="tab-step-2">
              {activeTab === 2 && <SitePictures />}
            </div>

            {/* Opening Meeting */}
            <div className={`tab-pane fade${activeTab === 3 ? ' show active' : ''}`} id="tab-pane-3" role="tabpanel" aria-labelledby="tab-step-3">
              {activeTab === 3 && <OpeningMeeting />}
            </div>

            {/* Site Tour */}
            <div className={`tab-pane fade${activeTab === 4 ? ' show active' : ''}`} id="tab-pane-4" role="tabpanel" aria-labelledby="tab-step-4">
              {activeTab === 4 && <SiteTour />}
            </div>

            {/* Basic Information */}
            <div className={`tab-pane fade${activeTab === 5 ? ' show active' : ''}`} id="tab-pane-5" role="tabpanel" aria-labelledby="tab-step-5">
              {activeTab === 5 && (
                <BasicInformation
                  onViewProduct={product => {
                    setSelectedProduct(product);
                    setModalOpen(true);
                  }}
                  onViewCustomer={customer => {
                    setSelectedCustomer(customer);
                    setCustomerModalOpen(true);
                  }}
                  onViewKeyRawMaterial={keyRawMaterial => {
                    setSelectedKeyRawMaterial(keyRawMaterial);
                    setKeyRawMaterialModalOpen(true);
                  }}
                />
              )}
            </div>
            {/* Assessment Parameter */}
            <div className={`tab-pane fade${activeTab === 6 ? ' show active' : ''}`} id="tab-pane-6" role="tabpanel" aria-labelledby="tab-step-6">
              {activeTab === 6 && <OperationsManagerAssessmentParameter qualityCheck={true} onClick={handleOpenSingleParameterModal} />}
            </div>
            {/* Closing Meeting */}
            <div className={`tab-pane fade${activeTab === 7 ? ' show active' : ''}`} id="tab-pane-7" role="tabpanel" aria-labelledby="tab-step-7">
              {activeTab === 7 && <ClosingMeeting />}
            </div>
          </div>
        </div>
      </div>
      <ProductDetailModal open={modalOpen} onClose={handleCloseModal} product={selectedProduct} />
      <CustomerDetailModal open={customerModalOpen} onClose={handleCloseCustomerModal} customer={selectedCustomer} />
      <KeyRawMaterialModal open={keyRawMaterialModalOpen} onClose={handleCloseKeyRawMaterialModal} product={selectedKeyRawMaterial} />
      <AppOperationsManagerQuestionModal
        open={singleParameterModalOpen}
        onClose={handleCloseSingleParameterModal}
        parameterData={singleParameterModalData ? [singleParameterModalData] : []}
        questions={singleParameterModalQuestions || singleParameterModalData?.questions || []}
        assessmentId={assessment?.id || assessment?.assessment?.id || assessment?.data?.assessment?.id}
        initialQuestionIndex={singleParameterInitialQuestionIndex}
        Data={true}
      />
    </div>
  );
};

export default AssessmentTab;
