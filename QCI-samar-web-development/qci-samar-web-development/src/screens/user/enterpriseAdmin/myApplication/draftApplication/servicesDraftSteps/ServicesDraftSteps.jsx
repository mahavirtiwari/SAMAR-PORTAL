import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../../../../../../components/layout';
import { getApplicationDetailsAction } from '../../../../../../redux/action/enterpriseAdmin/application/ApplicationAction';
import ServicesSteps from '../../createApplication/servicesSteps/ServicesSteps';

const ServicesDraftSteps = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();

  // Check if formValues were passed via navigation state (from DraftApplication)
  const navigationFormValues = location.state?.formValues;

  const { applicationDetails, applicationDetailsError } = useSelector(state => state.EnterpriseAdminApplication);

  // Fetch application details on mount only if we have an ID and no navigation state
  useEffect(() => {
    if (id && !navigationFormValues) {
      dispatch(getApplicationDetailsAction(id));
    }
  }, [id, navigationFormValues, dispatch]);

  // Transform applicationDetails into formValues for ServicesSteps
  // Note: API returns camelCase on wire
  const formValues = useMemo(() => {
    if (!applicationDetails) {
      return null;
    }
    return {
      // Pre-step values
      applicationType: applicationDetails.applicationType || 'new',
      unitId: applicationDetails.unit?.id || '',
      svcProviderType: applicationDetails.svcProviderType || '',
      isExistingDrdoVendor: applicationDetails.isExistingDrdoVendor ?? false,
      vendorCategory: applicationDetails.vendorCategoryName || '',
      svcDrdoVendorLabs: applicationDetails.svcDrdoVendorLabs || [],
      drdoRegistrationNumber: applicationDetails.drdoRegistrationNumber || '',
      drdoCertificateFile: applicationDetails.drdoCertificateFileUrl || null,
      enterpriseClassification: applicationDetails.enterpriseClassification || 'micro',
      dpiitRegistrationNumber: applicationDetails.dpiitRegistrationNumber || '',
      dpiitCertificateFile: applicationDetails.dpiitCertificateFileUrl || null,
      udyamRegistrationNumber: applicationDetails.udyamRegistrationNumber || '',
      udyamCertificateFile: applicationDetails.udyamCertificateFileUrl || null,
      incorporationCertificateFile: applicationDetails.incorporationCertificateFileUrl || null,
      cin: applicationDetails.cin || '',
      // Step 0: Enterprise Info
      enterpriseName: applicationDetails.enterpriseName || '',
      registeredOfficeAddress: applicationDetails.registeredOfficeAddress || '',
      registeredOfficeState: applicationDetails.registeredOfficeState || '',
      registeredOfficeDistrict: applicationDetails.registeredOfficeDistrict || '',
      registeredOfficePincode: applicationDetails.registeredOfficePincode || '',
      registeredOfficeMobile: applicationDetails.registeredOfficeMobile || '',
      registeredOfficeLandline: applicationDetails.registeredOfficeLandline || '',
      registeredOfficeEmail: applicationDetails.registeredOfficeEmail || '',
      registeredOfficeAlternateEmail: applicationDetails.registeredOfficeAlternateEmail || '',
      unitAddress: applicationDetails.unitAddress || '',
      unitName: applicationDetails.unitName || '',
      unitState: applicationDetails.unitState || '',
      unitDistrict: applicationDetails.unitDistrict || '',
      unitPincode: applicationDetails.unitPincode || '',
      unitMobile: applicationDetails.unitMobile || '',
      unitLandline: applicationDetails.unitLandline || '',
      unitEmail: applicationDetails.unitEmail || '',
      unitAlternateEmail: applicationDetails.unitAlternateEmail || '',
      unitCommencementDate: applicationDetails.unitCommencementDate || '',
      siteExteriorPhoto: applicationDetails.siteExteriorPhotoUrl || null,
      contactPersonName: applicationDetails.contactPersonName || '',
      contactPersonDesignation: applicationDetails.contactPersonDesignation || '',
      contactPersonMobile: applicationDetails.contactPersonMobile || '',
      contactPersonEmail: applicationDetails.contactPersonEmail || '',

      // Step 1: Operations
      ownershipType: applicationDetails.ownershipType || '',
      totalEmployees: applicationDetails.totalEmployees ? String(applicationDetails.totalEmployees) : '',
      maleEmployeesCount: applicationDetails.maleEmployeesCount != null ? String(applicationDetails.maleEmployeesCount) : '',
      femaleEmployeesCount: applicationDetails.femaleEmployeesCount != null ? String(applicationDetails.femaleEmployeesCount) : '',
      otherEmployeesCount: applicationDetails.otherEmployeesCount != null ? String(applicationDetails.otherEmployeesCount) : '',
      // Tri-state booleans — pass through untouched so null ("not answered") stays distinct from false.
      hasGst: applicationDetails.hasGst,
      gstNumber: applicationDetails.gstNumber || '',
      gstCertificateFile: applicationDetails.gstCertificateFileUrl || null,
      hasGovtRegistration: applicationDetails.hasGovtRegistration,
      govtOrganisationName: applicationDetails.govtOrganisationName || '',
      govtRegistrationCertificate: applicationDetails.govtRegistrationCertificateUrl || null,

      // Step 2: Services -> map to svc* keys used by ServicesSteps
      svcServices:
        applicationDetails.svcServices?.length > 0
          ? applicationDetails.svcServices.map((s, idx) => ({
              id: s.id || idx + 1,
              serviceName: s.serviceName || '',
              totalServicesCapacity: s.totalServicesCapacity ? String(s.totalServicesCapacity) : '',
              capacityUnit: s.capacityUnit || '',
              currentUtilizedCapacity: s.currentUtilizedCapacity ? String(s.currentUtilizedCapacity) : '',
              commencementDate: s.commencementDate || '',
              isExported: s.isExported ?? false,
              exportCountries: s.exportCountries || [],
              exportPercentage: s.exportPercentage ? String(s.exportPercentage) : '',
            }))
          : [
              {
                id: 1,
                serviceName: '',
                totalServicesCapacity: '',
                capacityUnit: '',
                currentUtilizedCapacity: '',
                commencementDate: '',
                isExported: '',
                exportCountries: [],
                exportPercentage: '',
              },
            ],

      customers:
        applicationDetails.customers?.length > 0
          ? applicationDetails.customers.map((c, idx) => ({
              id: c.id || idx + 1,
              customerName: c.customerName || '',
              customerType: c.customerType || '',
              country: c.country || '',
            }))
          : [{ id: 1, customerName: '', customerType: '', country: '' }],

      svcKeyProcesses:
        applicationDetails.svcKeyProcesses?.length > 0
          ? applicationDetails.svcKeyProcesses.map(p => (typeof p === 'string' ? { processName: p } : p))
          : applicationDetails.processes?.length > 0
            ? applicationDetails.processes.map(p => (typeof p === 'string' ? { processName: p } : p))
            : [],

      svcOutsourcedProcesses: applicationDetails.svcOutsourcedProcesses?.length > 0 ? applicationDetails.svcOutsourcedProcesses.map(p => (typeof p === 'string' ? { processName: p } : p)) : [],

      svcKeyResources:
        applicationDetails.svcKeyResources?.length > 0
          ? applicationDetails.svcKeyResources.map((r, idx) => ({
              id: r.id || idx + 1,
              resourceType: r.resourceType || 'serviceResource',
              resourceName: r.resourceName || '',
              // Provide `resource` alias so the create form (which may read `resource` or `resourceName`)
              // finds a pre-populated value when resuming drafts.
              resource: r.resourceName || r.resource || '',
              isImported: r.isImported,
              importCountry: r.importCountry || '',
              importPercentage: r.importPercentage ? String(r.importPercentage) : '',
            }))
          : [{ id: 1, resourceType: 'serviceResource', resourceName: '', isImported: '', importCountry: '', importPercentage: '' }],

      svcOutsourcedComponents:
        applicationDetails.svcOutsourcedComponents?.length > 0
          ? applicationDetails.svcOutsourcedComponents.map((c, idx) => ({
              id: c.id || idx + 1,
              componentName: c.componentName || '',
              // Provide `component` alias for consistency with any form fields that may expect it
              component: c.componentName || c.component || '',
              isImported: c.isImported,
              importCountry: c.importCountry || '',
              importPercentage: c.importPercentage ? String(c.importPercentage) : '',
            }))
          : [],

      // Step 3: Compliance
      thirdPartyCertifications: (applicationDetails.thirdPartyCertificationNames || applicationDetails.thirdPartyCertifications || [])
        .map(cert => (typeof cert === 'string' ? cert : cert?.certificationName || cert?.name || ''))
        .filter(Boolean),
      isBlacklisted: applicationDetails.isBlacklisted ?? '',
      blacklistedOrganizations: applicationDetails.blacklistedOrganizations || '',
      hasOngoingEnquiry: applicationDetails.hasOngoingEnquiry ?? '',
      informationTrueAgreement: applicationDetails.informationTrueAgreement ?? '',
      applicationAcceptanceAgreement: applicationDetails.applicationAcceptanceAgreement ?? '',
    };
  }, [applicationDetails]);

  // If we have navigation formValues (from DraftApplication), use them directly
  if (navigationFormValues) {
    return <ServicesSteps initialDraftValues={navigationFormValues} />;
  }

  // Show error state
  if (applicationDetailsError) {
    return (
      <Layout>
        <div className="main-content-inner">
          <div className="container">
            <div className="alert alert-danger mt-4" role="alert">
              Failed to load application details. Please try again.
              <button className="btn btn-link" onClick={() => navigate(-1)}>
                Go Back
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Wait until formValues are ready (for resume from existing draft)
  if (!formValues) {
    return (
      <Layout>
        <div className="main-content-inner">
          <div className="container">
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Render ServicesSteps with pre-populated values from applicationDetails
  return <ServicesSteps key={id} initialDraftValues={formValues} draftApplicationId={id} />;
};

export default ServicesDraftSteps;
