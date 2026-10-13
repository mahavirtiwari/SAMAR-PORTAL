import { useState } from 'react';
import { AppButton, AppDropdown, AppInput } from '../../../../components/base';
import { Layout } from '../../../../components/layout';

const OrganisationProfile = () => {
  // Organization Details States
  const [organizationName, setOrganizationName] = useState('');
  const [sector, setSector] = useState('');
  const [enterpriseClassification, setEnterpriseClassification] = useState('');
  const [organizationPanNumber, setOrganizationPanNumber] = useState('');

  // Registered Office Address States
  const [registeredAddress, setRegisteredAddress] = useState('');
  const [registeredPinCode, setRegisteredPinCode] = useState('');
  const [registeredDistrict, setRegisteredDistrict] = useState('');
  const [registeredState, setRegisteredState] = useState('');
  const [registeredMobileNumber, setRegisteredMobileNumber] = useState('');
  const [registeredLandlineNumber, setRegisteredLandlineNumber] = useState('');
  const [registeredEmailId, setRegisteredEmailId] = useState('');
  const [registeredAlternateEmailId, setRegisteredAlternateEmailId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // Owner/Authorized Person Details States
  const [ownerName, setOwnerName] = useState('');
  const [ownerDesignation, setOwnerDesignation] = useState('');
  const [ownerMobileNumber, setOwnerMobileNumber] = useState('');
  const [ownerEmailId, setOwnerEmailId] = useState('');

  // Dropdown Options with Dummy Data
  const [stateOptions] = useState([
    { value: 'andhra_pradesh', label: 'Andhra Pradesh' },
    { value: 'arunachal_pradesh', label: 'Arunachal Pradesh' },
    { value: 'assam', label: 'Assam' },
    { value: 'bihar', label: 'Bihar' },
    { value: 'chhattisgarh', label: 'Chhattisgarh' },
    { value: 'goa', label: 'Goa' },
    { value: 'gujarat', label: 'Gujarat' },
    { value: 'haryana', label: 'Haryana' },
    { value: 'himachal_pradesh', label: 'Himachal Pradesh' },
    { value: 'jharkhand', label: 'Jharkhand' },
    { value: 'karnataka', label: 'Karnataka' },
    { value: 'kerala', label: 'Kerala' },
    { value: 'madhya_pradesh', label: 'Madhya Pradesh' },
    { value: 'maharashtra', label: 'Maharashtra' },
    { value: 'manipur', label: 'Manipur' },
    { value: 'meghalaya', label: 'Meghalaya' },
    { value: 'mizoram', label: 'Mizoram' },
    { value: 'nagaland', label: 'Nagaland' },
    { value: 'odisha', label: 'Odisha' },
    { value: 'punjab', label: 'Punjab' },
    { value: 'rajasthan', label: 'Rajasthan' },
    { value: 'sikkim', label: 'Sikkim' },
    { value: 'tamil_nadu', label: 'Tamil Nadu' },
    { value: 'telangana', label: 'Telangana' },
    { value: 'tripura', label: 'Tripura' },
    { value: 'uttar_pradesh', label: 'Uttar Pradesh' },
    { value: 'uttarakhand', label: 'Uttarakhand' },
    { value: 'west_bengal', label: 'West Bengal' },
    { value: 'delhi', label: 'Delhi' },
    { value: 'jammu_kashmir', label: 'Jammu & Kashmir' },
    { value: 'ladakh', label: 'Ladakh' },
    { value: 'puducherry', label: 'Puducherry' },
    { value: 'chandigarh', label: 'Chandigarh' },
    { value: 'dadra_nagar_haveli', label: 'Dadra and Nagar Haveli' },
    { value: 'daman_diu', label: 'Daman and Diu' },
    { value: 'lakshadweep', label: 'Lakshadweep' },
    { value: 'andaman_nicobar', label: 'Andaman and Nicobar Islands' },
  ]);

  const [districtOptions] = useState([
    { value: 'mumbai', label: 'Mumbai' },
    { value: 'pune', label: 'Pune' },
    { value: 'nashik', label: 'Nashik' },
    { value: 'nagpur', label: 'Nagpur' },
    { value: 'aurangabad', label: 'Aurangabad' },
    { value: 'solapur', label: 'Solapur' },
    { value: 'kolhapur', label: 'Kolhapur' },
    { value: 'sangli', label: 'Sangli' },
    { value: 'satara', label: 'Satara' },
    { value: 'ahmednagar', label: 'Ahmednagar' },
    { value: 'thane', label: 'Thane' },
    { value: 'raigad', label: 'Raigad' },
    { value: 'ratnagiri', label: 'Ratnagiri' },
    { value: 'sindhudurg', label: 'Sindhudurg' },
    { value: 'dhule', label: 'Dhule' },
    { value: 'jalgaon', label: 'Jalgaon' },
    { value: 'nandurbar', label: 'Nandurbar' },
    { value: 'akola', label: 'Akola' },
    { value: 'amravati', label: 'Amravati' },
    { value: 'bhandara', label: 'Bhandara' },
    { value: 'buldhana', label: 'Buldhana' },
    { value: 'chandrapur', label: 'Chandrapur' },
    { value: 'gadchiroli', label: 'Gadchiroli' },
    { value: 'gondia', label: 'Gondia' },
    { value: 'wardha', label: 'Wardha' },
    { value: 'washim', label: 'Washim' },
    { value: 'yavatmal', label: 'Yavatmal' },
    { value: 'beed', label: 'Beed' },
    { value: 'hingoli', label: 'Hingoli' },
    { value: 'jalna', label: 'Jalna' },
    { value: 'latur', label: 'Latur' },
    { value: 'nanded', label: 'Nanded' },
    { value: 'osmanabad', label: 'Osmanabad' },
    { value: 'parbhani', label: 'Parbhani' },
  ]);

  const [enterpriseClassificationOptions] = useState([
    { value: 'micro', label: 'Micro Enterprise' },
    { value: 'small', label: 'Small Enterprise' },
    { value: 'medium', label: 'Medium Enterprise' },
    { value: 'large', label: 'Large Enterprise' },
  ]);

  const [sectorOptions] = useState([
    { value: 'manufacturing', label: 'Manufacturing' },
    { value: 'services', label: 'Services' },
    { value: 'trading', label: 'Trading' },
    { value: 'agriculture', label: 'Agriculture' },
    { value: 'it_software', label: 'IT & Software' },
    { value: 'healthcare', label: 'Healthcare' },
    { value: 'education', label: 'Education' },
    { value: 'construction', label: 'Construction' },
    { value: 'textiles', label: 'Textiles' },
    { value: 'automotive', label: 'Automotive' },
    { value: 'chemicals', label: 'Chemicals' },
    { value: 'pharmaceuticals', label: 'Pharmaceuticals' },
    { value: 'food_processing', label: 'Food Processing' },
    { value: 'engineering', label: 'Engineering' },
    { value: 'electronics', label: 'Electronics' },
    { value: 'renewable_energy', label: 'Renewable Energy' },
    { value: 'logistics', label: 'Logistics & Transportation' },
    { value: 'hospitality', label: 'Hospitality & Tourism' },
    { value: 'real_estate', label: 'Real Estate' },
    { value: 'financial_services', label: 'Financial Services' },
  ]);

  // Form validation and submission handlers
  const handleSaveAndNext = () => {
    // Collect all form data
    const _formData = {
      organizationDetails: {
        organizationName,
        sector,
        enterpriseClassification,
        organizationPanNumber,
      },
      registeredOfficeAddress: {
        registeredAddress,
        registeredPinCode,
        registeredDistrict,
        registeredState,
        registeredMobileNumber,
        registeredLandlineNumber,
        registeredEmailId,
        registeredAlternateEmailId,
      },
      ownerAuthorizedPersonDetails: {
        ownerName,
        ownerDesignation,
        ownerMobileNumber,
        ownerEmailId,
      },
    };
  };

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="table-container">
            <div className="profile-header-section">
              <h1 className="fs-20 fw-600 heading-color mb-0">Enterprise Admin</h1>
            </div>
            <div className="main-content-section">
              <div className="margin-bottom-30 bottom-seperator">
                <h5 className="section-title margin-bottom-24">General Information</h5>

                <div className="row gap-vertical-30">
                  <div className="col-md-6">
                    <AppInput label="First Name" alphaOnly={true} placeholder="Enter First Name" value={firstName} onChange={e => setFirstName(e.target.value)} isRequired={true} />
                  </div>
                  <div className="col-md-6">
                    <AppInput label="Last Name" alphaOnly={true} placeholder="Enter Last Name" value={lastName} onChange={e => setLastName(e.target.value)} isRequired={true} />
                  </div>
                  <div className="col-md-12">
                    <AppInput label="Enterprise Name" placeholder="Enter Enterprise Name" value={organizationName} onChange={e => setOrganizationName(e.target.value)} isRequired={true} />
                  </div>
                  <div className="col-md-4">
                    <AppDropdown label="Sector" placeholder="Select Sector" value={sector} onChange={e => setSector(e.target.value)} options={sectorOptions} isRequired={true} />
                  </div>
                  <div className="col-md-4">
                    <AppDropdown
                      label="Enterprise Classification"
                      placeholder="Select Enterprise Classification"
                      value={enterpriseClassification}
                      onChange={e => setEnterpriseClassification(e.target.value)}
                      options={enterpriseClassificationOptions}
                      isRequired={true}
                    />
                  </div>
                  <div className="col-md-4">
                    <AppInput
                      label="Enterprise PAN"
                      placeholder="e.g. AAAAA0000A"
                      value={organizationPanNumber}
                      upperCase={true}
                      stripWhitespace={true}
                      onChange={e => setOrganizationPanNumber(e.target.value)}
                      isRequired={true}
                    />
                  </div>
                </div>
              </div>
              <div className="form-section bottom-seperator">
                <h5 className="section-title margin-bottom-24">Registered Office Address</h5>

                <div className="row gap-vertical-30">
                  <div className="col-md-12">
                    <AppInput label="Address" placeholder="Enter Address" value={registeredAddress} onChange={e => setRegisteredAddress(e.target.value)} isRequired={true} />
                  </div>
                  <div className="col-md-4">
                    <AppInput label="PIN Code" placeholder="Enter PIN code" value={registeredPinCode} onChange={e => setRegisteredPinCode(e.target.value)} isRequired={true} />
                  </div>
                  <div className="col-md-4">
                    <AppDropdown
                      label="District"
                      placeholder="Select District"
                      value={registeredDistrict}
                      onChange={e => setRegisteredDistrict(e.target.value)}
                      options={districtOptions}
                      isRequired={true}
                    />
                  </div>
                  <div className="col-md-4">
                    <AppDropdown label="State" placeholder="Select State" value={registeredState} onChange={e => setRegisteredState(e.target.value)} options={stateOptions} isRequired={true} />
                  </div>
                  <div className="col-md-6">
                    <AppInput label="Mobile Number" placeholder="Enter Mobile Number" value={registeredMobileNumber} onChange={e => setRegisteredMobileNumber(e.target.value)} isRequired={true} />
                  </div>
                  <div className="col-md-6">
                    <AppInput
                      label="Landline Number"
                      placeholder="Enter Landline Number"
                      value={registeredLandlineNumber}
                      onChange={e => setRegisteredLandlineNumber(e.target.value)}
                      isRequired={true}
                    />
                  </div>
                  <div className="col-md-6">
                    <AppInput label="Email" placeholder="Enter Email" value={registeredEmailId} onChange={e => setRegisteredEmailId(e.target.value)} isRequired={true} />
                  </div>
                  <div className="col-md-6">
                    <AppInput
                      label="Alternate Email"
                      placeholder="Enter Alternate Email"
                      value={registeredAlternateEmailId}
                      onChange={e => setRegisteredAlternateEmailId(e.target.value)}
                      isRequired={true}
                    />
                  </div>
                </div>
              </div>
              <div className="form-section">
                <h5 className="section-title margin-bottom-24">Owner/Authorised Person Details</h5>

                <div className="row gap-vertical-30">
                  <div className="col-md-6">
                    <AppInput label="Name" placeholder="Enter Name" value={ownerName} onChange={e => setOwnerName(e.target.value)} isRequired={true} />
                  </div>
                  <div className="col-md-6">
                    <AppInput label="Designation" placeholder="Enter Designation" value={ownerDesignation} onChange={e => setOwnerDesignation(e.target.value)} isRequired={true} />
                  </div>
                  <div className="col-md-6">
                    <AppInput label="Mobile Number" placeholder="Enter Mobile Number" value={ownerMobileNumber} onChange={e => setOwnerMobileNumber(e.target.value)} isRequired={true} />
                  </div>
                  <div className="col-md-6">
                    <AppInput label="Email" placeholder="Enter Email" value={ownerEmailId} onChange={e => setOwnerEmailId(e.target.value)} isRequired={true} />
                  </div>
                </div>
              </div>

              <div className="gap-8 d-flex margin-top-24">
                <AppButton title="Save" onClick={handleSaveAndNext}></AppButton>
                <AppButton variant="tertiary" title="Cancel"></AppButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default OrganisationProfile;
