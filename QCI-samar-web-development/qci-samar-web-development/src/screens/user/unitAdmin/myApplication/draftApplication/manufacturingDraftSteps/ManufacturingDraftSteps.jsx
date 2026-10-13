import dayjs from 'dayjs';
import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../../../../../../components/layout';
import { getApplicationDetailsAction } from '../../../../../../redux/action/unitAdmin/application/ApplicationAction';
import ManufacturingSteps from '../../createApplication/manufacturingSteps/ManufacturingSteps';

/**
 * ManufacturingDraftSteps - Wrapper component for resuming manufacturing application drafts
 *
 * This component handles two cases:
 * 1. Resume existing draft: /draft-application/manufacturing-steps/:id
 *    - Fetches application details using the ID from URL params
 *    - Transforms API response into formik-compatible initial values
 * 2. Continue from DraftApplication: /draft-application/manufacturing-steps
 *    - Uses formValues passed via navigation state
 *
 * Route: /draft-application/manufacturing-steps/:id or /draft-application/manufacturing-steps
 */
const ManufacturingDraftSteps = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();

  // Check if formValues were passed via navigation state (from DraftApplication)
  const navigationFormValues = location.state?.formValues;

  const { applicationDetails, applicationDetailsError } = useSelector(state => state.UnitAdminApplication);

  // Fetch application details on mount only if we have an ID and no navigation state
  useEffect(() => {
    if (id && !navigationFormValues) {
      dispatch(getApplicationDetailsAction(id));
    }
  }, [id, navigationFormValues, dispatch]);

  // Transform applicationDetails into formValues for ManufacturingSteps
  // Note: API returns camelCase on wire
  const formValues = useMemo(() => {
    if (!applicationDetails) {
      return null;
    }

    // Normalize unitCommencementDate to Y-m-d format
    const normalizedUnitCommencementDate = applicationDetails.unitCommencementDate ? dayjs(applicationDetails.unitCommencementDate).format('YYYY-MM-DD') : '';

    // API returns separate mfgRawMaterials and mfgBoughtOutParts arrays (camelCase)
    // Frontend uses a combined mfgRawMaterials array with materialType to distinguish
    const apiRawMaterials = applicationDetails.mfgRawMaterials || [];
    const apiBoughtOutParts = applicationDetails.mfgBoughtOutParts || [];

    // Transform API mfgRawMaterials to frontend format
    const transformedRawMaterials = apiRawMaterials.map(m => ({
      materialName: m.materialName || '',
      boughtOutPartName: '',
      materialType: 'rawMaterial',
      isImported: m.isImported ?? '',
      importCountry: m.importCountry || '',
      importPercentage: m.importPercentage || '',
    }));

    // Transform API boughtOutParts to frontend format
    const transformedBoughtOutParts = apiBoughtOutParts.map(p => ({
      materialName: '',
      boughtOutPartName: p.partName || '',
      partName: p.partName || '',
      materialType: 'boughtOutPart',
      isImported: p.isImported ?? '',
      importCountry: p.importCountry || '',
      importPercentage: p.importPercentage || '',
    }));

    // Keep raw materials and bought-out parts separate for the frontend form

    return {
      // Pre-step values
      applicationType: applicationDetails.applicationType || 'new',
      unitId: applicationDetails.unit?.id || '',
      isExistingDrdoVendor: applicationDetails.isExistingDrdoVendor ?? false,
      vendorCategory: applicationDetails.vendorCategoryName || '',
      mfgDrdoVendorStores: applicationDetails.mfgDrdoVendorStores?.length > 0 ? applicationDetails.mfgDrdoVendorStores.map(s => (typeof s === 'string' ? { storeName: s } : s)) : [],
      drdoRegistrationNumber: applicationDetails.drdoRegistrationNumber || '',
      drdoCertificateFile: applicationDetails.drdoCertificateFileUrl || null,
      enterpriseClassification: applicationDetails.enterpriseClassification || 'micro',
      dpiitRegistrationNumber: applicationDetails.dpiitRegistrationNumber || '',
      dpiitCertificateFile: applicationDetails.dpiitCertificateFileUrl || null,
      udyamRegistrationNumber: applicationDetails.udyamRegistrationNumber || '',
      udyamCertificateFile: applicationDetails.udyamCertificateFileUrl || null,
      cin: applicationDetails.cin || '',

      incorporationCertificateFile: applicationDetails.incorporationCertificateFileUrl || null,

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
      unitState: applicationDetails.unitState || '',
      unitDistrict: applicationDetails.unitDistrict || '',
      unitPincode: applicationDetails.unitPincode || '',
      unitMobile: applicationDetails.unitMobile || '',
      unitLandline: applicationDetails.unitLandline || '',
      unitName: applicationDetails.unitName || '',
      unitEmail: applicationDetails.unitEmail || '',
      unitAlternateEmail: applicationDetails.unitAlternateEmail || '',
      unitCommencementDate: normalizedUnitCommencementDate,
      siteExteriorPhoto: applicationDetails.siteExteriorPhotoUrl || null,
      isSameAsRegistered: applicationDetails.isSameAsRegistered ?? false,
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

      // Step 2: Products & Materials
      mfgProducts:
        applicationDetails.mfgProducts?.length > 0
          ? applicationDetails.mfgProducts.map((p, idx) => ({
              id: p.id || idx + 1,
              productName: p.productName || '',
              totalProductionCapacity: p.totalProductionCapacity ? String(p.totalProductionCapacity) : '',
              capacityUnit: p.capacityUnit || '',
              currentUtilizedCapacity: p.currentUtilizedCapacity ? String(p.currentUtilizedCapacity) : '',
              commencementDate: p.commencementDate || '',
              isExported: p.isExported ?? null,
              exportCountries: p.exportCountries || [],
              exportPercentage: p.exportPercentage ? String(p.exportPercentage) : '',
            }))
          : [
              {
                id: 1,
                productName: '',
                totalProductionCapacity: '',
                capacityUnit: '',
                currentUtilizedCapacity: '',
                commencementDate: '',
                isExported: null,
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

      mfgRawMaterials:
        transformedRawMaterials.length > 0
          ? transformedRawMaterials
          : [
              {
                materialName: '',
                isImported: '',
                importCountry: '',
                importPercentage: '',
              },
            ],
      mfgBoughtOutParts:
        transformedBoughtOutParts.length > 0
          ? transformedBoughtOutParts
          : [
              {
                partName: '',
                isImported: '',
                importCountry: '',
                importPercentage: '',
              },
            ],

      mfgKeyProcesses: applicationDetails.mfgKeyProcesses?.length > 0 ? applicationDetails.mfgKeyProcesses : [],
      mfgOutsourcedProcesses: applicationDetails.mfgOutsourcedProcesses?.length > 0 ? applicationDetails.mfgOutsourcedProcesses : [],

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
    return <ManufacturingSteps initialDraftValues={navigationFormValues} />;
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

  // Render ManufacturingSteps with pre-populated values from applicationDetails
  return <ManufacturingSteps key={id} initialDraftValues={formValues} draftApplicationId={id} />;
};

export default ManufacturingDraftSteps;
