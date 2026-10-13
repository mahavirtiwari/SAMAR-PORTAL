import { Box, FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import dayjs from 'dayjs';
import { FieldArray, FormikProvider, useFormik } from 'formik';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Accordion } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as Yup from 'yup';
import { AppButton, AppDatePicker, AppDropdown, AppFileUpload, AppInput, AppInputWithDropdown, AppMultiSelectDropdown, AppSuggestionInput, RenewalTag } from '../../../../../../components/base';
import { toastError } from '../../../../../../components/base/toast';
import { Layout } from '../../../../../../components/layout';
import { ApplicationLabsModal, AppModal } from '../../../../../../components/modals';
import CustomerDetailModal from '../../../../../../components/modals/CustomerDetailModal';
import ImagePreviewModal from '../../../../../../components/modals/ImagePreviewModal';
import ServiceDetailModal from '../../../../../../components/modals/ServiceDetailModal';
import { ownershipTypeOptions } from '../../../../../../constants/filterData';
import Icons from '../../../../../../constants/Icons';
import { usePincodeAutofill } from '../../../../../../hooks';
import useGeolocation from '../../../../../../hooks/useGeolocation';
import { getDrdoApprovalSettingByKeyAction } from '../../../../../../redux/action/common/SystemSettingAction';
import {
  getStateAction,
  listCountriesAction,
  listKeyProcessesAction,
  listKeyProcessV1Action,
  listKeyResourcesAction,
  listOutsourcedComponentsAction,
  listThirdPartyCertsAction,
  listVendorCategoriesV1Action,
  listVendorLabsAction,
  pinCodeAction,
} from '../../../../../../redux/action/master/MasterAction';
import { getAllOrganizationsAction } from '../../../../../../redux/action/organizations/OrganizationAction';
import {
  autosaveServiceApplicationAction,
  createServiceApplicationAction,
  getApplicationAction,
  submitServiceApplicationAction,
  validateGstinAction,
} from '../../../../../../redux/action/unitAdmin/application/ApplicationAction';
import { resetCreateServiceApplication, resetSubmitServiceApplication } from '../../../../../../redux/slices/unitAdmin/application/ApplicationSlice';
import SystemStatusService from '../../../../../../services/api/utils/SystemStatusService';
import { downloadFile } from '../../../../../../utils/FileUtils';
import { formatDate, formatDisplayValue, formatFullAddress, formatNumber, formatNumberInput, parseNumericOrNull } from '../../../../../../utils/formatters';
import { applyImageWatermark } from '../../../../../../utils/imageWatermark';
import { Logger } from '../../../../../../utils/logger';
import { cinNumberRegex, dpiitNumberRegex, emailRegex, gstNumberRegex, udyamNumberRegex } from '../../../../../../utils/Regex';
import { humanizeApplicationInProgressError } from '../../../../../../utils/serverErrorUtils';

const ApplicationSchema = Yup.object().shape({
  isExistingDrdoVendor: Yup.string().required('Please select DRDO vendor status'),
  svcProviderType: Yup.string().required('Please select the type of service provider'),
  vendorCategory: Yup.string().required('Please select a vendor category'),
  cin: Yup.string().when('enterpriseClassification', {
    is: 'large',
    then: schema => schema.required('Please enter the CIN number').max(21, 'CIN number cannot exceed 21 characters').matches(cinNumberRegex, 'CIN number must be valid (e.g., L01631KA2010PTC096843)'),
    otherwise: schema => schema.notRequired(),
  }),
  svcDrdoVendorLabs: Yup.array()
    .of(
      Yup.object().shape({
        labName: Yup.string().required('Please enter the lab name'),
      }),
    )
    .min(1, 'Please add at least one DRDO vendor lab')
    .required('Please add DRDO vendor labs'),
  drdoRegistrationNumber: Yup.string().when('isExistingDrdoVendor', {
    is: val => val === true || val === 'yes',
    // then: schema => schema.required('Please enter the DRDO registration number').matches(drdoRegistrationNumberRegex, 'DRDO registration number must be valid (e.g., DRDO-ABCDE-12345)'),
    then: schema => schema.required('Please enter the DRDO registration number').matches(/^[\s\S]+$/, 'DRDO registration number is required'),

    otherwise: schema => schema.notRequired(),
  }),
  drdoCertificateFile: Yup.mixed().when('isExistingDrdoVendor', {
    is: val => val === true || val === 'yes',
    then: schema => schema.required('Please upload the DRDO certificate file'),
    otherwise: schema => schema.notRequired(),
  }),
  enterpriseClassification: Yup.string().required('Please select an enterprise classification'),
  enterpriseName: Yup.string().required('Please enter the enterprise name'),
  registeredOfficeAddress: Yup.string().max(500, 'Address cannot exceed 500 characters').required('Please enter the registered office address'),
  registeredOfficeState: Yup.string().required('Please select the registered office state'),
  registeredOfficeDistrict: Yup.string().required('Please select the registered office district'),
  registeredOfficePincode: Yup.string()
    .required('Please enter the registered office pin code')
    .matches(/^[0-9]{6}$/, 'PIN code must be 6 digits'),
  registeredOfficeMobile: Yup.string().max(10, 'Mobile number cannot exceed 10 digits').required('Please enter the registered office mobile'),
  registeredOfficeEmail: Yup.string()
    .max(320, 'Email address cannot exceed 320 characters')
    .matches(emailRegex, 'Please enter a valid email address')
    .email('Please enter a valid email address')
    .required('Please enter the registered office email'),
  registeredOfficeAlternateEmail: Yup.string()
    .transform((value, originalValue) => {
      if (typeof originalValue === 'string' && originalValue.trim() === '') {
        return undefined;
      }
      return value;
    })
    .notRequired()
    .max(320, 'Email address cannot exceed 320 characters')
    .matches(emailRegex, 'Please enter a valid email address')
    .email('Please enter a valid email address')
    .test('different-from-registered-email', 'Alternate email must be different from primary', function (value) {
      const primary = this.parent?.registeredOfficeEmail;
      if (!value || !primary) {
        return true;
      }
      return String(value).trim().toLowerCase() !== String(primary).trim().toLowerCase();
    }),
  unitAlternateEmail: Yup.string()
    .transform((value, originalValue) => {
      if (typeof originalValue === 'string' && originalValue.trim() === '') {
        return undefined;
      }
      return value;
    })
    .notRequired()
    .max(320, 'Email address cannot exceed 320 characters')
    .matches(emailRegex, 'Please enter a valid email address')
    .email('Please enter a valid email address')
    .test('different-from-unit-email', 'Alternate email must be different from primary', function (value) {
      const primary = this.parent?.unitEmail;
      if (!value || !primary) {
        return true;
      }
      return String(value).trim().toLowerCase() !== String(primary).trim().toLowerCase();
    }),
  unitAddress: Yup.string().max(500, 'Address cannot exceed 500 characters').required('Please enter the unit address'),
  unitName: Yup.string().max(100, 'Unit name cannot exceed 100 characters').required('Please enter the unit name'),
  registeredOfficeLandline: Yup.string().max(12, 'Landline Number cannot exceed 12 characters'),
  unitLandline: Yup.string().matches(/^[0-9]{12}$/, { message: 'Landline Number must be 12 digits', excludeEmptyString: true }),
  unitPincode: Yup.string()
    .required('Please enter the unit pin code')
    .matches(/^[0-9]{6}$/, 'PIN code must be 6 digits'),
  unitState: Yup.string().required('Please select the unit state'),
  unitDistrict: Yup.string().required('Please select the unit district'),
  unitMobile: Yup.string().max(10, 'Mobile number cannot exceed 10 digits').required('Please enter the unit mobile'),
  unitEmail: Yup.string().max(320, 'Email address cannot exceed 320 characters').matches(emailRegex, 'Please enter a valid email address').required('Please enter the unit email address'),
  unitCommencementDate: Yup.string().required('Please select the unit commencement date'),
  siteExteriorPhoto: Yup.mixed().required('Please upload the site exterior photo'),
  contactPersonName: Yup.string().max(50, 'Contact person name cannot exceed 50 characters').required('Please enter the contact person name'),
  contactPersonDesignation: Yup.string().max(50, 'Contact person designation cannot exceed 50 characters').required('Please enter the contact person designation'),
  contactPersonMobile: Yup.string().max(10, 'Mobile number cannot exceed 10 digits').required('Please enter the contact person mobile'),
  contactPersonEmail: Yup.string()
    .max(320, 'Email address cannot exceed 320 characters')
    .matches(emailRegex, 'Please enter a valid email address')
    .email('Please enter a valid email address')
    .required('Please enter the contact person email'),
  ownershipType: Yup.string().required('Please select the ownership type'),
  maleEmployeesCount: Yup.number()
    .transform((value, originalValue) => parseNumericOrNull(originalValue))
    .typeError('Must be a number')
    .max(99999, 'Employee count cannot exceed 5 digits')
    .required('Please enter the male employees count'),
  femaleEmployeesCount: Yup.number()
    .transform((value, originalValue) => parseNumericOrNull(originalValue))
    .typeError('Must be a number')
    .max(99999, 'Employee count cannot exceed 5 digits')
    .required('Please enter the female employees count'),
  otherEmployeesCount: Yup.number()
    .transform((value, originalValue) => parseNumericOrNull(originalValue))
    .typeError('Must be a number')
    .max(99999, 'Employee count cannot exceed 5 digits')
    .required('Please enter the other employees count'),
  totalEmployees: Yup.number()
    .transform((value, originalValue) => parseNumericOrNull(originalValue))
    .min(1, 'Total number of employees must be greater than 0')
    .required('Total number of employees is required'),
  hasGst: Yup.string().oneOf(['yes', 'no'], 'Select Yes or No').required('Please select GST registration status'),

  gstNumber: Yup.string().when('hasGst', {
    is: val => val === 'yes',
    then: schema => schema.required('Please enter the GST number').matches(gstNumberRegex, 'GST number must be valid (e.g., 22AAAAA0000A1Z5)'),
    otherwise: schema => schema.notRequired(),
  }),
  gstCertificateFile: Yup.mixed().when('hasGst', {
    is: val => val === 'yes',
    then: schema => schema.required('Please upload the GST certificate file'),
    otherwise: schema => schema.notRequired(),
  }),
  hasGovtRegistration: Yup.string().oneOf(['yes', 'no'], 'Select Yes or No').required('Please select government registration status'),
  govtOrganisationName: Yup.string().when('hasGovtRegistration', {
    is: val => val === 'yes',
    then: schema => schema.max(250, 'Enterprise Name cannot exceed 250 characters').required('Please enter the government organization name'),
    otherwise: schema => schema.notRequired(),
  }),
  govtRegistrationCertificate: Yup.mixed().when('hasGovtRegistration', {
    is: val => val === 'yes',
    then: schema => schema.required('Please upload the government registration certificate'),
    otherwise: schema => schema.notRequired(),
  }),
  dpiitRegistrationNumber: Yup.string().when('enterpriseClassification', {
    is: val => val === 'startup',
    then: schema =>
      schema
        .required('Please enter the DPIIT registration number')
        .max(20, 'DPIIT registration number cannot exceed 20 characters')
        .matches(dpiitNumberRegex, 'DPIIT registration number must be valid (e.g., DPIIT2022AB1234)'),
    otherwise: schema => schema.notRequired(),
  }),
  dpiitCertificateFile: Yup.mixed().when('enterpriseClassification', {
    is: val => val === 'startup',
    then: schema => schema.required('Please upload the DPIIT certificate file'),
    otherwise: schema => schema.notRequired(),
  }),
  udyamRegistrationNumber: Yup.string().when('enterpriseClassification', {
    is: val => ['micro', 'small', 'medium'].includes(val),
    then: schema => schema.required('Please enter the Udyam registration number').matches(udyamNumberRegex, 'Udyam registration number must be valid (e.g., UDYAM-XX-00-0000000)'),
    otherwise: schema => schema.notRequired(),
  }),
  udyamCertificateFile: Yup.mixed().when('enterpriseClassification', {
    is: val => ['micro', 'small', 'medium'].includes(val),
    then: schema => schema.required('Please upload the Udyam certificate file'),
    otherwise: schema => schema.notRequired(),
  }),
  incorporationCertificateFile: Yup.mixed().when('enterpriseClassification', {
    is: 'large',
    then: schema => schema.required('Please upload the incorporation certificate file'),
    otherwise: schema => schema.notRequired(),
  }),
  thirdPartyCertifications: Yup.array()
    .of(
      Yup.string()
        .trim()
        .required('Certification cannot be empty')
        .test('unique-certification', 'Certification must be unique', function (value) {
          if (!value) {
            return true;
          }
          const certifications = this.from?.[1]?.value?.thirdPartyCertifications || [];
          const currentIndex = parseInt(this.path?.match(/\[(\d+)\]/)?.[1] ?? '-1', 10);
          const duplicates = certifications.filter((c, idx) => idx !== currentIndex && c?.toLowerCase().trim() === value.toLowerCase().trim());
          return duplicates.length === 0;
        }),
    )
    .min(1, 'Third party certifications are required'),
  // Processes - stored as array of objects [{processName: string}]

  svcOutsourcedProcesses: Yup.mixed()
    .test('svc-outsourced-format', 'Outsourced processes must be an array of process names or objects', function (value) {
      if (value == null) {
        return true;
      } // optional
      if (!Array.isArray(value)) {
        return false;
      }
      return true;
    })
    .test('svc-outsourced-unique', 'Process name must be unique', function (value) {
      if (!Array.isArray(value) || value.length === 0) {
        return true;
      }
      const names = value
        .map(v => (typeof v === 'string' ? v : v?.processName || ''))
        .map(s => String(s || '').trim())
        .filter(Boolean);
      const lower = names.map(n => n.toLowerCase());
      return new Set(lower).size === lower.length;
    }),
  isBlacklisted: Yup.string().required('Please select blacklist status'),
  blacklistedOrganizations: Yup.mixed()
    .test('blacklisted-format', 'Blacklisted organizations must be provided', function (value) {
      const { isBlacklisted } = this.parent || {};
      if (isBlacklisted !== 'yes') {
        return true;
      }
      if (value == null) {
        return false;
      }
      if (Array.isArray(value)) {
        return value.filter(Boolean).length > 0;
      }
      if (typeof value === 'string') {
        return (
          value
            .split(',')
            .map(s => s.trim())
            .filter(Boolean).length > 0
        );
      }
      return false;
    })
    .test('unique-blacklisted-orgs', 'Organization name must be unique', function (value) {
      if (!value) {
        return true;
      }
      const asArray = Array.isArray(value)
        ? value.map(v => String(v).trim())
        : String(value)
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
      const lower = asArray.map(s => s.toLowerCase());
      return new Set(lower).size === lower.length;
    }),
  hasOngoingEnquiry: Yup.string().required('Please select ongoing enquiry status'),
  informationTrueAgreement: Yup.boolean().oneOf([true], 'You must agree to the terms').required('Required'),
  applicationAcceptanceAgreement: Yup.boolean().oneOf([true], 'You must agree to the terms').required('Required'),
  svcServices: Yup.array()
    .of(
      Yup.object().shape({
        serviceName: Yup.string()
          .required('Please enter the service name')
          .test('unique-service-name', 'Service name must be unique', function (value) {
            if (!value) {
              return true;
            }
            const services = this.from?.[1]?.value?.svcServices || [];
            const currentIndex = parseInt(this.path?.match(/\[(\d+)\]/)?.[1] ?? '-1', 10);
            const duplicates = services.filter((s, idx) => idx !== currentIndex && s.serviceName?.toLowerCase().trim() === value.toLowerCase().trim());
            return duplicates.length === 0;
          }),
        totalServicesCapacity: Yup.number()
          .transform((value, originalValue) => parseNumericOrNull(originalValue))
          .typeError('Must be a number')
          .max(999999999999, 'Total services capacity cannot exceed 12 digits')
          .required('Please enter the total service capacity'),
        capacityUnit: Yup.string().notRequired(),
        currentUtilizedCapacity: Yup.number()
          .transform((value, originalValue) => parseNumericOrNull(originalValue))
          .typeError('Must be a number')
          .max(999999999999, 'Utilized capacity cannot exceed 12 digits')
          .required('Please enter the current utilized capacity')
          .test('less-than-total', 'Utilized capacity cannot exceed total services capacity', function (value) {
            const { totalServicesCapacity } = this.parent;
            if (value === null || value === undefined || totalServicesCapacity === null || totalServicesCapacity === undefined) {
              return true;
            }
            return value <= totalServicesCapacity;
          }),
        commencementDate: Yup.string().required('Please select the commencement date'),
        isExported: Yup.boolean().required('Please select international supply status'),
        exportCountries: Yup.array().when('isExported', {
          is: true,
          then: schema => schema.min(1, 'Please select at least one country').required('Please select the destination countries'),
          otherwise: schema => schema.notRequired(),
        }),
        exportPercentage: Yup.number()
          .transform((value, originalValue) => (originalValue === '' ? null : value))
          .typeError('Must be a number')
          .when('isExported', {
            is: true,
            then: schema => schema.required('Please enter the supply percentage').min(1, 'Percentage must be greater than 0').max(100, 'Percentage cannot exceed 100'),
            otherwise: schema => schema.notRequired(),
          }),
      }),
    )
    .min(1, 'Please add at least one service')
    .required('Please add at least one service')
    .test('export-percentage-total', 'Total export percentage across all services cannot exceed 100%', function (services) {
      if (!services) {
        return true;
      }
      const total = services.reduce((sum, s) => sum + (Number(s.exportPercentage) || 0), 0);
      return total <= 100;
    }),
  // Customers array
  customers: Yup.array()
    .of(
      Yup.object().shape({
        customerName: Yup.string()
          .required('Please enter the customer name')
          .test('unique-customer-name', 'Customer name must be unique', function (value) {
            if (!value) {
              return true;
            }
            const customers = this.from?.[1]?.value?.customers || [];
            const currentIndex = parseInt(this.path?.match(/\[(\d+)\]/)?.[1] ?? '-1', 10);
            const duplicates = customers.filter((c, idx) => idx !== currentIndex && c.customerName?.toLowerCase().trim() === value.toLowerCase().trim());
            return duplicates.length === 0;
          }),
        customerType: Yup.string().required('Please select the customer type'),
        // Backend expects 'country' not 'customerCountry'
        country: Yup.string().when('customerType', {
          is: 'international',
          then: schema => schema.required('Please select the customer country'),
          otherwise: schema => schema.notRequired(),
        }),
      }),
    )
    .min(1, 'Please add at least one customer')
    .required('Please add at least one customer'),
  // Key Service Resources array
  // Note: resourceType removed - not in backend schema (ApplicationServiceResource model)
  svcKeyProcesses: Yup.array()
    .of(
      Yup.object().shape({
        processName: Yup.string()
          .required('Please enter the key process')
          .test('unique-key-process', 'Process name must be unique', function (value) {
            if (!value) {
              return true;
            }
            const processes = this.from?.[1]?.value?.svcKeyProcesses || [];
            const currentIndex = parseInt(this.path?.match(/\[(\d+)\]/)?.[1] ?? '-1', 10);
            const duplicates = processes.filter((p, idx) => idx !== currentIndex && p.processName?.toLowerCase().trim() === value.toLowerCase().trim());
            return duplicates.length === 0;
          }),
      }),
    )
    .min(1, 'Please add at least one key process'),
  svcKeyResources: Yup.array()
    .of(
      Yup.object().shape({
        resourceName: Yup.string().test('unique-resource-name', 'Resource name must be unique', function (value) {
          if (!value) {
            return true;
          }
          const resources = this.from?.[1]?.value?.svcKeyResources || [];
          const currentIndex = parseInt(this.path?.match(/\[(\d+)\]/)?.[1] ?? '-1', 10);
          const duplicates = resources.filter((r, idx) => idx !== currentIndex && r.resourceName?.toLowerCase().trim() === value.toLowerCase().trim());
          return duplicates.length === 0;
        }),

        isImported: Yup.string().required('Please select imported status'),
        importCountry: Yup.string().when('isImported', {
          is: 'yes',
          then: schema => schema.required('Please select the import country'),
          otherwise: schema => schema.notRequired(),
        }),
        importPercentage: Yup.number()
          .transform((value, originalValue) => (originalValue === '' ? null : value))
          .typeError('Must be a number')
          .when('isImported', {
            is: 'yes',
            then: schema => schema.required('Please enter the import percentage').min(1, 'Percentage must be greater than 0').max(100, 'Percentage cannot exceed 100'),
            otherwise: schema => schema.notRequired(),
          }),
      }),
    )
    .min(1, 'Please add at least one service resource')
    .required('Please add at least one service resource')
    .test('import-percentage-total', 'Total import percentage across all service resources cannot exceed 100%', function (resources) {
      if (!resources) {
        return true;
      }
      const total = resources.reduce((sum, r) => sum + (Number(r.importPercentage) || 0), 0);
      return total <= 100;
    }),
});

const steps = [
  {
    title: 'Enterprise',
    subtitle: 'Basic Identity & PoC',
    icon: Icons.enterpriseInfoActive,
    activeIcon: Icons.enterpriseInfoActive,
    doneIcon: Icons.enterpriseInfoDone,
  },
  {
    title: 'Operations',
    subtitle: 'Unit & Regulatory',
    icon: Icons.operationalDetail,
    activeIcon: Icons.operationalDetailActive,
    doneIcon: Icons.operationalDetailDone,
  },
  {
    title: 'Services',
    subtitle: 'Offerings & Capacity',
    icon: Icons.productDetail,
    activeIcon: Icons.productDetailActive,
    doneIcon: Icons.productDetailDone,
  },
  {
    title: 'Declarations',
    subtitle: 'Compliance & Sign-Off',
    icon: Icons.document,
    activeIcon: Icons.documentActive,
    doneIcon: Icons.documentDone,
  },
  {
    title: 'Review',
    subtitle: 'Review & Submit',
    icon: Icons.reviewDone,
    activeIcon: Icons.reviewActive,
    doneIcon: Icons.review,
  },
];

// File fields are uploaded on step-save and on the first autosave that sees them, never re-sent.
const FILE_FIELDS = ['siteExteriorPhoto', 'gstCertificateFile', 'govtRegistrationCertificate', 'drdoCertificateFile', 'dpiitCertificateFile', 'udyamCertificateFile', 'incorporationCertificateFile'];

// A field qualifies for blur-autosave only if it is a top-level scalar (not a file,
// and not an array/table cell whose Formik name contains '.' or '[').
const isAutosavableFieldName = name => !!name && !name.includes('.') && !name.includes('[') && !FILE_FIELDS.includes(name);

// Dropdowns, date pickers, file inputs and the table rows never emit a blur that carries a field
// name, so nothing on them can trigger the blur autosave. Their values are committed by watching
// for a change instead, debounced so a burst of edits costs one save.
const COMMIT_ON_CHANGE_DEBOUNCE_MS = 800;
const COMMIT_ON_CHANGE_FIELDS = [
  'vendorCategory',
  'registeredOfficeState',
  'unitState',
  'unitCommencementDate',
  'ownershipType',
  'svcDrdoVendorLabs',
  'thirdPartyCertifications',
  'svcKeyProcesses',
  'svcOutsourcedProcesses',
  'blacklistedOrganizations',
  'svcServices',
  'customers',
  'svcKeyResources',
  'svcOutsourcedComponents',
  ...FILE_FIELDS,
];

// JSON.stringify of a File is '{}', so a file is described by the fields that identify it.
const describeForChangeWatch = value => (typeof File !== 'undefined' && value instanceof File ? `${value.name}|${value.size}|${value.lastModified}` : value);

const ServicesSteps = ({ initialDraftValues, draftApplicationId }) => {
  // ============================================================
  // HOOKS: useState
  // ============================================================

  const [activeStep, setActiveStep] = useState(0);
  const [combinedData, setCombinedData] = useState({});
  const [_toastMessage, setToastMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isApplicationSubmissionOpen, setIsApplicationSubmissionOpen] = useState(true);
  const [showApplicationLabsModal, setShowApplicationLabsModal] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imagePreviewSrc, setImagePreviewSrc] = useState('');
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isSubmittingStep, setIsSubmittingStep] = useState(false);
  const handleViewService = data => {
    setSelectedService(data);
    setServiceModalOpen(true);
  };
  const handleCloseServiceModal = () => {
    setServiceModalOpen(false);
    setSelectedService(null);
  };
  const handleViewCustomer = data => {
    setSelectedCustomer(data);
    setCustomerModalOpen(true);
  };
  const handleCloseCustomerModal = () => {
    setCustomerModalOpen(false);
    setSelectedCustomer(null);
  };
  // Application Labs modal handlers

  const handleCloseApplicationLabsModal = () => {
    setShowApplicationLabsModal(false);
  };

  // ============================================================
  // HOOKS: useRef
  // ============================================================
  const stepDataRef = useRef({});
  const prevStepRef = useRef(activeStep);

  // Per-field blur autosave: serialize saves and always reuse the latest draft id
  // and form values so concurrent blurs can't create duplicate drafts.
  const autosaveSavingRef = useRef(false);
  const autosavePendingRef = useRef(false);
  const applicationIdRef = useRef(draftApplicationId || null);
  // Holds the in-flight first-create dispatch so a concurrent save (blur autosave vs.
  // step-save) waits for it and updates the new draft instead of racing a second create.
  const creationPromiseRef = useRef(null);
  // Files already stored by an earlier save, held by reference per field so a picked file is
  // uploaded once instead of riding every later save.
  const autosavedFilesRef = useRef({});
  const formikValuesRef = useRef({});
  const [autosaveStatus, setAutosaveStatus] = useState('idle'); // idle | saving | saved | error
  // Latest non-blocking GSTIN consistency result returned by the draft save (Option B).
  // A ref (not state) so handleNext can read it synchronously right after the save to
  // decide whether to gate advancement past the GST step.
  const gstWarningRef = useRef(null);

  // ============================================================
  // HOOKS: Redux
  // ============================================================
  const { createServiceApplicationError, createServiceApplicationLoading, createServiceApplication, submitServiceApplication, submitServiceApplicationLoading, submitServiceApplicationError } =
    useSelector(state => state.UnitAdminApplication);
  const { drdoSetting } = useSelector(state => state.SystemSetting);
  const { user } = useSelector(state => state.Account);
  const { organizations } = useSelector(state => state.Organization);
  const { drdoVendorCategoriesV1, pinCodeLookups, countries, getState: statesList, thirdPartyCerts, keyResources, outsourcedComponents, keyProcessV1, vendorLabs } = useSelector(state => state.Master);
  const REGISTERED_OFFICE_PINCODE_KEY = 'enterpriseRegisteredOffice';
  const UNIT_PINCODE_KEY = 'enterpriseUnit';
  const registeredOfficePinCodeLookup = pinCodeLookups?.[REGISTERED_OFFICE_PINCODE_KEY];
  const stateOptions = Array.isArray(statesList) ? statesList.map(state => ({ value: state.name || state, label: state.name || state })) : [];
  const capacityUnit = 'Number';

  const navigation = useNavigate();
  const dispatch = useDispatch();
  const { getPosition } = useGeolocation();

  useEffect(() => {
    if (user?.organization?.id) {
      dispatch(getAllOrganizationsAction({ organizationId: user.organization.id }));
    }
  }, [dispatch, user?.organization?.id]);

  // Clear any stale draft ID left in Redux from a previous save. Without this,
  // starting a new application would reuse the last draft's ID and overwrite it.
  useEffect(() => {
    if (!draftApplicationId) {
      dispatch(resetCreateServiceApplication());
    }
  }, [dispatch, draftApplicationId]);

  // Check if application submission is open
  useEffect(() => {
    const checkSubmissionStatus = async () => {
      try {
        const systemStatus = await SystemStatusService().getSystemStatus();
        setIsApplicationSubmissionOpen(systemStatus.applicationSubmissionOpen);
      } catch (error) {
        Logger.error('Failed to check application submission status:', error);
        // Default to open on error to not block users unnecessarily
        setIsApplicationSubmissionOpen(true);
      }
    };
    checkSubmissionStatus();
  }, []);

  const currentOrganization = useMemo(() => {
    if (organizations) {
      return organizations?.organization;
    }
    return null;
  }, [organizations]);
  const location = useLocation();
  // Get form values from navigation state or props (for draft resume)
  const initialFormValues = useMemo(() => initialDraftValues || location.state?.formValues || {}, [initialDraftValues, location.state?.formValues]);

  // Get current application ID from draft response or props (for draft resume)
  const currentApplicationId = useMemo(() => {
    return draftApplicationId || createServiceApplication?.data?.id || createServiceApplication?.id || null;
  }, [draftApplicationId, createServiceApplication]);

  // ============================================================
  // HELPER FUNCTIONS
  // ============================================================
  // Helper to format display values across the review UI

  // Safely split comma-separated values into an array, handling arrays and non-string input
  const safeSplitComma = value => {
    if (value == null) {
      return [];
    }
    if (Array.isArray(value)) {
      return value.map(v => String(v).trim()).filter(Boolean);
    }
    try {
      // If it's a JSON-encoded array or string, try to parse
      if (typeof value === 'string') {
        const s = value.trim();
        if (s.startsWith('[') && s.endsWith(']')) {
          try {
            const parsed = JSON.parse(s);
            if (Array.isArray(parsed)) {
              return parsed.map(p => String(p).trim()).filter(Boolean);
            }
          } catch (_e) {
            // fallthrough
          }
        }
      }
    } catch (_e) {
      // ignore
    }
    return String(value)
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  };
  // ============================================================
  // MODAL HANDLERS
  // ============================================================
  const handleOpenSubmitModal = () => setShowSubmitModal(true);
  const handleCloseSubmitModal = () => setShowSubmitModal(false);

  // Dynamically select schema for each step
  const getStepSchema = step => {
    switch (step) {
      case 0:
        // Step 0: Enterprise - Basic Identity & PoC
        return Yup.object().shape({
          svcProviderType: ApplicationSchema.fields.svcProviderType,
          vendorCategory: ApplicationSchema.fields.vendorCategory,
          svcDrdoVendorLabs: ApplicationSchema.fields.svcDrdoVendorLabs,
          isExistingDrdoVendor: ApplicationSchema.fields.isExistingDrdoVendor,
          drdoRegistrationNumber: ApplicationSchema.fields.drdoRegistrationNumber,
          drdoCertificateFile: ApplicationSchema.fields.drdoCertificateFile,
          enterpriseClassification: ApplicationSchema.fields.enterpriseClassification,
          dpiitRegistrationNumber: ApplicationSchema.fields.dpiitRegistrationNumber,
          dpiitCertificateFile: ApplicationSchema.fields.dpiitCertificateFile,
          udyamRegistrationNumber: ApplicationSchema.fields.udyamRegistrationNumber,
          udyamCertificateFile: ApplicationSchema.fields.udyamCertificateFile,
          cin: ApplicationSchema.fields.cin,
          incorporationCertificateFile: ApplicationSchema.fields.incorporationCertificateFile,
          enterpriseName: ApplicationSchema.fields.enterpriseName,
          registeredOfficeAddress: ApplicationSchema.fields.registeredOfficeAddress,
          registeredOfficeState: ApplicationSchema.fields.registeredOfficeState,
          registeredOfficeDistrict: ApplicationSchema.fields.registeredOfficeDistrict,
          registeredOfficePincode: ApplicationSchema.fields.registeredOfficePincode,
          registeredOfficeMobile: ApplicationSchema.fields.registeredOfficeMobile,
          registeredOfficeEmail: ApplicationSchema.fields.registeredOfficeEmail,
          unitAddress: ApplicationSchema.fields.unitAddress,
          unitName: ApplicationSchema.fields.unitName,
          unitState: ApplicationSchema.fields.unitState,
          unitDistrict: ApplicationSchema.fields.unitDistrict,
          unitPincode: ApplicationSchema.fields.unitPincode,
          unitMobile: ApplicationSchema.fields.unitMobile,
          unitEmail: ApplicationSchema.fields.unitEmail,
          unitLandline: ApplicationSchema.fields.unitLandline,
          unitCommencementDate: ApplicationSchema.fields.unitCommencementDate,
          siteExteriorPhoto: ApplicationSchema.fields.siteExteriorPhoto,
          contactPersonName: ApplicationSchema.fields.contactPersonName,
          contactPersonDesignation: ApplicationSchema.fields.contactPersonDesignation,
          contactPersonMobile: ApplicationSchema.fields.contactPersonMobile,
          contactPersonEmail: ApplicationSchema.fields.contactPersonEmail,
        });
      case 1:
        // Step 1: Operations - Unit & Regulatory
        return Yup.object().shape({
          ownershipType: ApplicationSchema.fields.ownershipType,
          maleEmployeesCount: ApplicationSchema.fields.maleEmployeesCount,
          femaleEmployeesCount: ApplicationSchema.fields.femaleEmployeesCount,
          otherEmployeesCount: ApplicationSchema.fields.otherEmployeesCount,
          totalEmployees: ApplicationSchema.fields.totalEmployees,
          hasGst: ApplicationSchema.fields.hasGst,
          gstNumber: ApplicationSchema.fields.gstNumber,
          gstCertificateFile: ApplicationSchema.fields.gstCertificateFile,
          hasGovtRegistration: ApplicationSchema.fields.hasGovtRegistration,
          govtOrganisationName: ApplicationSchema.fields.govtOrganisationName,
          govtRegistrationCertificate: ApplicationSchema.fields.govtRegistrationCertificate,
        });
      case 2:
        // Step 2: Services - schema modeled on manufacturing step validations
        return Yup.object()
          .shape({
            svcServices: Yup.array()
              .of(
                Yup.object().shape({
                  serviceName: Yup.string()
                    .required('Please enter the service name')
                    .test('unique-service-name', 'Service name must be unique', function (value) {
                      if (!value) {
                        return true;
                      }
                      const services = this.from?.[1]?.value?.svcServices || [];
                      const currentIndex = parseInt(this.path?.match(/\[(\d+)\]/)?.[1] ?? '-1', 10);
                      const duplicates = services.filter((s, idx) => idx !== currentIndex && s.serviceName?.toLowerCase().trim() === value.toLowerCase().trim());
                      return duplicates.length === 0;
                    }),
                  totalServicesCapacity: Yup.number()
                    .transform((value, originalValue) => (originalValue === '' ? null : value))
                    .typeError('Must be a number')
                    .required('Please enter the total services capacity'),
                  currentUtilizedCapacity: Yup.number()
                    .transform((value, originalValue) => (originalValue === '' ? null : value))
                    .typeError('Must be a number')
                    .required('Please enter the current utilized capacity'),
                  commencementDate: Yup.string().required('Please select the commencement date'),
                  isExported: Yup.boolean().required('Please select the international supply status'),
                  exportCountries: Yup.array().when('isExported', {
                    is: true,
                    then: schema => schema.min(1, 'Select at least one country').required('Destination countries are required'),
                    otherwise: schema => schema.notRequired(),
                  }),
                  exportPercentage: Yup.number()
                    .transform((value, originalValue) => (originalValue === '' ? null : value))
                    .typeError('Must be a number')
                    .when('isExported', {
                      is: true,
                      then: schema => schema.required('Please enter the supply percentage').min(1, 'Percentage must be greater than 0').max(100, 'Percentage cannot exceed 100'),
                      otherwise: schema => schema.notRequired(),
                    }),
                  capacityUnit: Yup.string().notRequired(),
                }),
              )
              .min(1, 'Please add at least one service')
              .required('Services are required')
              .test('export-percentage-total', 'Total export percentage across all services cannot exceed 100%', function (services) {
                if (!services) {
                  return true;
                }
                const total = services.reduce((sum, s) => sum + (Number(s.exportPercentage) || 0), 0);
                return total <= 100;
              }),
            customers: Yup.array()
              .of(
                Yup.object().shape({
                  customerName: Yup.string()
                    .required('Please enter the customer name')
                    .test('unique-customer-name', 'Customer name must be unique', function (value) {
                      if (!value) {
                        return true;
                      }
                      const customers = this.from?.[1]?.value?.customers || [];
                      const currentIndex = parseInt(this.path?.match(/\[(\d+)\]/)?.[1] ?? '-1', 10);
                      const duplicates = customers.filter((c, idx) => idx !== currentIndex && c.customerName?.toLowerCase().trim() === value.toLowerCase().trim());
                      return duplicates.length === 0;
                    }),
                  customerType: Yup.string().required('Please enter the customer detail'),
                  country: Yup.string().when('customerType', {
                    is: 'international',
                    then: schema => schema.required('Please select the customer country'),
                    otherwise: schema => schema.notRequired(),
                  }),
                }),
              )
              .min(1, 'Please add at least one customer')
              .required('Customers are required'),
            svcKeyProcesses: ApplicationSchema.fields.svcKeyProcesses,
            svcOutsourcedProcesses: ApplicationSchema.fields.svcOutsourcedProcesses,
            svcKeyResources: Yup.array()
              .of(
                Yup.object().shape({
                  resourceType: Yup.string().notRequired(),
                  resourceName: Yup.string()
                    .trim()
                    .required('Please enter the resource name')
                    .test('unique-resource-name', 'Resource name must be unique', function (value) {
                      if (!value) {
                        return true;
                      }
                      const resources = this.from?.[1]?.value?.svcKeyResources || [];
                      const currentIndex = parseInt(this.path?.match(/\[(\d+)\]/)?.[1] ?? '-1', 10);
                      const duplicates = resources.filter((r, idx) => idx !== currentIndex && r.resourceName?.toLowerCase().trim() === value.toLowerCase().trim());
                      return duplicates.length === 0;
                    }),
                  isImported: Yup.boolean().required('Please select the imported status'),
                  importCountry: Yup.string().when('isImported', {
                    is: true,
                    then: schema => schema.required('Please select the import country'),
                    otherwise: schema => schema.notRequired(),
                  }),
                  importPercentage: Yup.number()
                    .transform((value, originalValue) => (originalValue === '' ? null : value))
                    .typeError('Must be a number')
                    .when('isImported', {
                      is: true,
                      then: schema => schema.required('Please enter the import percentage').min(1, 'Percentage must be greater than 0').max(100, 'Percentage cannot exceed 100'),
                      otherwise: schema => schema.notRequired(),
                    }),
                }),
              )
              .min(1, 'Please add at least one key resource')
              .required('Key resources are required')
              .test('import-percentage-total', 'Total import percentage across all key resources cannot exceed 100%', function (resources) {
                if (!resources) {
                  return true;
                }
                const total = resources.reduce((sum, r) => sum + (Number(r.importPercentage) || 0), 0);
                return total <= 100;
              }),
            svcOutsourcedComponents: Yup.array()
              .of(
                Yup.object().shape({
                  componentName: Yup.string()
                    .trim()
                    .required('Please enter the outsourced component name')
                    .test('unique-component-name', 'Component name must be unique', function (value) {
                      if (!value) {
                        return true;
                      }
                      const components = this.from?.[1]?.value?.svcOutsourcedComponents || [];
                      const currentIndex = parseInt(this.path?.match(/\[(\d+)\]/)?.[1] ?? '-1', 10);
                      const duplicates = components.filter((c, idx) => idx !== currentIndex && c.componentName?.toLowerCase().trim() === value.toLowerCase().trim());
                      return duplicates.length === 0;
                    }),
                  isImported: Yup.boolean().required('Please select the imported status'),
                  importCountry: Yup.string().when('isImported', {
                    is: true,
                    then: schema => schema.required('Please select the import country'),
                    otherwise: schema => schema.notRequired(),
                  }),
                  importPercentage: Yup.number()
                    .transform((value, originalValue) => (originalValue === '' ? null : value))
                    .typeError('Must be a number')
                    .when('isImported', {
                      is: true,
                      then: schema => schema.required('Please enter the import percentage').min(1, 'Percentage must be greater than 0').max(100, 'Percentage cannot exceed 100'),
                      otherwise: schema => schema.notRequired(),
                    }),
                }),
              )
              .notRequired()
              .test('import-percentage-total', 'Total import percentage across all outsourced components cannot exceed 100%', function (components) {
                if (!components) {
                  return true;
                }
                const total = components.reduce((sum, c) => sum + (Number(c.importPercentage) || 0), 0);
                return total <= 100;
              }),
          })
          .test('resources-or-outsourced-required', 'You must add at least one Key Service Resource or Outsourced Service Component.', function (value) {
            const resources = value?.svcKeyResources || [];
            const outsourced = value?.svcOutsourcedComponents || [];
            if ((Array.isArray(resources) && resources.length > 0) || (Array.isArray(outsourced) && outsourced.length > 0)) {
              return true;
            }
            return this.createError({ path: 'svcKeyResources', message: 'You must add at least one Key Service Resource or Outsourced Service Component.' });
          });
      case 3:
        // Step 3: Compliance - Compliance & Sign-Off
        return Yup.object().shape({
          thirdPartyCertifications: Yup.array()
            .of(
              Yup.string().test('unique-certification', 'Certification must be unique', function (value) {
                if (!value) {
                  return true;
                }
                const certifications = this.from?.[1]?.value?.thirdPartyCertifications || [];
                const currentIndex = parseInt(this.path?.match(/\[(\d+)\]/)?.[1] ?? '-1', 10);
                const duplicates = certifications.filter((c, idx) => idx !== currentIndex && c?.toLowerCase().trim() === value.toLowerCase().trim());
                return duplicates.length === 0;
              }),
            )
            .min(1, 'Please select at least one third party certification')
            .required('Please select the third party certifications'),
          isBlacklisted: ApplicationSchema.fields.isBlacklisted,
          blacklistedOrganizations: ApplicationSchema.fields.blacklistedOrganizations,
          hasOngoingEnquiry: ApplicationSchema.fields.hasOngoingEnquiry,
          informationTrueAgreement: ApplicationSchema.fields.informationTrueAgreement,
          applicationAcceptanceAgreement: ApplicationSchema.fields.applicationAcceptanceAgreement,
        });
      default:
        return ApplicationSchema;
    }
  };
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const data = { isActive: true, all: true };
      dispatch(getDrdoApprovalSettingByKeyAction('drdo_approval_required'));
      dispatch(listKeyResourcesAction(data));
      dispatch(listOutsourcedComponentsAction(data));
      dispatch(getApplicationAction());
      dispatch(listVendorCategoriesV1Action(data));
      dispatch(listThirdPartyCertsAction(data));
      dispatch(listVendorLabsAction(data));
      dispatch(listKeyProcessV1Action(data));
      dispatch(listKeyResourcesAction(data));
      dispatch(listOutsourcedComponentsAction(data));

      dispatch(listCountriesAction(data));
      dispatch(listKeyProcessesAction(data));
      dispatch(getStateAction(data));
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [dispatch]);
  // Validate current step before moving to next
  const handleNext = async () => {
    // Guard against a burst of rapid clicks: validation runs synchronously and the
    // Redux loading flag only flips after the submit dispatches, so without this a
    // spam-click can queue several concurrent calls that each advance the step.
    if (isSubmittingStep) {
      return;
    }
    setIsSubmittingStep(true);
    try {
      await handleNextInner();
    } finally {
      setIsSubmittingStep(false);
    }
  };

  const handleNextInner = async () => {
    // Set touched fields per step so nested errors display correctly
    if (activeStep === 0) {
      const touched = {
        svcProviderType: true,
        vendorCategory: true,
        svcDrdoVendorLabs: true,
        isExistingDrdoVendor: true,
        drdoRegistrationNumber: true,
        drdoCertificateFile: true,
        enterpriseClassification: true,
        dpiitRegistrationNumber: true,
        dpiitCertificateFile: true,
        udyamRegistrationNumber: true,
        udyamCertificateFile: true,
        incorporationCertificateFile: true,
        cin: true,
        enterpriseName: true,
        registeredOfficeAddress: true,
        registeredOfficeState: true,
        registeredOfficeDistrict: true,
        registeredOfficePincode: true,
        registeredOfficeMobile: true,
        registeredOfficeEmail: true,
        registeredOfficeAlternateEmail: true,
        registeredOfficeLandline: true,
        unitAddress: true,
        unitName: true,
        unitState: true,
        unitDistrict: true,
        unitPincode: true,
        unitMobile: true,
        unitEmail: true,
        unitAlternateEmail: true,
        unitLandline: true,
        unitCommencementDate: true,
        siteExteriorPhoto: true,
        contactPersonName: true,
        contactPersonDesignation: true,
        contactPersonMobile: true,
        contactPersonEmail: true,
      };
      formik.setTouched(touched, false);
    } else if (activeStep === 1) {
      const touched = {
        ownershipType: true,
        maleEmployeesCount: true,
        femaleEmployeesCount: true,
        otherEmployeesCount: true,
        hasGst: true,
        gstNumber: true,
        gstCertificateFile: true,
        hasGovtRegistration: true,
        govtOrganisationName: true,
        govtRegistrationCertificate: true,
        dpiitRegistrationNumber: true,
        dpiitCertificateFile: true,
        udyamRegistrationNumber: true,
        udyamCertificateFile: true,
        incorporationCertificateFile: true,
        cin: true,
      };
      formik.setTouched(touched, false);
    } else if (activeStep === 2) {
      const svcServices = Array.isArray(formik.values.svcServices) ? formik.values.svcServices : [];
      const customers = Array.isArray(formik.values.customers) ? formik.values.customers : [];
      const svcKeyProcesses = Array.isArray(formik.values.svcKeyProcesses) ? formik.values.svcKeyProcesses : [];
      const svcOutsourcedProcesses = Array.isArray(formik.values.svcOutsourcedProcesses) ? formik.values.svcOutsourcedProcesses : [];
      const svcKeyResources = Array.isArray(formik.values.svcKeyResources) ? formik.values.svcKeyResources : [];

      const touched = {
        svcServices: svcServices.map(() => ({
          serviceName: true,
          totalServicesCapacity: true,
          capacityUnit: true,
          currentUtilizedCapacity: true,
          commencementDate: true,
          isExported: true,
          exportCountries: true,
          exportPercentage: true,
        })),
        customers: customers.map(() => ({
          customerName: true,
          customerType: true,
          country: true,
        })),
        svcKeyProcesses: svcKeyProcesses.map(() => ({ processName: true })),
        svcOutsourcedProcesses: svcOutsourcedProcesses.map(() => ({ processName: true })),
        svcKeyResources: svcKeyResources.map(() => ({ resourceName: true, isImported: true, importCountry: true, importPercentage: true })),
        svcOutsourcedComponents: Array.isArray(formik.values.svcOutsourcedComponents)
          ? formik.values.svcOutsourcedComponents.map(() => ({ componentName: true, isImported: true, importCountry: true, importPercentage: true }))
          : [],
      };
      formik.setTouched(touched, false);
    } else if (activeStep === 3) {
      const touched = {
        thirdPartyCertifications: true,
        isBlacklisted: true,
        blacklistedOrganizations: true,
        hasOngoingEnquiry: true,
        informationTrueAgreement: true,
        applicationAcceptanceAgreement: true,
      };
      formik.setTouched(touched, false);
    }

    // Build the values to validate against the step schema. For step 2 we also filter out
    // UI placeholder rows (empty service/customer/resource/component rows) so Yup's min()/required
    // checks run against actual user data rather than placeholder entries.
    let valuesToValidate = formik.values;

    // Step 2 (services): validate the FULL form in a single pass so every error — empty names,
    // duplicates, customer location/country, capacities, percentages, etc. — surfaces together on
    // one click, instead of the old cascade that revealed errors one at a time. The bound step
    // schema already enforces required/unique/conditional rules, so we lean on it rather than
    // re-implementing each check manually.
    if (activeStep === 2) {
      // Filtered copy (placeholder rows with no name removed) used only to decide whether the
      // either/or "Key Service Resource OR Outsourced Component" requirement is satisfied.
      valuesToValidate = { ...formik.values };
      if (Array.isArray(valuesToValidate.svcServices)) {
        valuesToValidate.svcServices = valuesToValidate.svcServices.filter(s => (s?.serviceName || '').toString().trim() !== '');
      }
      if (Array.isArray(valuesToValidate.customers)) {
        valuesToValidate.customers = valuesToValidate.customers.filter(c => (c?.customerName || '').toString().trim() !== '');
      }
      if (Array.isArray(valuesToValidate.svcKeyResources)) {
        valuesToValidate.svcKeyResources = valuesToValidate.svcKeyResources.filter(r => (r?.resourceName || r?.resource || '').toString().trim() !== '');
      }
      if (Array.isArray(valuesToValidate.svcOutsourcedComponents)) {
        valuesToValidate.svcOutsourcedComponents = valuesToValidate.svcOutsourcedComponents.filter(c => (c?.componentName || c?.resourceName || '').toString().trim() !== '');
      }

      // Validate the full values (touched was already set above) so all field errors are collected.
      const allErrors = await formik.validateForm();

      const hasValidResources = Array.isArray(valuesToValidate.svcKeyResources) && valuesToValidate.svcKeyResources.length > 0;
      const hasValidOutsourced = Array.isArray(valuesToValidate.svcOutsourcedComponents) && valuesToValidate.svcOutsourcedComponents.length > 0;
      const hasAnyResourceRow = Array.isArray(formik.values.svcKeyResources) && formik.values.svcKeyResources.length > 0;
      const hasAnyOutsourcedRow = Array.isArray(formik.values.svcOutsourcedComponents) && formik.values.svcOutsourcedComponents.length > 0;

      // The schema marks svcKeyResources as required, but only ONE of resources/outsourced is needed.
      if (hasValidResources || hasValidOutsourced) {
        // Requirement satisfied via either side — drop the array-level required/min() false-positive.
        if (typeof allErrors.svcKeyResources === 'string') {
          delete allErrors.svcKeyResources;
        }
      } else if (!hasAnyResourceRow && !hasAnyOutsourcedRow) {
        // Nothing added on either side — show the combined either/or message rather than the raw min() error.
        if (typeof allErrors.svcKeyResources === 'string') {
          delete allErrors.svcKeyResources;
        }
        if (typeof allErrors.svcOutsourcedComponents === 'string') {
          delete allErrors.svcOutsourcedComponents;
        }
        allErrors.rawOrBought = 'You must add at least one Key Service Resource or Outsourced Service Component.';
      }
      // (If rows exist but none are valid yet, the per-row "name required" errors guide the user.)

      // Apply the adjusted errors in all cases — validateForm() above already set the raw errors on
      // state, so this also clears the either/or false-positive when the step actually passes.
      formik.setErrors(allErrors);

      if (Object.keys(allErrors).length > 0) {
        if (allErrors.rawOrBought) {
          formik.setFieldTouched('rawOrBought', true, false);
        }
        focusFirstErrorField(allErrors);
        Logger.error('Step 2 validation errors:', allErrors);
        return;
      }
    }

    // Validate the current step's schema against the (possibly filtered) values.
    // Step 2 was already fully validated above (single-pass), so skip the re-check here to avoid
    // re-introducing the either/or false-positive on filtered values.
    const errors =
      activeStep === 2
        ? {}
        : await getStepSchema(activeStep)
            .validate(valuesToValidate, { abortEarly: false })
            .then(() => ({}))
            .catch(err => {
              const errorObj = {};
              if (err && Array.isArray(err.inner)) {
                err.inner.forEach(e => {
                  errorObj[e.path] = e.message;
                });
                Logger.error('Validation Errors for Step', activeStep, ':', errorObj);
              } else {
                Logger.error('Validation error caught but no `inner` array:', err);
                if (err && err.message) {
                  errorObj._error = err.message;
                }
              }
              try {
                Logger.error('Full Form Values:', JSON.stringify(formik.values, null, 2));
              } catch (_e) {
                Logger.error('Failed to stringify form values for logging');
              }
              return errorObj;
            });
    if (Object.keys(errors)?.length === 0) {
      // Track whether step submission succeeded (like ManufacturingSteps)
      let stepSubmissionSuccess = true;

      // Reuse existing per-step submission logic below
      if (activeStep === 0) {
        const step0Fields = [
          'applicationType',
          'isExistingDrdoVendor',
          'svcProviderType',
          'vendorCategory',
          'svcDrdoVendorLabs',
          'drdoRegistrationNumber',
          'enterpriseClassification',
          'udyamRegistrationNumber',
          'udyamCertificateFile',
          'dpiitRegistrationNumber',
          'dpiitCertificateFile',
          'incorporationCertificateFile',
          'cin',
          'drdoCertificateFile',
          'enterpriseClassification',
          'enterpriseName',
          'registeredOfficeAddress',
          'registeredOfficeState',
          'registeredOfficeDistrict',
          'registeredOfficePincode',
          'registeredOfficeMobile',
          'registeredOfficeLandline',
          'registeredOfficeEmail',
          'registeredOfficeAlternateEmail',
          'unitAddress',
          'unitName',
          'unitState',
          'unitDistrict',
          'unitPincode',
          'unitMobile',
          'unitLandline',
          'unitEmail',
          'unitAlternateEmail',
          'unitCommencementDate',
          'siteExteriorPhoto',
          'contactPersonName',
          'contactPersonDesignation',
          'contactPersonMobile',
          'contactPersonEmail',
        ];
        const step0Data = { ...stepDataRef.current };
        step0Fields.forEach(key => {
          step0Data[key] = formik.values[key] !== undefined && formik.values[key] !== '' ? formik.values[key] : initialFormValues[key];
        });
        const res0 = await submitStepData(dispatch, initialFormValues, step0Data);
        if (!res0) {
          stepSubmissionSuccess = false;
        }
        stepDataRef.current = { ...step0Data };
      }
      if (activeStep === 1) {
        const step1ApiFields = [
          'ownershipType',
          'maleEmployeesCount',
          'femaleEmployeesCount',
          'otherEmployeesCount',
          'hasGst',
          'gstNumber',
          'gstCertificateFile',
          'hasGovtRegistration',
          'govtOrganisationName',
          'govtRegistrationCertificate',
          'dpiitRegistrationNumber',
          'dpiitCertificateFile',
          'udyamRegistrationNumber',
          'udyamCertificateFile',
          'incorporationCertificateFile',
          'cin',
        ];
        const apiStep1Data = { ...stepDataRef.current };
        const uiStep1Data = { ...stepDataRef.current };
        step1ApiFields.forEach(key => {
          // hasGst / hasGovtRegistration ride the RadioGroups as 'yes'/'no' but the API takes
          // booleans. stepDataRef feeds every later step's payload too, so the UI copy must
          // hold the boolean as well — a leftover 'yes' string would 422 those steps.
          const value = key === 'hasGst' || key === 'hasGovtRegistration' ? formik.values[key] === 'yes' : formik.values[key];
          apiStep1Data[key] = value;
          uiStep1Data[key] = value;
        });
        const res1 = await submitStepData(dispatch, combinedData, apiStep1Data);
        if (!res1) {
          stepSubmissionSuccess = false;
        } else if (gstWarningRef.current) {
          // Draft saved, but the GSTIN is inconsistent with the org PAN/registered state.
          // Keep the user on the GST step to resolve it before proceeding (submit is the
          // hard gate). The inline error is already pinned on the gstNumber field.
          stepSubmissionSuccess = false;
          formik.setFieldError('gstNumber', gstWarningRef.current.message);
          formik.setFieldTouched('gstNumber', true, false);
        }
        stepDataRef.current = { ...uiStep1Data };
      }
      if (activeStep === 2) {
        const step2Fields = ['svcServices', 'customers', 'svcKeyProcesses', 'svcOutsourcedProcesses', 'svcKeyResources', 'svcOutsourcedComponents'];
        Logger.info('Submitting Step 2 with fields:', step2Fields);
        const step2Data = { ...stepDataRef.current };
        step2Fields.forEach(key => {
          step2Data[key] = combinedData[key];
        });
        step2Fields.forEach(key => {
          if (key === 'svcKeyProcesses' || key === 'svcOutsourcedProcesses') {
            step2Data[key] = (formik.values[key] || []).map(p => ({ processName: typeof p === 'string' ? p : p.processName || '' }));
          } else if (key === 'svcServices') {
            step2Data[key] = formik.values[key];
          } else {
            step2Data[key] = formik.values[key];
          }
        });
        const res2 = await submitStepData(dispatch, combinedData, step2Data);
        if (!res2) {
          stepSubmissionSuccess = false;
        }
        stepDataRef.current = { ...step2Data };
      }
      if (activeStep === 3) {
        const step3Fields = ['thirdPartyCertifications', 'isBlacklisted', 'blacklistedOrganizations', 'hasOngoingEnquiry', 'informationTrueAgreement', 'applicationAcceptanceAgreement'];
        const step3Data = { ...stepDataRef.current };
        step3Fields.forEach(key => {
          if (key === 'isBlacklisted' || key === 'hasOngoingEnquiry') {
            step3Data[key] = formik.values[key] === 'yes';
          } else {
            step3Data[key] = formik.values[key];
          }
        });
        const res3 = await submitStepData(dispatch, combinedData, step3Data);
        if (!res3) {
          stepSubmissionSuccess = false;
        }
        stepDataRef.current = { ...step3Data };
      }

      // Only advance to next step if submission was successful
      if (stepSubmissionSuccess) {
        setActiveStep(prev => prev + 1);
      }
      // Note: Toast is already shown in submitStepData on failure
    } else {
      // For step 2, use formik.validateForm to set errors in the correct nested structure
      if (activeStep === 2) {
        const validationErrors = await formik.validateForm();
        formik.setErrors(validationErrors);
        // Focus first errored field
        focusFirstErrorField(validationErrors);
      } else {
        // Set errors for other steps
        formik.setErrors(errors);
        formik.setTouched(
          Object.keys(getStepSchema(activeStep).fields).reduce((acc, key) => {
            acc[key] = true;
            return acc;
          }, {}),
        );
        // Focus first errored field
        focusFirstErrorField(errors);
      }
    }
  };
  const handleBack = () => setActiveStep(prev => prev - 1);

  // Live GSTIN ↔ PAN/state consistency check on blur, surfaced inline like the format rule.
  // Validated server-side (authoritative — the same rule the submit gate uses) against the
  // caller's organisation. Skipped until the value is a well-formed GSTIN (format rule owns that).
  const handleGstBlur = async () => {
    formik.setFieldTouched('gstNumber', true);
    const gst = (formik.values.gstNumber || '').trim().toUpperCase();
    if (formik.values.hasGst !== 'yes' || !gstNumberRegex.test(gst)) {
      return;
    }
    try {
      const res = await dispatch(validateGstinAction(gst)).unwrap();
      formik.setFieldError('gstNumber', res?.data?.valid ? undefined : res?.data?.message || '');
    } catch {
      // Best-effort inline check; on network/validation failure stay silent (submit still gates).
    }
  };

  // Submit step data to the server (creates/updates draft)
  const submitStepData = async (dispatch, prevData, stepData, options = {}) => {
    const { isAutosave = false } = options;
    const mergedData = { ...prevData, ...stepData };

    // Coalesce the first-time draft create: if another save is already creating the draft and we
    // have no id yet, wait for it so this save UPDATES the new draft instead of firing a second
    // create (which the backend rejects with 409 "draft already exists").
    if (!applicationIdRef.current && !currentApplicationId && creationPromiseRef.current) {
      try {
        await creationPromiseRef.current;
      } catch (_e) {
        // If the in-flight create failed, fall through and let this save attempt creation.
      }
    }

    // Backend requires Y-m-d; values loaded from an existing draft may arrive with a time component.
    if (mergedData.unitCommencementDate) {
      const parsed = dayjs(mergedData.unitCommencementDate);
      if (parsed.isValid()) {
        mergedData.unitCommencementDate = parsed.format('YYYY-MM-DD');
      }
    }

    // Skip during autosave: re-hydrating arrays from combinedData on every blur would churn the form.
    if (!isAutosave) {
      setCombinedData(mergedData);
    }

    // Remove empty placeholder entries similar to ManufacturingSteps
    try {
      // Filter svcServices and customers
      if (Array.isArray(mergedData.svcServices)) {
        mergedData.svcServices = mergedData.svcServices.filter(s => (s?.serviceName || '').toString().trim() !== '');
      }
      if (Array.isArray(mergedData.customers)) {
        mergedData.customers = mergedData.customers.filter(c => (c?.customerName || '').toString().trim() !== '');
      }

      // Normalize processes to objects with processName field (backend expects process_name)
      if (Array.isArray(mergedData.svcKeyProcesses)) {
        mergedData.svcKeyProcesses = mergedData.svcKeyProcesses.map(p => ({ processName: typeof p === 'string' ? p : p?.processName || '' })).filter(p => p.processName);
      }
      if (Array.isArray(mergedData.svcOutsourcedProcesses)) {
        mergedData.svcOutsourcedProcesses = mergedData.svcOutsourcedProcesses.map(p => ({ processName: typeof p === 'string' ? p : p?.processName || '' })).filter(p => p.processName);
      }

      // Helper to safely extract first meaningful string from various shapes
      const extractFirstString = val => {
        if (Array.isArray(val)) {
          for (const v of val) {
            if (v === null || v === undefined) {
              continue;
            }
            try {
              if (typeof v === 'string') {
                const parsed = JSON.parse(v);
                if (Array.isArray(parsed)) {
                  const found = parsed.find(x => x !== null && x !== undefined && String(x).trim() !== '');
                  if (found) {
                    return String(found).trim();
                  }
                }
                if (typeof parsed === 'string') {
                  return parsed.trim();
                }
              }
            } catch (_e) {
              // not JSON - fallthrough to string handling
            }
            const s = String(v).trim();
            if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
              return s.slice(1, -1).trim();
            }
            if (s !== '') {
              return s;
            }
          }
          return '';
        }
        if (typeof val === 'string') {
          const s = val.trim();
          // Try parse JSON (covers '"Name"' or '["Name"]' or '"[\"Name\"]"')
          try {
            const parsed = JSON.parse(s);
            if (Array.isArray(parsed)) {
              const found = parsed.find(v => v !== null && v !== undefined && String(v).toString().trim() !== '');
              return found ? String(found).trim() : '';
            }
            if (typeof parsed === 'string') {
              return parsed.trim();
            }
          } catch (_e) {
            // not JSON - fallthrough
          }
          // Strip surrounding quotes if present
          if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
            return s.slice(1, -1).trim();
          }
          return s;
        }
        return '';
      };

      // Normalize key resources and deduplicate by resourceName
      if (Array.isArray(mergedData.svcKeyResources)) {
        const normalized = mergedData.svcKeyResources
          .map(r => {
            const name = extractFirstString(r.resourceName || r.resource || '');
            return {
              resourceName: name,
              isImported: r.isImported === true || r.isImported === 'true',
              importCountry: r.importCountry || '',
              importPercentage: r.importPercentage || '',
            };
          })
          .filter(r => r.resourceName);
        // Deduplicate
        const uniq = [];
        const seen = new Set();
        normalized.forEach(r => {
          const key = r.resourceName.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            uniq.push(r);
          }
        });
        mergedData.svcKeyResources = uniq;
      }

      // Normalize outsourced components and deduplicate by componentName
      if (Array.isArray(mergedData.svcOutsourcedComponents)) {
        const normalizedComp = mergedData.svcOutsourcedComponents
          .map(c => {
            const name = extractFirstString(c.componentName || c.resourceName || c.name || '');
            return {
              componentName: name,
              isImported: c.isImported === 'yes' || c.isImported === true || c.isImported === 'true',
              importCountry: c.importCountry || '',
              importPercentage: c.importPercentage || '',
            };
          })
          .filter(c => c.componentName);
        const uniqC = [];
        const seenC = new Set();
        normalizedComp.forEach(c => {
          const key = c.componentName.toLowerCase();
          if (!seenC.has(key)) {
            seenC.add(key);
            uniqC.push(c);
          }
        });
        mergedData.svcOutsourcedComponents = uniqC;
      }
      // Remove empty arrays so API doesn't receive empty lists
      ['svcServices', 'customers', 'svcKeyProcesses', 'svcOutsourcedProcesses', 'svcKeyResources', 'svcOutsourcedComponents'].forEach(key => {
        if (Array.isArray(mergedData[key]) && mergedData[key].length === 0) {
          delete mergedData[key];
        }
      });
    } catch (err) {
      Logger.error('Error normalizing mergedData arrays', err);
    }

    // Include applicationId so we update the existing draft instead of creating a new one. The ref
    // holds the freshest id (updated synchronously after each save) so back-to-back autosaves can't
    // duplicate the draft.
    const effectiveApplicationId = applicationIdRef.current || currentApplicationId;
    if (effectiveApplicationId) {
      mergedData.applicationId = effectiveApplicationId;
    }

    // Remove UI-only fields
    if (Object.hasOwn(mergedData, 'isSameAsRegistered')) {
      delete mergedData.isSameAsRegistered;
    }

    // Normalize employee counts to integers to satisfy server integer validation
    try {
      const toInt = v => {
        const n = parseNumericOrNull(v);
        return n === null ? null : Math.floor(Number(n));
      };
      if (mergedData.maleEmployeesCount !== undefined) {
        mergedData.maleEmployeesCount = toInt(mergedData.maleEmployeesCount);
      }
      if (mergedData.femaleEmployeesCount !== undefined) {
        mergedData.femaleEmployeesCount = toInt(mergedData.femaleEmployeesCount);
      }
      if (mergedData.otherEmployeesCount !== undefined) {
        mergedData.otherEmployeesCount = toInt(mergedData.otherEmployeesCount);
      }
      if (mergedData.totalEmployees !== undefined) {
        mergedData.totalEmployees = toInt(mergedData.totalEmployees);
      }
    } catch (err) {
      Logger.error('Error normalizing employee counts', err);
    }

    // Normalize blacklistedOrganizations to a plain comma-separated string
    try {
      if (Object.hasOwn(mergedData, 'blacklistedOrganizations')) {
        const raw = mergedData.blacklistedOrganizations;
        Logger.debug?.('blacklistedOrganizations before normalization (services):', { value: raw, type: typeof raw });

        const normalizeList = r => {
          if (r == null) {
            return '';
          }
          if (Array.isArray(r)) {
            return r
              .map(item => {
                if (typeof item === 'string') {
                  const s = item.trim();
                  try {
                    const parsed = JSON.parse(s);
                    return typeof parsed === 'string' ? parsed.trim() : String(parsed).trim();
                  } catch (_e) {
                    return s.replace(/^"|"$/g, '').trim();
                  }
                }
                return String(item).trim();
              })
              .filter(Boolean)
              .join(',');
          }
          if (typeof r === 'string') {
            const s = r.trim();
            if (s.startsWith('[') && s.endsWith(']')) {
              try {
                const parsed = JSON.parse(s);
                if (Array.isArray(parsed)) {
                  return parsed
                    .map(p => (typeof p === 'string' ? p.trim().replace(/^"|"$/g, '') : String(p).trim()))
                    .filter(Boolean)
                    .join(',');
                }
              } catch (_e) {
                // fallthrough
              }
            }
            return s
              .split(',')
              .map(x => x.trim().replace(/^"|"$/g, ''))
              .filter(Boolean)
              .join(',');
          }
          return String(r).trim();
        };

        const cleaned = normalizeList(raw);
        mergedData.blacklistedOrganizations = cleaned;
        Logger.debug?.('blacklistedOrganizations after normalization (services):', { value: cleaned, type: typeof cleaned });
      }
    } catch (err) {
      Logger.error?.('Error normalizing blacklistedOrganizations (services):', err);
    }

    // Also normalize numeric fields inside svcServices to plain numbers
    try {
      if (Array.isArray(mergedData.svcServices)) {
        mergedData.svcServices = mergedData.svcServices.map(s => {
          const total = parseNumericOrNull(s.totalServicesCapacity);
          const current = parseNumericOrNull(s.currentUtilizedCapacity);
          const supply = parseNumericOrNull(s.exportPercentage);
          return {
            ...s,
            totalServicesCapacity: total === null ? null : Number(total),
            currentUtilizedCapacity: current === null ? null : Number(current),
            exportPercentage: supply === null ? null : Number(supply),
            capacityUnit: s.capacityUnit && String(s.capacityUnit).trim() !== '' ? s.capacityUnit : capacityUnit,
          };
        });
      }
    } catch (err) {
      Logger.error('Error normalizing svcServices numeric fields', err);
    }

    // Stamp each picture with the upload geolocation + timestamp and send the
    // same values alongside the file, mirroring the mobile capture flow.
    // Geolocation is best-effort: on denial the upload proceeds with null coords.
    // Files appended by this save are recorded as stored only once it succeeds, so a failed save
    // never stops the next one from re-sending them. On an autosave a file an earlier save already
    // stored is skipped, so the same bytes - and the location prompt - are never asked for twice.
    const uploadMetadata = [];
    const filesSentThisSave = {};
    const pendingFiles = FILE_FIELDS.filter(k => typeof File !== 'undefined' && mergedData[k] instanceof File && (!isAutosave || autosavedFilesRef.current[k] !== mergedData[k]));
    if (pendingFiles.length > 0) {
      const coords = await getPosition();
      const uploadedAt = new Date().toISOString();
      for (const key of pendingFiles) {
        filesSentThisSave[key] = mergedData[key];
        mergedData[key] = await applyImageWatermark(mergedData[key], { latitude: coords?.latitude, longitude: coords?.longitude, timestamp: uploadedAt });
        if (coords) {
          uploadMetadata.push([`${key}Latitude`, String(coords.latitude)], [`${key}Longitude`, String(coords.longitude)]);
        }
        uploadMetadata.push([`${key}CapturedAt`, uploadedAt]);
      }
    }

    const formData = new FormData();
    uploadMetadata.forEach(([key, value]) => formData.append(key, value));
    Object.entries(mergedData).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        return;
      }

      // Ensure blacklistedOrganizations is always appended as a plain string
      if (key === 'blacklistedOrganizations') {
        try {
          const v = typeof value === 'string' ? value : JSON.stringify(value);
          formData.append(key, String(v));
          Logger.debug?.('FormData append (services) - blacklistedOrganizations:', String(v));
        } catch (_err) {
          formData.append(key, String(value));
          Logger.debug?.('FormData append (services) - blacklistedOrganizations (fallback):', String(value));
        }
        return;
      }

      // hasGst / hasGovtRegistration are tri-state: send a real boolean once answered and omit
      // the field entirely while unanswered, so the stored null stays null.
      if (key === 'hasGst' || key === 'hasGovtRegistration') {
        if (value === true || value === false || value === 'yes' || value === 'no') {
          formData.append(key, JSON.stringify(value === true || value === 'yes'));
        }
        return;
      }

      // Normalize boolean-like fields to actual booleans
      if (['isExistingDrdoVendor', 'isBlacklisted', 'hasOngoingEnquiry'].includes(key)) {
        const boolVal = value === true || value === 'yes' || value === 'true';
        formData.append(key, JSON.stringify(boolVal));
        return;
      }

      // File fields - only the ones picked up as pending above are sent. URL strings (from
      // existing uploads) are skipped so the stored path survives.
      if (FILE_FIELDS.includes(key)) {
        if (typeof File !== 'undefined' && value instanceof File && pendingFiles.includes(key)) {
          formData.append(key, value);
        }
        return;
      }

      // Arrays and objects should be serialized
      if (Array.isArray(value) || typeof value === 'object') {
        try {
          formData.append(key, JSON.stringify(value));
        } catch (_err) {
          formData.append(key, String(value));
        }
        return;
      }

      // Primitives
      formData.append(key, String(value));
    });

    // Log readable payload (avoid binary contents). Include file metadata to help debugging.
    try {
      const logPayload = { ...mergedData };
      Object.keys(logPayload).forEach(k => {
        const v = logPayload[k];
        if (typeof File !== 'undefined' && v instanceof File) {
          logPayload[k] = { fileName: v.name, size: v.size, type: v.type };
        }
      });
      Logger.debug?.('Submitting FormData (serialized)', logPayload);
    } catch (err) {
      Logger.error?.('Error serializing submission payload', err);
    }

    const dispatchPromise = dispatch((isAutosave ? autosaveServiceApplicationAction : createServiceApplicationAction)(formData));
    // Register the first-create so concurrent saves coalesce onto it (see guard above).
    const isCreate = !effectiveApplicationId;
    if (isCreate) {
      creationPromiseRef.current = dispatchPromise;
    }
    let result;
    try {
      result = await dispatchPromise;
    } finally {
      if (isCreate && creationPromiseRef.current === dispatchPromise) {
        creationPromiseRef.current = null;
      }
    }

    // Capture the created/updated draft id synchronously so a trailing autosave or the next
    // step-save updates the same draft instead of creating a duplicate.
    const savedId = result?.payload?.data?.id ?? result?.payload?.id ?? null;
    if (savedId) {
      applicationIdRef.current = savedId;
    }

    // When create action is fulfilled, result.payload will be present and result.error undefined
    if (result && !result?.error) {
      Object.assign(autosavedFilesRef.current, filesSentThisSave);
      // Non-blocking GSTIN consistency result (Option B): the draft always persists; we
      // pin the message on the GST field and let handleNext gate advancement past it.
      const gstWarning = result?.payload?.gstWarning ?? result?.payload?.data?.gstWarning ?? null;
      gstWarningRef.current = gstWarning;
      if (gstWarning) {
        formik.setFieldError('gstNumber', gstWarning.message);
        formik.setFieldTouched('gstNumber', true, false);
      }
      return mergedData;
    }

    // Autosave fails quietly - the Saving/Saved indicator reflects status; no toast.
    if (isAutosave) {
      return false;
    }

    // If rejected, the thunk returns an action whose `payload` contains the server response
    // (shape: { success: false, message: "...", errors?: { field: [msg, ...] } })
    try {
      const payload = result?.payload ?? result?.error?.message ?? null;

      if (payload && typeof payload === 'object') {
        const serverMessage = payload.message || payload?.data?.message || null;
        const serverErrors = payload.errors || payload?.data?.errors || null;

        // Prefer a specific field-level validation message if present, otherwise the top-level message
        let toastText = serverMessage;
        if (serverErrors && typeof serverErrors === 'object') {
          const firstKey = Object.keys(serverErrors)[0];
          const firstMsg = firstKey ? (Array.isArray(serverErrors[firstKey]) ? serverErrors[firstKey][0] : serverErrors[firstKey]) : null;
          if (firstMsg) {
            toastText = firstMsg;
          }
        }

        if (toastText) {
          const friendly = humanizeApplicationInProgressError(toastText);
          setToastMessage(friendly);
          toastError(friendly, { duration: 9000 });
          return false;
        }
      }

      if (typeof payload === 'string' && payload.trim()) {
        const friendly = humanizeApplicationInProgressError(payload);
        setToastMessage(friendly);
        toastError(friendly, { duration: 9000 });
        return false;
      }
    } catch (err) {
      Logger.error('Error handling create application error payload', err);
    }

    setToastMessage('Unable to save your draft. Please try again.');
    toastError('Unable to save your draft. Please try again.', { duration: 9000 });
    return false;
  };

  // NOTE: The old handleSubmit function has been replaced by step-by-step submission via submitStepData
  // Form data is now submitted incrementally on each step transition in handleNext

  // Handle draft creation errors (step transitions are handled in handleNext)
  useEffect(() => {
    if (createServiceApplicationError) {
      setToastMessage(createServiceApplicationError.message || 'An error occurred while saving the application.');
    }
  }, [createServiceApplicationError]);

  // Handle submit success/error
  useEffect(() => {
    if (submitServiceApplicationError) {
      const gstMsg = submitServiceApplicationError?.errors?.gstNumber?.[0];
      setToastMessage(gstMsg || submitServiceApplicationError.message || 'An error occurred while submitting the application.');
      setShowSubmitModal(false);
      // GSTIN consistency failure (backend 422): the GSTIN is the only input to this check
      // that is editable in this wizard (org PAN + registered state live in the Organisation
      // profile, not here), so always pin on the GST field and land on the GST step. The
      // pan_required / pan_mismatch messages themselves point the user to the Organisation profile.
      if (gstMsg) {
        formik.setFieldTouched('gstNumber', true, false);
        formik.setFieldError('gstNumber', gstMsg);
        setActiveStep(1);
      }
    }
    if (submitServiceApplication) {
      Logger.info('Application submitted successfully:', submitServiceApplication);
      handleCloseSubmitModal();
      setShowSuccessModal(true);
      dispatch(resetSubmitServiceApplication());
      dispatch(getApplicationAction({ status: null, type: null, q: null, perPage: 10, page: 1 }));
    }
  }, [submitServiceApplication, submitServiceApplicationError, dispatch]);

  // Handle success modal continue button
  const handleSuccessModalContinue = () => {
    setShowSuccessModal(false);
    navigation('/applications');
  };

  // Country options derived from Redux - using name as value for immutable storage
  const countryOptions = useMemo(() => {
    if (!countries) {
      return [];
    }
    return countries.map(c => ({ value: c.name || '', label: c.name || '' }));
  }, [countries]);

  const getFieldError = fieldPath => {
    const pathParts = fieldPath.split('.');
    let error = formik.errors;
    let touched = formik.touched;
    for (const part of pathParts) {
      if (error && error[part] !== undefined) {
        error = error[part];
      } else {
        error = undefined;
      }
      if (touched && touched[part] !== undefined) {
        touched = touched[part];
      } else {
        touched = undefined;
      }
    }
    return touched && error ? error : undefined;
  };

  const handleOpenImagePreview = imageUrl => {
    setImagePreviewSrc(imageUrl);
    setImagePreviewOpen(true);
  };

  const handleCopyFromRegisteredOffice = () => {
    try {
      formik.setValues({
        ...formik.values,
        unitAddress: formik.values.registeredOfficeAddress || '',
        unitState: formik.values.registeredOfficeState || '',
        unitDistrict: formik.values.registeredOfficeDistrict || '',
        unitPincode: formik.values.registeredOfficePincode || '',
      });
      markUnitPincodeApplied(formik.values.registeredOfficePincode || '');
    } catch (err) {
      Logger.error('Error copying registered office to unit fields', err);
    }
  };
  const handleInformationTrueAgreementChange = () => {
    formik.setFieldValue('informationTrueAgreement', !formik.values.informationTrueAgreement);
  };
  const handleApplicationAcceptanceAgreementChange = () => {
    formik.setFieldValue('applicationAcceptanceAgreement', !formik.values.applicationAcceptanceAgreement);
  };

  const handleServiceProviderTypeChange = e => {
    const { value } = e.target;
    formik.setFieldValue('svcProviderType', value);

    // Clear all service provider type-related fields
    formik.setFieldValue('vendorCategory', '');
    formik.setFieldValue('svcDrdoVendorLabs', []);

    // Set touched state to false to clear validation errors
    formik.setFieldTouched('vendorCategory', false);
    formik.setFieldTouched('svcDrdoVendorLabs', false);
  };

  const handleEnterpriseClassificationChange = e => {
    const { value } = e.target;
    formik.setFieldValue('enterpriseClassification', value);

    // Clear all classification-related fields first
    formik.setFieldValue('dpiitRegistrationNumber', '');
    formik.setFieldValue('dpiitCertificateFile', null);
    formik.setFieldValue('udyamRegistrationNumber', '');
    formik.setFieldValue('udyamCertificateFile', null);
    formik.setFieldValue('incorporationCertificateFile', null);
    formik.setFieldValue('cin', '');

    // Set touched state to false to clear validation errors
    formik.setFieldTouched('dpiitRegistrationNumber', false);
    formik.setFieldTouched('dpiitCertificateFile', false);
    formik.setFieldTouched('udyamRegistrationNumber', false);
    formik.setFieldTouched('udyamCertificateFile', false);
    formik.setFieldTouched('incorporationCertificateFile', false);
    formik.setFieldTouched('cin', false);
  };

  // Memoize initialValues to keep referential stability and avoid Formik re-initialization
  const memoizedInitialValues = useMemo(() => {
    return {
      // Use initialFormValues for these fields if present, else fallback to defaults
      applicationType: initialFormValues.applicationType ?? 'new',
      previousApplicationId: initialFormValues.previousApplicationId ?? null,
      unitId: initialFormValues.unitId ?? '',
      svcProviderType: initialFormValues.svcProviderType ?? '',
      isExistingDrdoVendor:
        initialFormValues.isExistingDrdoVendor === true || initialFormValues.isExistingDrdoVendor === 'yes'
          ? 'yes'
          : initialFormValues.isExistingDrdoVendor === false || initialFormValues.isExistingDrdoVendor === 'no'
            ? 'no'
            : '',
      vendorCategory: initialFormValues.vendorCategory ?? '',
      // Services only - vendor labs (array of objects like manufacturing stores)
      svcDrdoVendorLabs: initialFormValues.svcDrdoVendorLabs?.length > 0 ? initialFormValues.svcDrdoVendorLabs.map(l => (typeof l === 'string' ? { labName: l } : l)) : [],
      drdoRegistrationNumber: initialFormValues.drdoRegistrationNumber ?? '',
      drdoCertificateFile: initialFormValues.drdoCertificateFile ?? null,
      enterpriseClassification: initialFormValues.enterpriseClassification ?? '',
      dpiitRegistrationNumber: initialFormValues.dpiitRegistrationNumber ?? '',
      dpiitCertificateFile: initialFormValues.dpiitCertificateFile ?? null,
      udyamRegistrationNumber: initialFormValues.udyamRegistrationNumber ?? '',
      udyamCertificateFile: initialFormValues.udyamCertificateFile ?? null,
      incorporationCertificateFile: initialFormValues.incorporationCertificateFile ?? null,
      cin: initialFormValues.cin ?? '',

      // Note: API returns camelCase on wire
      svcKeyResources:
        initialFormValues.svcKeyResources?.length > 0
          ? initialFormValues.svcKeyResources.map(r => ({
              ...r,
              resourceName: Array.isArray(r.resourceName) ? r.resourceName[0] || '' : r.resourceName ? String(r.resourceName) : '',
              isImported: r.isImported === true || r.isImported === 'yes' || r.isImported === 'true' ? true : r.isImported === false || r.isImported === 'no' || r.isImported === 'false' ? false : '',
              importCountry: r.importCountry ?? '',
              importPercentage: r.importPercentage ?? '',
            }))
          : [],
      organizationId: user?.organization?.id || '',
      enterpriseName: initialFormValues.enterpriseName ?? currentOrganization?.name ?? '',
      registeredOfficeAddress: initialFormValues.registeredOfficeAddress ?? currentOrganization?.registeredAddress ?? '',
      registeredOfficeState: initialFormValues.registeredOfficeState ?? currentOrganization?.registeredState ?? '',
      registeredOfficeDistrict: initialFormValues.registeredOfficeDistrict ?? currentOrganization?.registeredDistrict ?? '',
      registeredOfficeDistrictCode: initialFormValues.registeredOfficeDistrictCode ?? '',
      registeredOfficePincode: initialFormValues.registeredOfficePincode ?? currentOrganization?.registeredPincode ?? '',
      registeredOfficeMobile: initialFormValues.registeredOfficeMobile ?? currentOrganization?.mobileNumber ?? '',
      registeredOfficeLandline: initialFormValues.registeredOfficeLandline ?? currentOrganization?.landlineNumber ?? '',
      registeredOfficeEmail: initialFormValues.registeredOfficeEmail ?? currentOrganization?.ownerEmail ?? '',
      registeredOfficeAlternateEmail: initialFormValues.registeredOfficeAlternateEmail ?? currentOrganization?.alternateEmail ?? '',
      unitAddress: initialFormValues.unitAddress ?? '',
      unitName: initialFormValues.unitName ?? '',
      unitState: initialFormValues.unitState ?? '',
      unitDistrict: initialFormValues.unitDistrict ?? '',
      unitPincode: initialFormValues.unitPincode ?? '',
      unitMobile: initialFormValues.unitMobile ?? '',
      unitLandline: initialFormValues.unitLandline ?? '',
      unitEmail: initialFormValues.unitEmail ?? '',
      unitAlternateEmail: initialFormValues.unitAlternateEmail ?? '',
      isSameAsRegistered: initialFormValues.isSameAsRegistered ?? false,
      unitCommencementDate: initialFormValues.unitCommencementDate ?? '',
      siteExteriorPhoto: initialFormValues.siteExteriorPhoto ?? null,
      contactPersonName: initialFormValues.contactPersonName ?? '',
      contactPersonDesignation: initialFormValues.contactPersonDesignation ?? '',
      contactPersonMobile: initialFormValues.contactPersonMobile ?? '',
      contactPersonEmail: initialFormValues.contactPersonEmail ?? '',
      ownershipType: initialFormValues.ownershipType ?? '',
      totalEmployees: initialFormValues.totalEmployees ?? '',
      maleEmployeesCount: initialFormValues.maleEmployeesCount ?? '',
      femaleEmployeesCount: initialFormValues.femaleEmployeesCount ?? '',
      otherEmployeesCount: initialFormValues.otherEmployeesCount ?? '',
      // Prefer the persisted answer. Legacy drafts saved before these columns existed carry no
      // boolean — infer 'yes' from the value, but leave an absent value blank rather than 'no',
      // so "never answered" stays distinguishable from an answered No.
      hasGst: typeof initialFormValues.hasGst === 'boolean' ? (initialFormValues.hasGst ? 'yes' : 'no') : initialFormValues.gstNumber ? 'yes' : '',
      gstNumber: initialFormValues.gstNumber ?? '',
      gstCertificateFile: initialFormValues.gstCertificateFile ?? null,
      hasGovtRegistration: typeof initialFormValues.hasGovtRegistration === 'boolean' ? (initialFormValues.hasGovtRegistration ? 'yes' : 'no') : initialFormValues.govtOrganisationName ? 'yes' : '',

      govtOrganisationName: initialFormValues.govtOrganisationName ?? '',
      govtRegistrationCertificate: initialFormValues.govtRegistrationCertificate ?? null,

      productionCapacity: initialFormValues.productionCapacity ?? '',
      capacityUnit: initialFormValues.capacityUnit ?? '',
      productionLines: initialFormValues.productionLines ?? '',
      thirdPartyCertifications: initialFormValues.thirdPartyCertifications ?? [],
      svcKeyProcesses: initialFormValues.svcKeyProcesses?.length > 0 ? initialFormValues.svcKeyProcesses.map(p => (typeof p === 'string' ? { processName: p } : p)) : [],
      svcOutsourcedProcesses: initialFormValues.svcOutsourcedProcesses?.length > 0 ? initialFormValues.svcOutsourcedProcesses.map(p => (typeof p === 'string' ? { processName: p } : p)) : [],
      isBlacklisted: typeof initialFormValues.isBlacklisted === 'boolean' ? (initialFormValues.isBlacklisted ? 'yes' : 'no') : (initialFormValues.isBlacklisted ?? ''),
      blacklistedOrganizations: initialFormValues.blacklistedOrganizations ?? '',
      hasOngoingEnquiry: typeof initialFormValues.hasOngoingEnquiry === 'boolean' ? (initialFormValues.hasOngoingEnquiry ? 'yes' : 'no') : (initialFormValues.hasOngoingEnquiry ?? ''),
      informationTrueAgreement: initialFormValues.informationTrueAgreement ?? false,
      applicationAcceptanceAgreement: initialFormValues.applicationAcceptanceAgreement ?? false,
      svcServices:
        initialFormValues.svcServices?.length > 0
          ? initialFormValues.svcServices
          : [
              {
                serviceName: '',
                totalServicesCapacity: '',
                capacityUnit: capacityUnit,
                currentUtilizedCapacity: '',
                commencementDate: '',
                isExported: null,
                exportCountries: [],
                exportPercentage: '',
              },
            ],
      customers:
        initialFormValues.customers?.length > 0
          ? initialFormValues.customers
          : [
              {
                customerName: '',
                customerType: '',
                country: '',
              },
            ],
      svcOutsourcedComponents:
        initialFormValues.svcOutsourcedComponents?.length > 0
          ? initialFormValues.svcOutsourcedComponents.map(c => ({
              ...c,
              componentName: Array.isArray(c.componentName) ? c.componentName[0] || '' : c.componentName ? String(c.componentName) : '',
            }))
          : [],
    };
    // Only re-create when these inputs change
  }, [initialFormValues, currentOrganization, user?.organization?.id]);

  // Memoize the per-step schema so Formik doesn't see a fresh object reference each render
  const stepSchema = useMemo(() => getStepSchema(activeStep), [activeStep]);

  const formik = useFormik({
    initialValues: memoizedInitialValues,
    validationSchema: stepSchema,
    onSubmit: () => {
      // Form submission is handled by handleNext and submitStepData per step
    },
    enableReinitialize: true, // allow form to reinitialize when applicationDetails arrive
  });

  // Keep refs current so the serialized autosave always reads the freshest values and draft id.
  useEffect(() => {
    formikValuesRef.current = formik.values;
  });
  useEffect(() => {
    if (currentApplicationId) {
      applicationIdRef.current = currentApplicationId;
    }
  }, [currentApplicationId]);

  // Background draft save. Serialized: a blur arriving mid-save queues a single
  // trailing save rather than firing a second create (which would duplicate the draft).
  const runAutosave = async () => {
    if (autosaveSavingRef.current) {
      autosavePendingRef.current = true;
      return;
    }
    autosaveSavingRef.current = true;
    setAutosaveStatus('saving');
    const ok = await submitStepData(dispatch, formikValuesRef.current, {}, { isAutosave: true });
    autosaveSavingRef.current = false;
    setAutosaveStatus(ok ? 'saved' : 'error');
    if (autosavePendingRef.current) {
      autosavePendingRef.current = false;
      runAutosave();
    }
  };

  // On field blur: validate just that field against the current step schema; save if valid.
  const handleAutosaveBlur = event => {
    const name = event?.target?.name;
    if (!isAutosavableFieldName(name)) {
      return;
    }
    // validateAt throws synchronously (not a rejected promise) when `name` isn't a path the
    // schema knows about, e.g. a blur bubbling up from an MUI-internal node; catch both forms.
    try {
      stepSchema
        .validateAt(name, formik.values)
        .then(() => runAutosave())
        .catch(err => {
          // ValidationError => field is invalid, don't save it yet.
          // Other errors (e.g. field has no rule in this step) => treat as valid.
          if (err?.name !== 'ValidationError') {
            runAutosave();
          }
        });
    } catch (err) {
      if (err?.name !== 'ValidationError') {
        runAutosave();
      }
    }
  };

  // Commit-on-change: the fields listed above never reach handleAutosaveBlur, so any change to one
  // of them schedules a save of its own.
  const commitWatchSignature = useMemo(() => JSON.stringify(COMMIT_ON_CHANGE_FIELDS.map(key => describeForChangeWatch(formik.values[key]))), [formik.values]);
  const lastCommittedSignatureRef = useRef(null);
  // Re-baseline whenever Formik reinitializes (the organisation profile arriving after mount), so
  // a reinitialization is never mistaken for a user edit and saved over the stored draft.
  useEffect(() => {
    lastCommittedSignatureRef.current = null;
  }, [memoizedInitialValues]);
  useEffect(() => {
    if (lastCommittedSignatureRef.current === null) {
      lastCommittedSignatureRef.current = commitWatchSignature;
      return;
    }
    if (lastCommittedSignatureRef.current === commitWatchSignature) {
      return;
    }
    const timeoutId = setTimeout(() => {
      lastCommittedSignatureRef.current = commitWatchSignature;
      runAutosave();
    }, COMMIT_ON_CHANGE_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [commitWatchSignature]);

  // Hydrate Formik arrays from `combinedData` when combinedData arrives
  // (some flows update `combinedData` asynchronously; ensure form shows values)
  useEffect(() => {
    if (!combinedData || !formik) {
      return;
    }
    try {
      const arrayFields = ['svcServices', 'customers', 'svcKeyProcesses', 'svcOutsourcedProcesses', 'svcKeyResources', 'svcOutsourcedComponents'];
      arrayFields.forEach(key => {
        const combinedVal = combinedData[key];
        const formVal = formik.values[key];
        if (Array.isArray(combinedVal) && (!Array.isArray(formVal) || formVal.length === 0)) {
          formik.setFieldValue(key, combinedVal, false);
        }
      });
    } catch (_err) {
      // swallow errors to avoid UI crash
    }
    // We only want to run when combinedData changes
  }, [combinedData]);

  // Focus the first form field that has a validation error
  const focusFirstErrorField = errors => {
    try {
      if (!errors || typeof errors !== 'object') {
        return;
      }

      const findPath = obj => {
        if (!obj) {
          return null;
        }
        for (const key of Object.keys(obj)) {
          const val = obj[key];
          if (!val) {
            continue;
          }
          if (typeof val === 'string') {
            return key;
          }
          if (Array.isArray(val)) {
            for (let i = 0; i < val.length; i++) {
              const child = val[i];
              if (!child) {
                continue;
              }
              if (typeof child === 'string') {
                return `${key}[${i}]`;
              }
              if (typeof child === 'object') {
                const childKey = findPath(child);
                if (childKey) {
                  return `${key}[${i}].${childKey}`;
                }
              }
            }
          }
          if (typeof val === 'object') {
            const childKey = findPath(val);
            if (childKey) {
              return `${key}.${childKey}`;
            }
          }
        }
        return null;
      };

      const path = findPath(errors);
      if (!path) {
        return;
      }

      const el = document.querySelector(`[name="${path}"]`) || document.querySelector(`[name='${path}']`);
      if (el && typeof el.focus === 'function') {
        el.focus();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (_e) {
      // ignore focus errors
    }
  };
  // Fetch master data on component mount
  useEffect(() => {
    dispatch(listKeyProcessesAction());
    dispatch(listThirdPartyCertsAction());
  }, [dispatch]);

  // Auto sum totalEmployees when any employee count changes
  useEffect(() => {
    const male = Number(formik.values.maleEmployeesCount) || 0;
    const female = Number(formik.values.femaleEmployeesCount) || 0;
    const other = Number(formik.values.otherEmployeesCount) || 0;
    const total = male + female + other;
    formik.setFieldValue('totalEmployees', String(total));
  }, [formik.values.maleEmployeesCount, formik.values.femaleEmployeesCount, formik.values.otherEmployeesCount]);
  const { notFound: unitPincodeNotFound, markApplied: markUnitPincodeApplied } = usePincodeAutofill({
    pinCode: formik.values.unitPincode,
    lookupKey: UNIT_PINCODE_KEY,
    district: formik.values.unitDistrict,
    state: formik.values.unitState,
    onResolve: match => {
      formik.setFieldValue('unitDistrict', match.district);
      formik.setFieldValue('unitState', match.state);
    },
    onMiss: () => {
      formik.setFieldValue('unitDistrict', '');
      formik.setFieldValue('unitState', '');
    },
  });

  // Look up registered office pincode to get district code for application number generation
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formik.values.registeredOfficePincode?.length === 6) {
        dispatch(
          pinCodeAction({
            pincode: formik.values.registeredOfficePincode,
            key: REGISTERED_OFFICE_PINCODE_KEY,
          }),
        );
      }
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [dispatch, formik.values.registeredOfficePincode]);

  // Set registered office district code from pincode lookup result (used to generate application number).
  // Tracks the current pincode so editing it refreshes the code instead of keeping a stale value.
  useEffect(() => {
    const match = Array.isArray(registeredOfficePinCodeLookup) ? registeredOfficePinCodeLookup[0] : null;
    if (match?.districtCode && formik.values.registeredOfficePincode === match.pincode && formik.values.registeredOfficeDistrictCode !== match.districtCode) {
      formik.setFieldValue('registeredOfficeDistrictCode', match.districtCode);
    }
  }, [registeredOfficePinCodeLookup, formik.values.registeredOfficePincode]);

  // Persisted-step rehydration:
  // When user navigates backwards, restore the saved step fields from stepDataRef
  const getFieldsForStep = step => {
    switch (step) {
      case 0:
        return [
          // Fields from CreateNewApplication (pre-step)
          'applicationType',
          'registeredOfficeDistrictCode',
          'isExistingDrdoVendor',
          'svcProviderType',
          'vendorCategory',
          'dpiitRegistrationNumber',
          'dpiitCertificateFile',
          'udyamRegistrationNumber',
          'cin',
          'udyamCertificateFile',
          'incorporationCertificateFile',
          'svcDrdoVendorLabs',
          'drdoRegistrationNumber',
          'drdoCertificateFile',
          'enterpriseClassification',
          // Enterprise info fields
          'enterpriseName',
          'unitName',
          'registeredOfficeAddress',
          'registeredOfficeState',
          'registeredOfficeDistrict',
          'registeredOfficePincode',
          'registeredOfficeMobile',
          'registeredOfficeLandline',
          'registeredOfficeEmail',
          'registeredOfficeAlternateEmail',
          'unitAddress',
          'unitState',
          'unitDistrict',
          'unitPincode',
          'unitMobile',
          'unitLandline',
          'unitEmail',
          'unitAlternateEmail',
          'unitCommencementDate',
          'siteExteriorPhoto',
          'isSameAsRegistered',
          'contactPersonName',
          'contactPersonDesignation',
          'contactPersonMobile',
          'contactPersonEmail',
        ];
      case 1:
        return [
          'ownershipType',
          'maleEmployeesCount',
          'femaleEmployeesCount',
          'otherEmployeesCount',
          'hasGst',
          'gstNumber',
          'gstCertificateFile',
          'hasGovtRegistration',
          'govtOrganisationName',
          'govtRegistrationCertificate',
        ];
      case 2:
        return ['svcServices', 'customers', 'svcKeyProcesses', 'svcOutsourcedProcesses', 'svcKeyResources', 'svcOutsourcedComponents'];
      case 3:
        return ['thirdPartyCertifications', 'isBlacklisted', 'blacklistedOrganizations', 'hasOngoingEnquiry', 'informationTrueAgreement', 'applicationAcceptanceAgreement'];
      default:
        return [];
    }
  };

  // Step rehydration: restore saved fields when navigating backwards
  useEffect(() => {
    // only attempt rehydration when moving to a previous step
    if (prevStepRef.current > activeStep && stepDataRef.current && Object.keys(stepDataRef.current).length > 0) {
      const fieldsToRestore = getFieldsForStep(activeStep);
      if (fieldsToRestore.length > 0) {
        const restored = { ...formik.values };
        let anyRestored = false;
        fieldsToRestore.forEach(key => {
          if (stepDataRef.current[key] !== undefined) {
            let restoredVal = stepDataRef.current[key];
            // These four are stored as booleans for the API payload, but their RadioGroups
            // expect 'yes'/'no' strings — convert back so the selection is shown when
            // navigating back to this step.
            if ((key === 'hasGst' || key === 'hasGovtRegistration' || key === 'isBlacklisted' || key === 'hasOngoingEnquiry') && typeof restoredVal === 'boolean') {
              restoredVal = restoredVal ? 'yes' : 'no';
            }
            restored[key] = restoredVal;
            anyRestored = true;
          }
        });
        if (anyRestored) {
          formik.setValues(restored);
          Logger.info(`Rehydrated form values for step ${activeStep}`);
        }
      }
    }
    prevStepRef.current = activeStep;
  }, [activeStep]);
  // debug: svcKeyResources normalized via initialValues mapping

  const renderStepContent = () => {
    switch (activeStep) {
      case 0: {
        // Inline Step1 JSX with hooks and variables inside block

        return (
          <div>
            <div className="step-header">
              <div className="row">
                <div className="col-md-12">
                  <h2 className="step-header-title">Enterprise & Unit Details</h2>
                  <p className="step-header-subtitle">Provide basic information about your organization and the unit applying for certification</p>
                </div>
              </div>
            </div>

            {/* Registered Office Address Section */}
            <div className="form-section bottom-seperator">
              <h5 className="section-title">Enterprise Details</h5>
              <div className="row gap-vertical-30">
                <div className="col-md-6">
                  <AppInput
                    name="enterpriseName"
                    label="Name of Enterprise"
                    InputProps={{ readOnly: true }}
                    placeholder="Enter Name of Enterprise"
                    value={(formik.values.enterpriseName || '').toUpperCase()}
                    focused={formik.values.enterpriseName}
                    disabled={true}
                    onChange={formik.handleChange}
                    isRequired={true}
                    error={formik.errors.enterpriseName && formik.touched.enterpriseName ? formik.errors.enterpriseName : ''}
                  />
                </div>
                <div className="col-md-12">
                  <AppInput
                    name={'registeredOfficeAddress'}
                    label="Registered Office Address"
                    InputProps={{ readOnly: true }}
                    focused={formik.values.registeredOfficeAddress}
                    disabled={true}
                    placeholder="Enter Address"
                    value={formik.values.registeredOfficeAddress}
                    onChange={formik.handleChange}
                    isRequired={true}
                    error={formik.errors.registeredOfficeAddress && formik.touched.registeredOfficeAddress ? formik.errors.registeredOfficeAddress : ''}
                  />
                </div>
                <div className="col-md-4">
                  <AppInput
                    name="registeredOfficePincode"
                    InputProps={{ readOnly: true }}
                    focused={formik.values.registeredOfficePincode}
                    disabled={true}
                    label="Pin Code"
                    placeholder="Enter Pin Code"
                    value={formik.values.registeredOfficePincode}
                    onChange={e => {
                      let value = e.target.value;
                      // Remove all non-digit characters
                      const digits = value.replace(/\D/g, '');
                      // Limit to 6 digits
                      const pinCode = digits.slice(0, 6);
                      formik.setFieldValue('registeredOfficePincode', pinCode);
                    }}
                    isRequired={true}
                    error={formik.errors.registeredOfficePincode && formik.touched.registeredOfficePincode ? formik.errors.registeredOfficePincode : ''}
                  />
                </div>
                <div className="col-md-4">
                  <AppInput
                    name={'registeredOfficeDistrict'}
                    label="District"
                    InputProps={{ readOnly: true }}
                    focused={formik.values.registeredOfficeDistrict}
                    disabled={true}
                    placeholder="Enter District"
                    value={formik.values.registeredOfficeDistrict}
                    onChange={formik.handleChange}
                    isRequired={true}
                    error={formik.errors.registeredOfficeDistrict && formik.touched.registeredOfficeDistrict ? formik.errors.registeredOfficeDistrict : ''}
                  />
                </div>
                <div className="col-md-4">
                  <AppInput
                    name={'registeredOfficeState'}
                    label="State"
                    InputProps={{ readOnly: true }}
                    focused={formik.values.registeredOfficeState}
                    disabled={true}
                    placeholder="Enter State"
                    value={formik.values.registeredOfficeState}
                    onChange={formik.handleChange}
                    isRequired={true}
                    error={formik.errors.registeredOfficeState && formik.touched.registeredOfficeState ? formik.errors.registeredOfficeState : ''}
                  />
                </div>

                <div className="col-md-6">
                  <AppInput
                    name="registeredOfficeMobile"
                    label="Mobile Number"
                    InputProps={{ readOnly: true }}
                    focused={formik.values.registeredOfficeMobile}
                    disabled={true}
                    placeholder="Enter Mobile Number"
                    value={formik.values.registeredOfficeMobile}
                    onChange={formik.handleChange}
                    phoneNumberFormat={true}
                    isRequired={true}
                    inputMode="numeric"
                    maxLength={13}
                    error={formik.errors.registeredOfficeMobile && formik.touched.registeredOfficeMobile ? formik.errors.registeredOfficeMobile : ''}
                  />
                </div>
                <div className="col-md-6">
                  <AppInput
                    name="registeredOfficeLandline"
                    label="Landline Number"
                    InputProps={{ readOnly: true }}
                    focused={formik.values.registeredOfficeLandline}
                    disabled={true}
                    placeholder="Enter Landline Number"
                    landLineFormat={true}
                    value={formik.values.registeredOfficeLandline}
                    onChange={formik.handleChange}
                    error={formik.errors.registeredOfficeLandline && formik.touched.registeredOfficeLandline ? formik.errors.registeredOfficeLandline : ''}
                  />
                </div>
                <div className="col-md-6">
                  <AppInput
                    name="registeredOfficeEmail"
                    label="Email"
                    InputProps={{ readOnly: true }}
                    focused={formik.values.registeredOfficeEmail}
                    disabled={true}
                    placeholder="Enter Email"
                    value={formik.values.registeredOfficeEmail}
                    onChange={formik.handleChange}
                    inputType="email"
                    isRequired={true}
                    error={formik.errors.registeredOfficeEmail && formik.touched.registeredOfficeEmail ? formik.errors.registeredOfficeEmail : ''}
                  />
                </div>
                <div className="col-md-6">
                  <AppInput
                    name="registeredOfficeAlternateEmail"
                    InputProps={{ readOnly: true }}
                    focused={formik.values.registeredOfficeAlternateEmail}
                    disabled={true}
                    label="Alternate Email"
                    placeholder="Enter Alternate Email"
                    value={formik.values.registeredOfficeAlternateEmail}
                    onChange={formik.handleChange}
                    inputType="email"
                    // error={formik.errors.registeredOfficeAlternateEmail && formik.touched.registeredOfficeAlternateEmail ? formik.errors.registeredOfficeAlternateEmail : ''}
                  />
                </div>
              </div>
            </div>
            {/* Work Address Section */}
            <div className="form-section bottom-seperator">
              <h5 className="section-title">Unit Details (To be assessed)</h5>
              <div className="form-check">
                <AppButton variant="secondary" size="small" title={'Copy from Registered office Address'} onClick={handleCopyFromRegisteredOffice} />
              </div>
              <div className="margintop-30">
                <div className="col-md-6">
                  <AppInput
                    name="unitName"
                    label="Name of Unit"
                    placeholder="Enter Name of Unit"
                    value={formik.values.unitName}
                    maxLength={100}
                    focused={formik.values.unitName}
                    onChange={formik.handleChange}
                    isRequired={true}
                    error={formik.errors.unitName && formik.touched.unitName ? formik.errors.unitName : ''}
                  />
                </div>
                <div className="row gap-vertical-30 margintop-30">
                  <div className="col-md-12">
                    <AppInput
                      name="unitAddress"
                      label="Work Address"
                      maxLength={250}
                      placeholder="Enter Address"
                      focused={formik.values.unitAddress}
                      value={formik.values.unitAddress}
                      onChange={formik.handleChange}
                      isRequired={true}
                      error={formik.errors.unitAddress && formik.touched.unitAddress ? formik.errors.unitAddress : ''}
                    />
                  </div>
                  <div className="col-md-4">
                    <AppInput
                      name="unitPincode"
                      label="Pin Code"
                      placeholder="Enter Pin Code"
                      maxLength={6}
                      value={formik.values.unitPincode}
                      onChange={e => {
                        let value = e.target.value;
                        const digits = value.replace(/\D/g, '');
                        const pinCode = digits.slice(0, 6);
                        formik.setFieldValue('unitPincode', pinCode);
                      }}
                      isRequired={true}
                      error={
                        formik.errors.unitPincode && formik.touched.unitPincode ? formik.errors.unitPincode : unitPincodeNotFound ? 'PIN code not found. Please enter District and State manually.' : ''
                      }
                    />
                  </div>
                  <div className="col-md-4">
                    <AppInput
                      name="unitDistrict"
                      label="District"
                      placeholder="Enter District"
                      value={formik.values.unitDistrict || ''}
                      onChange={formik.handleChange}
                      isRequired={true}
                      error={formik.errors.unitDistrict && formik.touched.unitDistrict ? formik.errors.unitDistrict : ''}
                    />
                  </div>
                  <div className="col-md-4">
                    <AppDropdown
                      name="unitState"
                      label="State"
                      placeholder="Select State"
                      value={formik.values.unitState || ''}
                      onChange={e => formik.setFieldValue('unitState', e.target.value)}
                      onBlur={formik.handleBlur}
                      options={stateOptions}
                      isRequired={true}
                      error={formik.errors.unitState && formik.touched.unitState ? formik.errors.unitState : ''}
                    />
                  </div>
                  <div className="bottom-dashed-seperator " style={{ paddingBottom: 0 }}></div>
                </div>
              </div>
              <div className="row margintop-30 gap-vertical-30">
                <div className="col-md-6">
                  <AppInput
                    name="unitMobile"
                    label="Mobile Number"
                    placeholder="Enter Mobile Number"
                    value={formik.values.unitMobile}
                    onChange={e => formik.setFieldValue('unitMobile', e.target.value)}
                    phoneNumberFormat={true}
                    isRequired={true}
                    inputMode="numeric"
                    maxLength={10}
                    error={formik.errors.unitMobile && formik.touched.unitMobile ? formik.errors.unitMobile : ''}
                  />
                </div>
                <div className="col-md-6">
                  <AppInput
                    name="unitLandline"
                    label="Landline Number"
                    placeholder="Enter Landline Number"
                    value={formik.values.unitLandline}
                    onChange={e => formik.setFieldValue('unitLandline', e.target.value)}
                    onBlur={formik.handleBlur}
                    landLineFormat={true}
                    error={formik.errors.unitLandline && formik.touched.unitLandline ? formik.errors.unitLandline : ''}
                  />
                </div>
                <div className="col-md-6">
                  <AppInput
                    name="unitEmail"
                    label="Email"
                    placeholder="Enter Email"
                    value={formik.values.unitEmail}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    inputType="email"
                    maxLength={320}
                    isRequired={true}
                    error={formik.errors.unitEmail && formik.touched.unitEmail ? formik.errors.unitEmail : ''}
                  />
                </div>
                <div className="col-md-6">
                  <AppInput
                    name="unitAlternateEmail"
                    label="Alternate Email"
                    placeholder="Enter Alternate Email"
                    value={formik.values.unitAlternateEmail}
                    maxLength={320}
                    onChange={formik.handleChange}
                    inputType="email"
                    error={formik.errors.unitAlternateEmail && formik.touched.unitAlternateEmail ? formik.errors.unitAlternateEmail : ''}
                  />
                </div>
                <div className="col-md-6">
                  <AppDatePicker
                    name={'unitCommencementDate'}
                    label="Date of Commencement of Unit"
                    additionalInfoLabel="Applied for"
                    value={formik.values.unitCommencementDate}
                    onChange={date => {
                      let formattedDate = dayjs(date).format('YYYY-MM-DD');

                      formik.setFieldValue('unitCommencementDate', formattedDate);
                    }}
                    placeholder="Select date"
                    isRequired={true}
                    maxDate={new Date()}
                    error={formik.errors.unitCommencementDate && formik.touched.unitCommencementDate ? formik.errors.unitCommencementDate : ''}
                  />
                </div>
                <div className="col-md-6">
                  <AppFileUpload
                    name="siteExteriorPhoto"
                    label="Upload Picture of Site Exterior"
                    subLabel={`Only .jpg, .jpeg, .png. Max file size ${5}MB.`}
                    accept=".jpg,.jpeg,.png"
                    maxSizeMB={5}
                    value={formik.values.siteExteriorPhoto}
                    focused={formik.values.siteExteriorPhoto}
                    onChange={selectedFile => formik.setFieldValue('siteExteriorPhoto', selectedFile)}
                    isRequired={true}
                    error={formik.errors.siteExteriorPhoto && formik.touched.siteExteriorPhoto ? formik.errors.siteExteriorPhoto : ''}
                  />
                </div>
              </div>
            </div>
            {/* Work Address Section */}
            <div className="form-section bottom-seperator">
              <h5 className="section-title">Unit classification</h5>

              <div className="row gap-vertical-30">
                <div className="col-md-12">
                  <FormControl component="fieldset" sx={{ width: '100%' }}>
                    <span className="label">
                      Type of Service Provider<span className="asterics">*</span>
                    </span>
                    <RadioGroup value={formik.values.svcProviderType} onChange={handleServiceProviderTypeChange} sx={{ flexDirection: 'row' }}>
                      <FormControlLabel
                        value="annual_maintenance_contract"
                        control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                        label="Annual Maintenance Contract (AMC)"
                        sx={{
                          marginRight: 3,
                          '& .MuiFormControlLabel-label': {
                            fontSize: '14px',
                          },
                        }}
                      />
                      <FormControlLabel
                        value="critical_service_provider"
                        control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                        label="Critical Service Provider"
                        sx={{
                          marginRight: 3,
                          '& .MuiFormControlLabel-label': {
                            fontSize: '14px',
                          },
                        }}
                      />
                      <FormControlLabel
                        value="civil_works_contractor"
                        control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                        label="Civil Works Contractors"
                        sx={{
                          '& .MuiFormControlLabel-label': {
                            fontSize: '14px',
                          },
                        }}
                      />
                    </RadioGroup>
                    {formik.touched.svcProviderType && getFieldError('svcProviderType') && <div className="error-text margin-top-4">{getFieldError('svcProviderType')}</div>}
                  </FormControl>
                </div>

                {formik.values.svcProviderType && (
                  <div style={{ marginTop: '20px' }}>
                    <div className="row">
                      <div className="col-12 col-md-6">
                        <AppDropdown
                          name="vendorCategory"
                          label="Category"
                          isRequired={!!formik.values.svcProviderType}
                          options={drdoVendorCategoriesV1?.data
                            ?.filter(data => data.serviceProviderType === formik.values.svcProviderType)
                            .map(category => ({ value: category.categoryName, label: category.categoryName }))}
                          value={formik.values.vendorCategory}
                          onChange={formik.handleChange}
                          onBlur={formik.handleBlur}
                          error={formik.touched.vendorCategory && formik.errors.vendorCategory ? formik.errors.vendorCategory : ''}
                        />
                      </div>
                      <div className="col-12 col-md-6">
                        <AppMultiSelectDropdown
                          name="svcDrdoVendorLabs"
                          chipMode={true}
                          label="Services"
                          subLabel="Select the service(s) under which you are applying."
                          isRequired={!!formik.values.svcProviderType}
                          options={vendorLabs?.data?.filter(lab => lab.serviceProviderType === formik.values.svcProviderType).map(lab => ({ value: lab.labName, label: lab.labName })) || []}
                          value={Array.isArray(formik.values.svcDrdoVendorLabs) ? formik.values.svcDrdoVendorLabs.map(l => (typeof l === 'string' ? l : l.labName || '')) : []}
                          onChange={value => {
                            const newValues = (Array.isArray(value) ? value : []).map(val => ({ labName: val }));
                            formik.setFieldValue('svcDrdoVendorLabs', newValues);
                          }}
                          placeholder="Select Services"
                          error={formik.touched.svcDrdoVendorLabs && formik.errors.svcDrdoVendorLabs ? formik.errors.svcDrdoVendorLabs : ''}
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div className="col-12">
                  <FormControl component="fieldset" sx={{ marginBottom: 2, width: '100%' }}>
                    <span className="label">
                      Are you an existing DRDO vendor?<span className="asterics">*</span>
                    </span>
                    <RadioGroup
                      value={formik.values.isExistingDrdoVendor}
                      onChange={e => {
                        formik.setFieldValue('isExistingDrdoVendor', e.target.value);
                        if (e.target.value === 'no') {
                          formik.setFieldValue('drdoRegistrationNumber', '');
                          formik.setFieldValue('drdoCertificateFile', null);
                        }
                      }}
                      sx={{ flexDirection: 'row' }}>
                      <FormControlLabel
                        value="yes"
                        control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                        label="Yes"
                        sx={{
                          marginRight: 3,
                          '& .MuiFormControlLabel-label': {
                            fontSize: '14px',
                          },
                        }}
                      />
                      <FormControlLabel
                        value="no"
                        control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                        label="No"
                        sx={{
                          '& .MuiFormControlLabel-label': {
                            fontSize: '14px',
                          },
                        }}
                      />
                    </RadioGroup>
                    {formik.touched.isExistingDrdoVendor && formik.errors.isExistingDrdoVendor && <div className="error-text margin-top-4">{formik.errors.isExistingDrdoVendor}</div>}
                    {formik.values.isExistingDrdoVendor === 'yes' && (
                      <div style={{ marginTop: '20px' }}>
                        <div className="row">
                          <div className="col-12 col-md-6">
                            <AppInput
                              name="drdoRegistrationNumber"
                              placeholder="Enter DRDO/DRDO Lab Registration Number"
                              label="DRDO/DRDO Lab Registration Number"
                              isRequired={true}
                              maxLength={40}
                              value={formik.values.drdoRegistrationNumber}
                              onChange={e => {
                                formik.setFieldValue('drdoRegistrationNumber', e.target.value.toUpperCase());
                              }}
                              error={formik.touched.drdoRegistrationNumber && formik.errors.drdoRegistrationNumber ? formik.errors.drdoRegistrationNumber : ''}
                            />
                          </div>
                          <div className="col-12 col-md-6">
                            <AppFileUpload
                              name="drdoCertificateFile"
                              label="DRDO/DRDO Services Certificate"
                              accept=".png,.jpg,.jpeg,.pdf"
                              maxSizeMB={5}
                              isRequired={true}
                              value={formik.values.drdoCertificateFile}
                              onChange={selectedFile => formik.setFieldValue('drdoCertificateFile', selectedFile)}
                              error={formik.errors.drdoCertificateFile && formik.touched.drdoCertificateFile ? formik.errors.drdoCertificateFile : ''}
                              onBlur={() => formik.setFieldTouched('drdoCertificateFile', true)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </FormControl>
                </div>
                <div className="col-12">
                  <FormControl component="fieldset" sx={{ marginBottom: 2, width: '100%' }}>
                    <span className="label">
                      Enterprise size<span className="asterics">*</span>
                    </span>
                    <RadioGroup value={formik.values.enterpriseClassification} onChange={handleEnterpriseClassificationChange} sx={{ flexDirection: 'row', gap: 2, flexWrap: 'wrap' }}>
                      <FormControlLabel
                        value="startup"
                        control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                        label="Start-Up"
                        sx={{
                          marginRight: 2,
                          '& .MuiFormControlLabel-label': {
                            fontSize: '14px',
                          },
                        }}
                      />
                      <FormControlLabel
                        value="micro"
                        control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                        label="Micro"
                        sx={{
                          marginRight: 2,
                          '& .MuiFormControlLabel-label': {
                            fontSize: '14px',
                          },
                        }}
                      />
                      <FormControlLabel
                        value="small"
                        control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                        label="Small"
                        sx={{
                          marginRight: 2,
                          '& .MuiFormControlLabel-label': {
                            fontSize: '14px',
                          },
                        }}
                      />
                      <FormControlLabel
                        value="medium"
                        control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                        label="Medium"
                        sx={{
                          marginRight: 2,
                          '& .MuiFormControlLabel-label': {
                            fontSize: '14px',
                          },
                        }}
                      />
                      <FormControlLabel
                        value="large"
                        control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                        label="Large"
                        sx={{
                          '& .MuiFormControlLabel-label': {
                            fontSize: '14px',
                          },
                        }}
                      />
                      {formik.values.enterpriseClassification === 'startup' && (
                        <div style={{ marginTop: '20px', width: '100%' }}>
                          <div className="row">
                            <div className="col-12 col-md-6">
                              <AppInput
                                name="dpiitRegistrationNumber"
                                placeholder="DPIIT2022AB1234"
                                label="DPIIT Registration Number"
                                isRequired={true}
                                maxLength={20}
                                value={formik.values.dpiitRegistrationNumber}
                                onChange={e => {
                                  formik.setFieldValue('dpiitRegistrationNumber', e.target.value.toUpperCase());
                                }}
                                error={formik.touched.dpiitRegistrationNumber && formik.errors.dpiitRegistrationNumber ? formik.errors.dpiitRegistrationNumber : ''}
                              />
                            </div>
                            <div className="col-12 col-md-6">
                              <AppFileUpload
                                name="dpiitCertificateFile"
                                label="Upload DPIIT Registration Certificate"
                                accept=".png,.jpg,.jpeg,.pdf"
                                maxSizeMB={5}
                                isRequired={true}
                                value={formik.values.dpiitCertificateFile}
                                onChange={selectedFile => formik.setFieldValue('dpiitCertificateFile', selectedFile)}
                                error={formik.touched.dpiitCertificateFile && formik.errors.dpiitCertificateFile ? formik.errors.dpiitCertificateFile : ''}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      {['micro', 'small', 'medium'].includes(formik.values.enterpriseClassification) && (
                        <div style={{ marginTop: '20px', width: '100%' }}>
                          <div className="row">
                            <div className="col-12 col-md-6">
                              <AppInput
                                name="udyamRegistrationNumber"
                                placeholder="UDYAM-XX-00-0123456"
                                label="UDYAM Registration Number"
                                isRequired={true}
                                maxLength={20}
                                value={formik.values.udyamRegistrationNumber}
                                onChange={e => {
                                  formik.setFieldValue('udyamRegistrationNumber', e.target.value.toUpperCase());
                                }}
                                onBlur={formik.handleBlur}
                                error={formik.touched.udyamRegistrationNumber && formik.errors.udyamRegistrationNumber ? formik.errors.udyamRegistrationNumber : ''}
                              />
                            </div>
                            <div className="col-12 col-md-6">
                              <AppFileUpload
                                name="udyamCertificateFile"
                                label="Upload UDYAM Registration Certificate"
                                accept=".png,.jpg,.jpeg,.pdf"
                                maxSizeMB={5}
                                isRequired={true}
                                value={formik.values.udyamCertificateFile}
                                onChange={selectedFile => formik.setFieldValue('udyamCertificateFile', selectedFile)}
                                error={formik.touched.udyamCertificateFile && formik.errors.udyamCertificateFile ? formik.errors.udyamCertificateFile : ''}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      {formik.values.enterpriseClassification === 'large' && (
                        <div style={{ marginTop: '20px', width: '100%' }}>
                          <div className="row">
                            <div className="col-12 col-md-6">
                              <AppInput
                                name="cin"
                                placeholder="L01631KA2010PTC096843"
                                label="CIN Registration Number"
                                isRequired={true}
                                maxLength={21}
                                onBlur={formik.handleBlur}
                                value={formik.values.cin}
                                onChange={e => {
                                  formik.setFieldValue('cin', e.target.value.toUpperCase());
                                }}
                                onFocus={() => {
                                  try {
                                    formik.setFieldTouched('cin', false);
                                    formik.setFieldError('cin', undefined);
                                  } catch (_e) {
                                    // ignore
                                  }
                                }}
                                error={formik.touched.cin && formik.errors.cin ? formik.errors.cin : ''}
                              />
                            </div>
                            <div className="col-12 col-md-6">
                              <AppFileUpload
                                name="incorporationCertificateFile"
                                label="Certificate of Incorporation"
                                accept=".png,.jpg,.jpeg,.pdf"
                                maxSizeMB={5}
                                isRequired={true}
                                value={formik.values.incorporationCertificateFile}
                                onChange={selectedFile => formik.setFieldValue('incorporationCertificateFile', selectedFile)}
                                error={formik.touched.incorporationCertificateFile && formik.errors.incorporationCertificateFile ? formik.errors.incorporationCertificateFile : ''}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </RadioGroup>
                    {formik.touched.enterpriseClassification && formik.errors.enterpriseClassification && <div className="error-text margin-top-4">{formik.errors.enterpriseClassification}</div>}
                  </FormControl>
                </div>
              </div>
            </div>
            {/* Date and File Upload Section */}
            <div className="form-section">
              <h5 className="section-title text-uppercase">CONTACT Person details</h5>
              <div className="row gap-vertical-30">
                <div className="col-md-6">
                  <AppInput
                    name="contactPersonName"
                    label="Name"
                    placeholder="Enter Name"
                    maxLength={100}
                    value={formik.values.contactPersonName}
                    InputProps={{ readOnly: true }}
                    disabled={true}
                    onChange={formik.handleChange}
                    isRequired={true}
                    error={formik.errors.contactPersonName && formik.touched.contactPersonName ? formik.errors.contactPersonName : ''}
                  />
                </div>
                <div className="col-md-6">
                  <AppInput
                    name="contactPersonDesignation"
                    label="Designation"
                    placeholder="Enter Designation"
                    maxLength={100}
                    value={formik.values.contactPersonDesignation}
                    InputProps={{ readOnly: true }}
                    disabled={true}
                    onChange={formik.handleChange}
                    isRequired={true}
                    error={formik.errors.contactPersonDesignation && formik.touched.contactPersonDesignation ? formik.errors.contactPersonDesignation : ''}
                  />
                </div>
                <div className="col-md-6">
                  <AppInput
                    name="contactPersonMobile"
                    label="Mobile Number"
                    placeholder="Enter Mobile Number"
                    value={formik.values.contactPersonMobile}
                    InputProps={{ readOnly: true }}
                    disabled={true}
                    onChange={e => formik.setFieldValue('contactPersonMobile', e.target.value)}
                    phoneNumberFormat={true}
                    isRequired={true}
                    inputMode="numeric"
                    maxLength={10}
                    error={formik.errors.contactPersonMobile && formik.touched.contactPersonMobile ? formik.errors.contactPersonMobile : ''}
                  />
                </div>
                <div className="col-md-6">
                  <AppInput
                    name="contactPersonEmail"
                    label="Email"
                    placeholder="Enter Email"
                    maxLength={320}
                    value={formik.values.contactPersonEmail}
                    InputProps={{ readOnly: true }}
                    disabled={true}
                    onChange={formik.handleChange}
                    inputType="email"
                    isRequired={true}
                    error={formik.errors.contactPersonEmail && formik.touched.contactPersonEmail ? formik.errors.contactPersonEmail : ''}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      }
      case 1:
        // Step2 JSX inlined below

        return (
          <div>
            <div className="step-header">
              <div className="row">
                <div className="col-md-12">
                  <h2 className="step-header-title">Operational Details</h2>
                  <p className="step-header-subtitle">Ownership, GST</p>
                </div>
              </div>
            </div>
            <div className="form-section">
              <div className="row">
                <div className="col-md-6">
                  <AppDropdown
                    name="ownershipType"
                    label="Ownership Type"
                    placeholder="Select Ownership Type"
                    value={formik.values.ownershipType}
                    options={ownershipTypeOptions}
                    onChange={e => formik.setFieldValue('ownershipType', e.target.value)}
                    isRequired={true}
                    error={formik.errors.ownershipType && formik.touched.ownershipType ? formik.errors.ownershipType : ''}
                  />
                </div>
              </div>
              <div className="row margintop-30 gap-vertical-30">
                <div className="col-md-3">
                  <AppInput
                    name="maleEmployeesCount"
                    label="Number of Male Employees"
                    maxLength={6}
                    placeholder="Enter Number of Male Employees"
                    value={formik.values.maleEmployeesCount}
                    numericCase={true}
                    formatOnBlur={true}
                    onChange={formik.handleChange}
                    isRequired={true}
                    error={formik.errors.maleEmployeesCount && formik.touched.maleEmployeesCount ? formik.errors.maleEmployeesCount : ''}
                  />
                </div>
                <div className="col-md-3">
                  <AppInput
                    name="femaleEmployeesCount"
                    maxLength={6}
                    label="Number of Female Employees"
                    placeholder="Enter Number of Female Employees"
                    value={formik.values.femaleEmployeesCount}
                    onChange={formik.handleChange}
                    numericCase={true}
                    formatOnBlur={true}
                    isRequired={true}
                    error={formik.errors.femaleEmployeesCount && formik.touched.femaleEmployeesCount ? formik.errors.femaleEmployeesCount : ''}
                  />
                </div>
                <div className="col-md-3">
                  <AppInput
                    name="otherEmployeesCount"
                    label="Number of Other Employees"
                    maxLength={6}
                    placeholder="Enter Number of Other Employees"
                    value={formik.values.otherEmployeesCount}
                    onChange={formik.handleChange}
                    numericCase={true}
                    formatOnBlur={true}
                    isRequired={true}
                    error={formik.errors.otherEmployeesCount && formik.touched.otherEmployeesCount ? formik.errors.otherEmployeesCount : ''}
                  />
                </div>
                <div className="col-md-3">
                  <div className="total-employee">
                    <span className="mb-0 fs-18 fw-600 info-active-color">{formatNumber(parseNumericOrNull(formik.values.totalEmployees))}</span>
                    <p className="mb-0 fs-14 fw-500 text-1-color">Total Number of Employees</p>
                    {formik.errors.totalEmployees && formik.submitCount > 0 && <p className="error-text margin-top-4 mb-0">{formik.errors.totalEmployees}</p>}
                  </div>
                </div>
              </div>
              <div className="bottom-seperator"></div>
              <h5 className="section-title margin-top-30">GST Information</h5>
              <div className="row">
                <div className="col-xl-4 col-lg-4 col-md-4">
                  <FormControl component="fieldset" sx={{ marginBottom: 2, width: '100%' }}>
                    <span className="label">
                      Is the Enterprise GST Registered?<span className="asterics">*</span>
                    </span>
                    <RadioGroup
                      value={formik.values.hasGst}
                      onChange={e => {
                        const value = e.target.value;
                        formik.setFieldValue('hasGst', value);
                        formik.setFieldTouched('hasGst', false);
                        if (value === 'no') {
                          formik.setFieldValue('gstNumber', '');
                          formik.setFieldValue('gstCertificateFile', null);
                        }
                      }}
                      sx={{ flexDirection: 'row', gap: 2 }}
                      onBlur={() => formik.setFieldTouched('hasGst', true)}>
                      <FormControlLabel
                        value="yes"
                        control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                        label="Yes"
                        sx={{
                          marginRight: 3,
                          '& .MuiFormControlLabel-label': {
                            fontSize: '14px',
                          },
                        }}
                      />
                      <FormControlLabel
                        value="no"
                        control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                        label="No"
                        sx={{
                          '& .MuiFormControlLabel-label': {
                            fontSize: '14px',
                          },
                        }}
                      />
                    </RadioGroup>
                    {formik.touched.hasGst && formik.errors.hasGst ? <div className="error-text">{formik.errors.hasGst}</div> : null}
                  </FormControl>
                </div>
                {formik.values.hasGst === 'yes' && (
                  <>
                    <div className="col-xl-4 col-lg-4 col-md-4">
                      <AppInput
                        placeholder="Enter GST Number"
                        label="GST Number of the Unit"
                        maxLength={15}
                        upperCase={true}
                        stripWhitespace={true}
                        name="gstNumber"
                        value={formik.values.gstNumber || ''}
                        onChange={e => formik.setFieldValue('gstNumber', e.target.value)}
                        onBlur={handleGstBlur}
                        isRequired
                        error={formik.touched.gstNumber && formik.errors.gstNumber ? formik.errors.gstNumber : ''}
                      />
                    </div>
                    <div className="col-xl-4 col-lg-4 col-md-4">
                      <AppFileUpload
                        name="gstCertificateFile"
                        label="Upload GST Certificate"
                        accept=".jpg,.jpeg,.png,.pdf"
                        maxSizeMB={5}
                        isRequired={true}
                        value={formik.values.gstCertificateFile}
                        onChange={selectedFile => formik.setFieldValue('gstCertificateFile', selectedFile)}
                        helperText="Only jpg, jpeg, png and pdf, Max file Size is 5MB."
                        error={formik.touched.gstCertificateFile && formik.errors.gstCertificateFile ? formik.errors.gstCertificateFile : ''}
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="bottom-seperator"></div>
              <h5 className="section-title margin-top-30">Other Government Registrations</h5>
              <div className="row">
                <div className="col-md-4">
                  <FormControl component="fieldset" sx={{ marginBottom: 2, width: '100%' }}>
                    <span className="label">
                      Is the unit registered with any other government organization?<span className="asterics">*</span>
                    </span>
                    <RadioGroup
                      value={formik.values.hasGovtRegistration}
                      onChange={e => {
                        const value = e.target.value;
                        formik.setFieldValue('hasGovtRegistration', value);
                        if (value === 'no') {
                          formik.setFieldValue('govtOrganisationName', '');
                          formik.setFieldValue('govtRegistrationCertificate', null);
                        }
                      }}
                      sx={{ flexDirection: 'row', gap: 2 }}>
                      <FormControlLabel
                        value="yes"
                        control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                        label="Yes"
                        sx={{
                          marginRight: 3,
                          '& .MuiFormControlLabel-label': {
                            fontSize: '14px',
                          },
                        }}
                      />
                      <FormControlLabel
                        value="no"
                        control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                        label="No"
                        sx={{
                          '& .MuiFormControlLabel-label': {
                            fontSize: '14px',
                          },
                        }}
                      />
                    </RadioGroup>
                    {formik.touched.hasGovtRegistration && formik.errors.hasGovtRegistration ? <div className="error-text">{formik.errors.hasGovtRegistration}</div> : null}
                  </FormControl>
                </div>
                {formik.values.hasGovtRegistration === 'yes' && (
                  <>
                    <div className="col-md-4">
                      <AppInput
                        placeholder="Enter Organization Name"
                        label="Organization Name"
                        maxLength={150}
                        name="govtOrganisationName"
                        value={formik.values.govtOrganisationName || ''}
                        onChange={e => formik.setFieldValue('govtOrganisationName', e.target.value)}
                        isRequired
                        error={formik.touched.govtOrganisationName && formik.errors.govtOrganisationName ? formik.errors.govtOrganisationName : ''}
                      />
                    </div>
                    <div className="col-md-4">
                      <AppFileUpload
                        name="govtRegistrationCertificate"
                        error={formik.touched.govtRegistrationCertificate && formik.errors.govtRegistrationCertificate ? formik.errors.govtRegistrationCertificate : ''}
                        label="Upload Organisation Certificate"
                        accept=".png,.jpg,.jpeg,.pdf"
                        maxSizeMB={5}
                        isRequired={true}
                        value={formik.values.govtRegistrationCertificate}
                        onChange={selectedFile => formik.setFieldValue('govtRegistrationCertificate', selectedFile)}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      case 2:
        // Inline Step3 logic
        // Step3 hooks

        return (
          <div>
            <div className="step-header">
              <div className="row">
                <div className="col-md-12">
                  <h2 className="step-header-title">Service Details</h2>
                  <p className="step-header-subtitle">Service, Customers, Processes, Resource and Components</p>
                </div>
              </div>
              <h5 className="section-title margin-top-30">Service Information</h5>
              <FieldArray name="svcServices">
                {({ push, remove }) => (
                  <>
                    {formik?.values?.svcServices?.map((service, index) => (
                      <div key={service.id} className={`box-border margin-bottom-20`}>
                        <div className="rowBetween margin-bottom-16">
                          <h5 className="section-title-product">Service {index + 1}</h5>
                          {formik?.values?.svcServices?.length > 1 && (
                            // <div className="rowCenter" onClick={() => remove(index)} style={{ cursor: 'pointer' }}>
                            //   <img src={Icons.trash} alt="Remove Icon" className="icon-12" />
                            //   <span className="remove-text">Remove</span>
                            // </div>
                            <AppButton size="small" variant="danger-secondary" title={'Remove'} onClick={() => remove(index)} rightIcon={Icons.trash} rightIconStyle={'icon-12'} />
                          )}
                        </div>

                        <div className="row gap-vertical-30">
                          <div className="col-md-6">
                            <AppInput
                              placeholder="Enter Name of Service"
                              label="Name of Service"
                              isRequired
                              maxLength={150}
                              value={service.serviceName}
                              onChange={e => formik.setFieldValue(`svcServices[${index}].serviceName`, e.target.value)}
                              onBlur={() => formik.setFieldTouched(`svcServices[${index}].serviceName`, true)}
                              name={`svcServices[${index}].serviceName`}
                              error={getFieldError(`svcServices.${index}.serviceName`)}
                            />
                          </div>
                          <div className="col-md-6">
                            <AppInputWithDropdown
                              label="Total Services Capacity Per Year"
                              value={formatNumberInput(service.totalServicesCapacity)}
                              onChange={e => formik.setFieldValue(`svcServices[${index}].totalServicesCapacity`, e.target.value)}
                              onBlur={() => formik.setFieldTouched(`svcServices[${index}].totalServicesCapacity`, true)}
                              name={`svcServices[${index}].totalServicesCapacity`}
                              placeholder="Enter Capacity"
                              subLabel="As on Date of Application for Assessment"
                              unit={service.capacityUnit || 'Number'}
                              // onUnitChange={e => formik.setFieldValue(`svcServices[${index}].capacityUnit`, e.target.value)}
                              disableDropdown={true}
                              isRequired
                              numericFormat={true}
                              error={getFieldError(`svcServices.${index}.totalServicesCapacity`)}
                            />
                          </div>
                          <div className="col-md-6">
                            <AppInputWithDropdown
                              label="Current Utilized Services Capacity Per Year"
                              value={formatNumberInput(service.currentUtilizedCapacity)}
                              onChange={e => formik.setFieldValue(`svcServices[${index}].currentUtilizedCapacity`, e.target.value)}
                              onBlur={() => formik.setFieldTouched(`svcServices[${index}].currentUtilizedCapacity`, true)}
                              name={`svcServices[${index}].currentUtilizedCapacity`}
                              placeholder="Enter Capacity"
                              subLabel="As on Date of Application for Assessment"
                              unit={service.capacityUnit || 'Number'}
                              onUnitChange={e => formik.setFieldValue(`svcServices[${index}].capacityUnit`, e.target.value)}
                              disableDropdown={true}
                              isRequired
                              numericFormat={true}
                              maxValue={parseNumericOrNull(service.totalServicesCapacity)}
                              error={getFieldError(`svcServices.${index}.currentUtilizedCapacity`)}
                            />
                          </div>
                          <div className="col-md-6">
                            <AppDatePicker
                              label="Date of Commencement"
                              value={service.commencementDate}
                              onChange={value => formik.setFieldValue(`svcServices[${index}].commencementDate`, value)}
                              placeholder="Select date"
                              isRequired={true}
                              subLabel="Commencement date of service"
                              error={getFieldError(`svcServices.${index}.commencementDate`)}
                              minDate={formik.values.unitCommencementDate ? dayjs(formik.values.unitCommencementDate) : undefined}
                              maxDate={dayjs()}
                            />
                          </div>
                          <div className="col-md-12">
                            <FormControl component="fieldset" sx={{ marginBottom: 2, width: '100%' }}>
                              <div className="d-flex">
                                <span className="label">Is the Service Being Supplied Internationally?</span>
                                <span className="asterics">*</span>
                              </div>
                              <RadioGroup
                                value={service.isExported === true ? 'yes' : service.isExported === false ? 'no' : ''}
                                onChange={e => {
                                  formik.setFieldValue(`svcServices[${index}].isExported`, e.target.value === 'yes');
                                  if (e.target.value === 'no') {
                                    formik.setFieldValue(`svcServices[${index}].exportCountries`, []);
                                    formik.setFieldValue(`svcServices[${index}].exportPercentage`, '');
                                    formik.setFieldTouched(`svcServices.${index}.exportCountries`, false);
                                    formik.setFieldTouched(`svcServices.${index}.exportPercentage`, false);
                                  }
                                }}
                                name={`svcServices[${index}].isExported`}
                                sx={{ flexDirection: 'row', gap: 2 }}>
                                <FormControlLabel
                                  value="yes"
                                  control={
                                    <Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />
                                  }
                                  label="Yes"
                                  sx={{
                                    marginRight: 3,
                                    '& .MuiFormControlLabel-label': {
                                      fontSize: '14px',
                                    },
                                  }}
                                />
                                <FormControlLabel
                                  value="no"
                                  control={
                                    <Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />
                                  }
                                  label="No"
                                  sx={{
                                    '& .MuiFormControlLabel-label': {
                                      fontSize: '14px',
                                    },
                                  }}
                                />
                              </RadioGroup>
                              {formik.touched.svcServices?.[index]?.isExported && formik.errors.svcServices?.[index]?.isExported && (
                                <div className="error-text">{formik.errors.svcServices[index].isExported}</div>
                              )}
                              {service.isExported && (
                                <div style={{ marginTop: '20px' }}>
                                  <div className="row">
                                    <div className="col-12 col-md-6">
                                      <AppMultiSelectDropdown
                                        label="Destination Country"
                                        options={countryOptions.filter(
                                          option =>
                                            String(option.label || '')
                                              .trim()
                                              .toLowerCase() !== 'india',
                                        )}
                                        chipMode={true}
                                        value={Array.isArray(service.exportCountries) ? service.exportCountries : []}
                                        onChange={newValue => formik.setFieldValue(`svcServices[${index}].exportCountries`, Array.isArray(newValue) ? newValue : [])}
                                        placeholder="Select Destination Country"
                                        name={`svcServices[${index}].exportCountries`}
                                        isRequired={true}
                                        error={getFieldError(`svcServices.${index}.exportCountries`)}
                                      />
                                    </div>
                                    <div className="col-12 col-md-6">
                                      <AppInput
                                        placeholder="Enter Percentage(%)"
                                        label="Percentage (%) of Service Supplied Internationally"
                                        value={service.exportPercentage}
                                        onChange={e => formik.setFieldValue(`svcServices[${index}].exportPercentage`, e.target.value)}
                                        onBlur={formik.handleBlur}
                                        name={`svcServices[${index}].exportPercentage`}
                                        isRequired
                                        percentageFormat={true}
                                        error={getFieldError(`svcServices.${index}.exportPercentage`)}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </FormControl>
                          </div>
                        </div>
                      </div>
                    ))}

                    <AppButton
                      variant="primary"
                      onClick={() =>
                        push({
                          serviceName: '',
                          totalServicesCapacity: '',
                          capacityUnit: capacityUnit,
                          currentUtilizedCapacity: '',
                          commencementDate: '',
                          isExported: null,
                          exportCountries: [],
                          exportPercentage: '',
                        })
                      }
                      title={'Add More'}
                      leftIcon={Icons.addMore}
                      leftIconStyle={'icon-16'}
                      customClass={'ms-auto'}
                    />
                  </>
                )}
              </FieldArray>
            </div>
            <div className="bottom-seperator"></div>
            <h5 className="section-title margin-top-30">Customer Details</h5>

            <FieldArray name="customers">
              {({ push, remove }) => (
                <>
                  {formik?.values?.customers?.map((customer, index) => (
                    <div key={customer.id} className={`box-border margin-bottom-20`}>
                      <div className="row">
                        <div className="rowBetween margin-bottom-16">
                          <h5 className="section-title-product">Customer {index + 1}</h5>
                          {formik?.values?.customers?.length > 1 && (
                            // <div className="rowCenter" onClick={() => remove(index)} style={{ cursor: 'pointer' }}>
                            //   <img src={Icons.trash} alt="Remove Icon" className="icon-12" />
                            //   <span className="remove-text">Remove</span>
                            // </div>
                            <AppButton size="small" variant="danger-secondary" title={'Remove'} onClick={() => remove(index)} rightIcon={Icons.trash} rightIconStyle={'icon-12'} />
                          )}
                        </div>
                      </div>
                      <div className="row" style={{ rowGap: 10 }}>
                        <div className="col-xl-4 col-lg-6">
                          <AppInput
                            label="Name of the Customer"
                            placeholder="Enter Customer Name"
                            value={customer.customerName}
                            maxLength={100}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            name={`customers[${index}].customerName`}
                            isRequired={true}
                            error={getFieldError(`customers.${index}.customerName`)}
                          />
                        </div>
                        <div className="col-xl-4 col-lg-6">
                          <FormControl component="fieldset" sx={{ marginBottom: 2, width: '100%' }}>
                            <div>
                              <span className="label">
                                Customer Location?<span className="asterics">*</span>
                              </span>
                            </div>
                            <RadioGroup
                              value={customer.customerType}
                              onChange={e => {
                                formik.setFieldValue(`customers[${index}].customerType`, e.target.value);
                                formik.setFieldValue(`customers[${index}].country`, '');
                                formik.setFieldTouched(`customers.${index}.country`, false);
                              }}
                              name={`customers[${index}].customerType`}
                              sx={{ flexDirection: 'row', gap: 2 }}>
                              <FormControlLabel
                                value="domestic"
                                control={
                                  <Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />
                                }
                                label="Domestic"
                                sx={{
                                  marginRight: 3,
                                  '& .MuiFormControlLabel-label': {
                                    fontSize: '14px',
                                  },
                                }}
                              />
                              <FormControlLabel
                                value="international"
                                control={
                                  <Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />
                                }
                                label="International"
                                sx={{
                                  '& .MuiFormControlLabel-label': {
                                    fontSize: '14px',
                                  },
                                }}
                              />
                            </RadioGroup>
                            {formik.touched.customers?.[index]?.customerType && formik.errors.customers?.[index]?.customerType && (
                              <div className="error-text">{formik.errors.customers[index].customerType}</div>
                            )}
                          </FormControl>
                        </div>
                        {customer.customerType === 'international' && (
                          <div className="col-xl-4 col-lg-6">
                            <AppDropdown
                              label="Country"
                              value={customer.country}
                              onChange={formik.handleChange}
                              onBlur={formik.handleBlur}
                              name={`customers[${index}].country`}
                              options={(countries || [])
                                .filter(
                                  country =>
                                    String(country.name || '')
                                      .trim()
                                      .toLowerCase() !== 'india',
                                )
                                .map(country => ({
                                  label: String(country.name || ''),
                                  value: String(country.name || ''),
                                }))}
                              placeholder="Select Country"
                              isRequired={true}
                              error={getFieldError(`customers.${index}.country`)}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  <AppButton
                    variant="primary"
                    onClick={() =>
                      push({
                        customerName: '',
                        customerType: '',
                        country: '',
                      })
                    }
                    title={'Add More'}
                    leftIcon={Icons.addMore}
                    leftIconStyle={'icon-16'}
                    customClass={'ms-auto'}
                  />
                </>
              )}
            </FieldArray>

            <div className="bottom-seperator"></div>
            <div className="row margintop-30">
              <h5 className="section-title">Key Services</h5>
              <div className="contact-person-note-container">
                <img src={Icons.infoCircle} alt="info" className="icon-16 margin-right-6" />
                <span className="contact-person-note">
                  Enter the main service activities involved in delivering your service. Start typing to see suggestions or enter the Service activity name. Mark an activity as outsourced if it is
                  carried out outside your unit.
                </span>
              </div>
              <div className="col-md-12 margin-top-20">
                <AppSuggestionInput
                  placeholder="Select or type & press enter"
                  label="Key Services"
                  suggestions={keyProcessV1?.data?.filter(lab => lab.serviceProviderType === formik.values.svcProviderType).map(type => ({ value: type.processName, label: type.processName }))}
                  value={Array.isArray(formik.values.svcKeyProcesses) ? formik.values.svcKeyProcesses.map(p => (typeof p === 'string' ? p : p.processName || '')) : []}
                  onChange={newValue => {
                    const selected = Array.isArray(newValue) ? newValue : [];
                    const newValues = selected.map(val => ({ processName: val }));
                    // Update key processes
                    formik.setFieldValue('svcKeyProcesses', newValues);
                    // If any outsourced processes exist, ensure they are subset of selected key processes
                    const existingOutsourced = Array.isArray(formik.values.svcOutsourcedProcesses) ? formik.values.svcOutsourcedProcesses : [];
                    const filteredOutsourced = existingOutsourced
                      .map(op => (typeof op === 'string' ? op : op.processName || ''))
                      .filter(Boolean)
                      .filter(name => selected.includes(name));
                    // If none of the previously selected outsourced processes remain, clear the field
                    // Ensure svcOutsourcedProcesses stores objects of shape { processName }
                    const filteredOutsourcedObjects = filteredOutsourced.map(name => ({ processName: name }));
                    formik.setFieldValue('svcOutsourcedProcesses', filteredOutsourcedObjects);
                  }}
                  name="svcKeyProcesses"
                  maxSuggestions={10}
                  Outsourced={true}
                  outsourcedValues={Array.isArray(formik.values.svcOutsourcedProcesses) ? formik.values.svcOutsourcedProcesses.map(p => (typeof p === 'string' ? p : p.processName || '')) : []}
                  onToggleOutsourced={(idx, outsourced) => {
                    // Determine the name of the item at this index in the visible tags list
                    const currentTags = Array.isArray(formik.values.svcKeyProcesses) ? formik.values.svcKeyProcesses.map(p => (typeof p === 'string' ? p : p.processName || '')) : [];
                    const processName = currentTags[idx];
                    if (!processName) {
                      return;
                    }
                    // Update svcOutsourcedProcesses to mark this process as outsourced or not
                    const currentOutsourced = Array.isArray(formik.values.svcOutsourcedProcesses) ? formik.values.svcOutsourcedProcesses : [];
                    const existsIdx = currentOutsourced.findIndex(op => (typeof op === 'string' ? op : op.processName) === processName);
                    if (outsourced) {
                      // add if not exists
                      if (existsIdx === -1) {
                        formik.setFieldValue('svcOutsourcedProcesses', [...currentOutsourced, { processName }], true);
                      }
                    } else {
                      // remove if exists
                      if (existsIdx !== -1) {
                        const next = [...currentOutsourced];
                        next.splice(existsIdx, 1);
                        formik.setFieldValue('svcOutsourcedProcesses', next, true);
                      }
                    }
                  }}
                  max={100}
                  isRequired={true}
                  error={formik.touched.svcKeyProcesses && getFieldError('svcKeyProcesses')}
                />
              </div>
            </div>
            <div className="bottom-seperator"></div>
            <div className="row margintop-30">
              <div className="col-12">
                <div className="contact-person-note-container">
                  <img src={Icons.infoCircle} alt="info" className="icon-16 margin-right-6" />
                  <span className="contact-person-note">You must add at least one Key Service Resources or Outsourced Service Components.</span>
                </div>
                {formik.touched.rawOrBought && formik.errors.rawOrBought && (
                  <div className="error-text" style={{ marginTop: 6 }}>
                    {formik.errors.rawOrBought}
                  </div>
                )}
                <h5 className="section-title margintop-30">Key Service Resources</h5>
              </div>
            </div>

            <FieldArray name="svcKeyResources">
              {({ push, remove }) =>
                formik?.values?.svcKeyResources?.length === 0 ? (
                  <AppButton
                    variant="primary"
                    onClick={() =>
                      push({
                        resourceName: '',
                        isImported: null,
                        importCountry: '',
                        importPercentage: '',
                      })
                    }
                    title={'Add Service Key Resource'}
                    leftIcon={Icons.addMore}
                    leftIconStyle={'icon-16'}
                    customClass={'ms-auto'}
                  />
                ) : (
                  <>
                    {formik?.values?.svcKeyResources?.map((rawMaterial, index) => (
                      <div key={index} className={`box-border margin-bottom-20`}>
                        <div className="row">
                          <div className="rowBetween">
                            <h5 className="section-title-product">Key Service Resource {index + 1}</h5>
                            {/* <div className="rowCenter" onClick={() => remove(index)} style={{ cursor: 'pointer' }}>
                              <img src={Icons.trash} alt="Remove Icon" className="icon-12" />
                              <span className="remove-text">Remove</span>
                            </div> */}
                            <AppButton size="small" variant="danger-secondary" title={'Remove'} onClick={() => remove(index)} rightIcon={Icons.trash} rightIconStyle={'icon-12'} />
                          </div>
                          <div className="col-md-6">
                            <AppSuggestionInput
                              placeholder="Select or type manually"
                              label="Key Service Resources"
                              suggestions={keyResources?.data
                                ?.filter(lab => lab.serviceProviderType === formik.values.svcProviderType)
                                .map(type => ({ value: type.resourceName, label: type.resourceName }))}
                              value={rawMaterial.resourceName || ''}
                              onChange={newValue => {
                                let val = '';
                                if (Array.isArray(newValue)) {
                                  const first = newValue[0];
                                  val = typeof first === 'object' && first !== null ? first.value || first.label || '' : first || '';
                                } else if (typeof newValue === 'object' && newValue !== null) {
                                  val = newValue.value || newValue.label || '';
                                } else {
                                  val = newValue || '';
                                }
                                formik.setFieldValue(`svcKeyResources[${index}].resourceName`, val);
                              }}
                              onBlur={() => formik.setFieldTouched(`svcKeyResources.${index}.resourceName`, true)}
                              name={`svcKeyResources[${index}].resourceName`}
                              isRequired
                              max={100}
                              maxSuggestionLength={1}
                              error={getFieldError(`svcKeyResources.${index}.resourceName`)}
                              optionWidth="100%"
                            />
                          </div>
                        </div>
                        <div className="row margintop-30">
                          <div className="col-md-4">
                            <FormControl component="fieldset" sx={{ marginBottom: 2, width: '100%' }}>
                              <div className="d-flex">
                                <span className="label">Is this Resource from Overseas?</span>
                                <span className="asterics">*</span>
                              </div>
                              <RadioGroup
                                value={rawMaterial.isImported === true ? 'yes' : rawMaterial.isImported === false ? 'no' : ''}
                                onChange={e => {
                                  formik.setFieldValue(`svcKeyResources[${index}].isImported`, e.target.value === 'yes');
                                  if (e.target.value === 'no') {
                                    formik.setFieldValue(`svcKeyResources[${index}].importCountry`, '');
                                    formik.setFieldValue(`svcKeyResources[${index}].importPercentage`, '');
                                    formik.setFieldTouched(`svcKeyResources.${index}.importCountry`, false);
                                    formik.setFieldTouched(`svcKeyResources.${index}.importPercentage`, false);
                                  }
                                }}
                                name={`svcKeyResources[${index}].isImported`}
                                sx={{ flexDirection: 'row', gap: 2 }}>
                                <FormControlLabel
                                  value="yes"
                                  control={
                                    <Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />
                                  }
                                  label="Yes"
                                  sx={{
                                    marginRight: 3,
                                    '& .MuiFormControlLabel-label': {
                                      fontSize: '14px',
                                    },
                                  }}
                                />
                                <FormControlLabel
                                  value="no"
                                  control={
                                    <Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />
                                  }
                                  label="No"
                                  sx={{
                                    '& .MuiFormControlLabel-label': {
                                      fontSize: '14px',
                                    },
                                  }}
                                />
                              </RadioGroup>
                              {getFieldError(`svcKeyResources.${index}.isImported`) && <div className="error-text">{getFieldError(`svcKeyResources.${index}.isImported`)}</div>}
                            </FormControl>
                          </div>
                          {rawMaterial.isImported === true && (
                            <>
                              <div className="col-md-5">
                                <AppDropdown
                                  label="Source Country"
                                  name={`svcKeyResources[${index}].importCountry`}
                                  value={rawMaterial.importCountry}
                                  onChange={e => formik.setFieldValue(`svcKeyResources[${index}].importCountry`, e.target.value)}
                                  onBlur={formik.handleBlur}
                                  options={(countries || [])
                                    .filter(
                                      country =>
                                        String(country.name || '')
                                          .trim()
                                          .toLowerCase() !== 'india',
                                    )
                                    .map(country => ({ label: String(country.name || ''), value: String(country.name || '') }))}
                                  placeholder="Select Source Country"
                                  isRequired={true}
                                  error={getFieldError(`svcKeyResources.${index}.importCountry`)}
                                />
                              </div>
                              <div className="col-md-3">
                                <AppInput
                                  placeholder="Enter Percentage(%)"
                                  label="Overseas Sourcing (%)"
                                  percentageFormat={true}
                                  value={rawMaterial.importPercentage}
                                  onChange={e => formik.setFieldValue(`svcKeyResources[${index}].importPercentage`, e.target.value)}
                                  onBlur={formik.handleBlur}
                                  name={`svcKeyResources[${index}].importPercentage`}
                                  isRequired
                                  error={getFieldError(`svcKeyResources.${index}.importPercentage`)}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}

                    <AppButton
                      variant="primary"
                      onClick={() =>
                        push({
                          resourceName: '',
                          isImported: null,
                          importCountry: '',
                          importPercentage: '',
                        })
                      }
                      title={'Add More'}
                      leftIcon={Icons.addMore}
                      leftIconStyle={'icon-16'}
                      customClass={'ms-auto'}
                    />
                  </>
                )
              }
            </FieldArray>

            <div className="margintop-30">
              <h5 className="section-title"> Outsourced Service Components</h5>
              <FieldArray name="svcOutsourcedComponents">
                {({ push, remove }) =>
                  formik?.values?.svcOutsourcedComponents?.length === 0 ? (
                    <AppButton
                      variant="primary"
                      onClick={() =>
                        push({
                          componentName: '',
                          isImported: null,
                          importCountry: '',
                          importPercentage: '',
                        })
                      }
                      title={'Add Outsourced Service Component'}
                      leftIcon={Icons.addMore}
                      leftIconStyle={'icon-16'}
                      customClass={'ms-auto'}
                    />
                  ) : (
                    <>
                      {formik?.values?.svcOutsourcedComponents?.map((boughtOutPart, index) => (
                        <div key={index} className={`box-border margin-bottom-20`}>
                          <div className="row">
                            <div className="rowBetween">
                              <h5 className="section-title-product">Outsourced Service Component {index + 1}</h5>
                              {/* <div className="rowCenter" onClick={() => remove(index)} style={{ cursor: 'pointer' }}>
                                <img src={Icons.trash} alt="Remove Icon" className="icon-12" />
                                <span className="remove-text">Remove</span>
                              </div> */}
                              <AppButton size="small" variant="danger-secondary" title={'Remove'} onClick={() => remove(index)} rightIcon={Icons.trash} rightIconStyle={'icon-12'} />
                            </div>
                            <div className="col-md-6">
                              <AppSuggestionInput
                                placeholder="Select or type manually"
                                optionWidth="100%"
                                label="Outsourced Service Component"
                                suggestions={outsourcedComponents?.data
                                  ?.filter(lab => lab.serviceProviderType === formik.values.svcProviderType)
                                  .map(type => ({ value: type.componentName, label: type.componentName }))}
                                value={
                                  Array.isArray(boughtOutPart.componentName)
                                    ? boughtOutPart.componentName[0] || ''
                                    : boughtOutPart.componentName && typeof boughtOutPart.componentName === 'object'
                                      ? boughtOutPart.componentName.value || boughtOutPart.componentName.label || boughtOutPart.componentName.componentName || ''
                                      : boughtOutPart.componentName || ''
                                }
                                onChange={newValue => {
                                  let val = '';
                                  if (Array.isArray(newValue)) {
                                    const first = newValue[0];
                                    val = typeof first === 'object' && first !== null ? first.value || first.label || '' : first || '';
                                  } else if (typeof newValue === 'object' && newValue !== null) {
                                    val = newValue.value || newValue.label || '';
                                  } else {
                                    val = newValue || '';
                                  }
                                  formik.setFieldValue(`svcOutsourcedComponents[${index}].componentName`, val);
                                }}
                                onBlur={() => formik.setFieldTouched(`svcOutsourcedComponents.${index}.componentName`, true)}
                                name={`svcOutsourcedComponents[${index}].componentName`}
                                isRequired
                                max={100}
                                maxSuggestionLength={1}
                                error={getFieldError(`svcOutsourcedComponents.${index}.componentName`)}
                              />
                            </div>
                          </div>
                          <div className="row margintop-30">
                            <div className="col-md-4">
                              <FormControl component="fieldset" sx={{ marginBottom: 2, width: '100%' }}>
                                <div className="d-flex">
                                  <span className="label">Is this Service Component from Overseas?</span>
                                  <span className="asterics">*</span>
                                </div>
                                <RadioGroup
                                  value={formik.values.svcOutsourcedComponents?.[index]?.isImported === true ? 'yes' : formik.values.svcOutsourcedComponents?.[index]?.isImported === false ? 'no' : ''}
                                  onChange={e => {
                                    formik.setFieldValue(`svcOutsourcedComponents[${index}].isImported`, e.target.value === 'yes');
                                    if (e.target.value === 'no') {
                                      formik.setFieldValue(`svcOutsourcedComponents[${index}].importCountry`, '');
                                      formik.setFieldValue(`svcOutsourcedComponents[${index}].importPercentage`, '');
                                      formik.setFieldTouched(`svcOutsourcedComponents.${index}.importCountry`, false);
                                      formik.setFieldTouched(`svcOutsourcedComponents.${index}.importPercentage`, false);
                                    }
                                  }}
                                  name={`svcOutsourcedComponents[${index}].isImported`}
                                  sx={{ flexDirection: 'row', gap: 2 }}>
                                  <FormControlLabel
                                    value="yes"
                                    control={
                                      <Radio
                                        icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />}
                                        checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />}
                                      />
                                    }
                                    label="Yes"
                                    sx={{
                                      marginRight: 3,
                                      '& .MuiFormControlLabel-label': {
                                        fontSize: '14px',
                                      },
                                    }}
                                  />
                                  <FormControlLabel
                                    value="no"
                                    control={
                                      <Radio
                                        icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />}
                                        checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />}
                                      />
                                    }
                                    label="No"
                                    sx={{
                                      '& .MuiFormControlLabel-label': {
                                        fontSize: '14px',
                                      },
                                    }}
                                  />
                                </RadioGroup>
                                {formik.touched.svcOutsourcedComponents?.[index]?.isImported && formik.errors.svcOutsourcedComponents?.[index]?.isImported && (
                                  <div className="error-text">{formik.errors.svcOutsourcedComponents[index].isImported}</div>
                                )}
                              </FormControl>
                            </div>
                            {formik.values.svcOutsourcedComponents?.[index]?.isImported === true && (
                              <>
                                <div className="col-md-5">
                                  <AppDropdown
                                    label="Source Country"
                                    placeholder="Select Source Country"
                                    value={formik.values.svcOutsourcedComponents?.[index]?.importCountry}
                                    onChange={formik.handleChange}
                                    onBlur={formik.handleBlur}
                                    name={`svcOutsourcedComponents[${index}].importCountry`}
                                    options={countryOptions.filter(
                                      option =>
                                        String(option.label || '')
                                          .trim()
                                          .toLowerCase() !== 'india',
                                    )}
                                    isRequired={true}
                                    error={formik.touched.svcOutsourcedComponents?.[index]?.importCountry && formik.errors.svcOutsourcedComponents?.[index]?.importCountry}
                                  />
                                </div>
                                <div className="col-md-3">
                                  <AppInput
                                    label="Overseas Sourcing (%)"
                                    placeholder="Enter Percentage(%)"
                                    value={formik.values.svcOutsourcedComponents?.[index]?.importPercentage}
                                    percentageFormat={true}
                                    onChange={e => formik.setFieldValue(`svcOutsourcedComponents[${index}].importPercentage`, e.target.value)}
                                    onBlur={formik.handleBlur}
                                    name={`svcOutsourcedComponents[${index}].importPercentage`}
                                    isRequired={true}
                                    error={formik.touched.svcOutsourcedComponents?.[index]?.importPercentage && formik.errors.svcOutsourcedComponents?.[index]?.importPercentage}
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ))}

                      <AppButton
                        variant="primary"
                        onClick={() =>
                          push({
                            componentName: '',
                            isImported: null,
                            importCountry: '',
                            importPercentage: '',
                          })
                        }
                        title={'Add More'}
                        leftIcon={Icons.addMore}
                        leftIconStyle={'icon-16'}
                        customClass={'ms-auto'}
                      />
                    </>
                  )
                }
              </FieldArray>
            </div>
          </div>
        );
      case 3:
        return (
          <div>
            <div className="step-header">
              <div className="row">
                <div className="col-md-12">
                  <h2 className="step-header-title">Documents & Declarations</h2>
                  <p className="step-header-subtitle">Compliance Checks, Final Declarations</p>
                </div>
              </div>
            </div>

            {/* Third Party Certifications Section */}
            <div className="form-section">
              <div className="row margintop-30">
                <h5 className="section-title mb-0">QUALITY CERTIFICATIONS</h5>

                <div className="col-md-12 margin-top-30">
                  <AppSuggestionInput
                    name="thirdPartyCertifications"
                    label="Third Party Certifications"
                    subLabel={'Type or select all quality certifications the unit has obtained (e.g., ISO 9001, ISO 14001, etc.)'}
                    suggestions={thirdPartyCerts?.data?.map(cert => ({ label: cert.certificationName, value: cert.certificationName }))}
                    value={formik.values.thirdPartyCertifications}
                    placeholder="Select or Type & press enter"
                    max={100}
                    optionWidth="100%"
                    enableBulkActions
                    onChange={newValue => formik.setFieldValue('thirdPartyCertifications', Array.isArray(newValue) ? newValue : [])}
                    isRequired={true}
                    maxSuggestions={10}
                    error={formik.touched.thirdPartyCertifications && formik.errors.thirdPartyCertifications ? formik.errors.thirdPartyCertifications : ''}
                  />
                </div>
              </div>
              <div className="row margintop-30">
                <h5 className="section-title">COMPLIANCE QUESTIONNAIRE</h5>
                <div className="col-md-6">
                  <FormControl component="fieldset" sx={{ marginBottom: 2, width: '100%' }}>
                    <div className="d-flex">
                      <span className="label">
                        Has the unit ever been blacklisted or banned by any government organization? <span className="asterics">*</span>
                      </span>
                    </div>
                    <RadioGroup
                      value={formik.values.isBlacklisted || ''}
                      onChange={e => {
                        formik.setFieldValue('isBlacklisted', e.target.value);
                        // Clear blacklistedOrganizations when switching to "No"
                        if (e.target.value === 'no') {
                          formik.setFieldValue('blacklistedOrganizations', '');
                          formik.setFieldTouched('blacklistedOrganizations', false);
                        }
                      }}
                      sx={{ flexDirection: 'row', gap: 2 }}>
                      <FormControlLabel
                        value="yes"
                        control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                        label="Yes"
                        sx={{
                          marginRight: 3,
                          '& .MuiFormControlLabel-label': {
                            fontSize: '14px',
                          },
                        }}
                      />
                      <FormControlLabel
                        value="no"
                        control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                        label="No"
                        sx={{
                          '& .MuiFormControlLabel-label': {
                            fontSize: '14px',
                          },
                        }}
                      />
                    </RadioGroup>
                    <p className="fs-12 fw-italic-400 mb-0 margin-top-4 text-3-color">This includes DRDO, Ministry of Defence, or any other government department.</p>
                    {formik.touched.isBlacklisted && formik.errors.isBlacklisted ? <div className="error-text">{formik.errors.isBlacklisted}</div> : null}
                  </FormControl>
                </div>

                {formik.values.isBlacklisted === 'yes' && (
                  <div className="col-md-6">
                    <AppSuggestionInput
                      name="blacklistedOrganizations"
                      placeholder="Enter the Name & Press Enter"
                      label={'Name of the Organisations'}
                      max={100}
                      optionWidth="100%"
                      subLabel={'Enter organization name and press enter. You can enter multiple organizations.'}
                      suggestions={[]}
                      value={safeSplitComma(formik.values.blacklistedOrganizations)}
                      onChange={newValue => {
                        const val = Array.isArray(newValue) ? newValue.join(', ') : newValue || '';
                        formik.setFieldValue('blacklistedOrganizations', val);
                      }}
                      isRequired={true}
                      maxSuggestions={10}
                      error={formik.touched.blacklistedOrganizations && formik.errors.blacklistedOrganizations ? formik.errors.blacklistedOrganizations : ''}
                    />
                  </div>
                )}
              </div>
              <div className="row margintop-30">
                <div className="col-md-12">
                  <FormControl component="fieldset" sx={{ marginBottom: 2, width: '100%' }}>
                    <div className="d-flex">
                      <span className="label">Is there any ongoing enquiry or investigation against the unit?</span>
                      <span className="asterics">*</span>
                    </div>
                    <RadioGroup value={formik.values.hasOngoingEnquiry || ''} onChange={e => formik.setFieldValue('hasOngoingEnquiry', e.target.value)} sx={{ flexDirection: 'row', gap: 2 }}>
                      <FormControlLabel
                        value="yes"
                        control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                        label="Yes"
                        sx={{
                          marginRight: 3,
                          '& .MuiFormControlLabel-label': {
                            fontSize: '14px',
                          },
                        }}
                      />
                      <FormControlLabel
                        value="no"
                        control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                        label="No"
                        sx={{
                          '& .MuiFormControlLabel-label': {
                            fontSize: '14px',
                          },
                        }}
                      />
                    </RadioGroup>
                    <p className="fs-12 fw-italic-400 mb-0 margin-top-4 text-3-color">This includes enquiries by government departments, regulatory bodies, or law enforcement.</p>

                    {formik.touched.hasOngoingEnquiry && formik.errors.hasOngoingEnquiry ? <div className="error-text">{formik.errors.hasOngoingEnquiry}</div> : null}
                  </FormControl>
                </div>
              </div>
              <div className="row margintop-30">
                <h5 className="section-title">FINAL DECLARATIONS</h5>
                <div className="col-md-12">
                  <div className="declaration-section">
                    {/* First Declaration Checkbox */}
                    <div className="form-check">
                      <div className="custom-checkbox d-flex align-items-start">
                        <div onClick={handleInformationTrueAgreementChange} style={{ cursor: 'pointer' }}>
                          {formik.values.informationTrueAgreement ? (
                            <img src={Icons.squareTick} alt="checkbox" className="icon-22" />
                          ) : (
                            <img src={Icons.squareUncheck} alt="checkbox" className="icon-22" />
                          )}
                        </div>
                        <label className="form-check-label mb-0">
                          I declare that all information provided in this application is true and accurate to the best of my knowledge. I understand that if any information is found to be false or
                          misleading:
                          <ul>
                            <li>My application may be rejected</li>
                            <li>Any rating or certification granted may be cancelled</li>
                            <li> Appropriate action may be taken by DRDO or QCI</li>
                          </ul>
                        </label>
                      </div>
                      {formik.touched.informationTrueAgreement && formik.errors.informationTrueAgreement && <div className="error-text">{formik.errors.informationTrueAgreement}</div>}
                    </div>

                    {/* Second Declaration Checkbox */}
                    <div className="form-check margintop-30">
                      <div className="custom-checkbox d-flex align-items-start">
                        <div onClick={handleApplicationAcceptanceAgreementChange} style={{ cursor: 'pointer' }}>
                          {formik.values.applicationAcceptanceAgreement ? (
                            <img src={Icons.squareTick} alt="checkbox" className="icon-22" />
                          ) : (
                            <img src={Icons.squareUncheck} alt="checkbox" className="icon-22" />
                          )}
                        </div>
                        <label className="form-check-label mb-0">I understand that the acceptance of my application is at the sole discretion of DRDO and QCI.</label>
                      </div>
                      {formik.touched.applicationAcceptanceAgreement && formik.errors.applicationAcceptanceAgreement && (
                        <div className="error-text">{formik.errors.applicationAcceptanceAgreement}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <div>
            <div className="step-header">
              <div className="row">
                <div className="col-md-12">
                  <h2 className="step-header-title">
                    Review & Submit
                    <RenewalTag application={formik.values} className="margin-left-10" />
                  </h2>
                  <p className="step-header-subtitle">Final Review & Submission</p>
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="row margintop-30">
                <div className="col-12">
                  <div className="details-card border-1-light-grey">
                    <div className="top-details-card">
                      <div className="top-details-card-content">
                        <div className="top-right-details-card">
                          <div className="d-flex align-items-start gap-2 mt-1">
                            <p className="fs-22 fw-600 mb-0 text-3-color flex-shrink-0 unit-name-label">Unit Name:</p>
                            <h4 className="fs-24 fw-600 heading-color mb-0 unit-name-value">{formik.values?.unitName}</h4>
                          </div>
                          <ul className="d-flex align-items-center margin-top-8 list-unstyled mb-0">
                            <li className="fs-14 fw-500 text-2-color text-capitalize">{formik.values.enterpriseClassification === 'startup' ? 'Start-Up' : formik.values.enterpriseClassification}</li>
                            <li className="company-Tags-bullet"></li>
                            <li className="fs-14 fw-500 text-2-color text-capitalize">Services</li>
                          </ul>
                          <div className="d-flex align-items-center margin-top-16">
                            <img src={Icons.enterpriseInfoDone} alt="documnet" className="icon-24 margin-right-8" />

                            <div className="d-flex align-items-center gap-2">
                              <p className="fs-12 fw-500 mb-0 text-3-color">Enterprise Name:</p>
                              <p className="fs-14 fw-500 mb-0 heading-color">{(formik.values.enterpriseName || '').toUpperCase()}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="bottom-details-card">
                      <div className="each-details-box">
                        <img src={Icons.documentText} alt="documnet" className="icon-24" />
                        {formik.values.enterpriseClassification === 'startup' && (
                          <div>
                            <p className="fs-12 fw-500 mb-1 text-3-color">DPIIT Registration Number</p>
                            <div className="d-flex align-items-end">
                              <p className="fs-14 fw-500 mb-0 heading-color">{formatDisplayValue(formik.values.dpiitRegistrationNumber)}</p>

                              {formik.values.dpiitCertificateFile && (
                                <AppButton size="small" variant="link" title={'View'} onClick={() => downloadFile({ downloadUrl: formik.values.dpiitCertificateFile })} />
                              )}
                            </div>
                          </div>
                        )}
                        {formik.values.enterpriseClassification === 'large' && (
                          <div>
                            <p className="fs-12 fw-500 mb-1 text-3-color">Incorporation Number </p>
                            <div className="d-flex align-items-end">
                              <p className="fs-14 fw-500 mb-0 heading-color">{formatDisplayValue(formik.values.cin)}</p>

                              {formik.values.incorporationCertificateFile && (
                                <AppButton size="small" variant="link" title={'View'} onClick={() => downloadFile({ downloadUrl: formik.values.incorporationCertificateFile })} />
                              )}
                            </div>
                          </div>
                        )}
                        {/* Show UDYAM registration for micro / small / medium */}
                        {['micro', 'small', 'medium'].includes(formik.values.enterpriseClassification) && (
                          <div>
                            <p className="fs-12 fw-500 mb-1 text-3-color">UDYAM Registration Number</p>
                            <div className="d-flex align-items-end">
                              <p className="fs-14 fw-500 mb-0 heading-color">{formatDisplayValue(formik.values.udyamRegistrationNumber)}</p>
                              {formik.values.udyamCertificateFile && (
                                <AppButton size="small" variant="link" title={'View'} onClick={() => downloadFile({ downloadUrl: formik.values.udyamCertificateFile })} />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="vertical-divider" />
                      <div className="each-details-box">
                        <img src={Icons.documentText} alt="documnet" className="icon-24" />
                        <div>
                          <div className="d-flex align-items-center">
                            <p className="fs-12 fw-500 mb-0 text-3-color">DRDO / DRDO Lab Registration Number</p>
                            {formik.values.drdoRegistrationNumber && <img src={Icons.greenTick} className="icon-15 margin-left-4" />}
                          </div>
                          <div className="d-flex align-items-end">
                            <p className="fs-14 fw-500 mb-0 heading-color">{formik.values.drdoRegistrationNumber ? formik.values.drdoRegistrationNumber : '-'}</p>

                            {formik.values.drdoCertificateFile && (
                              <AppButton size="small" variant="link" title={'View'} onClick={() => downloadFile({ downloadUrl: formik.values.drdoCertificateFile })} />
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="vertical-divider" />
                      <div className="each-details-box">
                        <img src={Icons.calendarBlue} alt="calendar" className="icon-24 margin-top-6" />
                        <div>
                          <p className="fs-12 fw-500 text-3-color mb-0">Commencement Date of Unit</p>
                          <div className="d-flex align-items-center">
                            <p className="fs-14 fw-500 heading-color mb-0 margin-top-2">{formatDate(formik.values.unitCommencementDate)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Accordion defaultActiveKey={['0', '1', '2', '3', '4', '5']} alwaysOpen>
                    <Accordion.Item eventKey="0" className="details-card p-0 border-1-light-grey">
                      <Accordion.Header>Office / Work Location & Contact Details</Accordion.Header>
                      <Accordion.Body className="p-0">
                        <div className="details-card">
                          <div className="enterpriseInfoMainWrapper">
                            <div className="row">
                              <div className="col-sm-6">
                                <div className="enterpriseInfoWrapper">
                                  <h5 className="dark-text">Work Address</h5>
                                  <span>{formatFullAddress(formik.values.unitAddress, formik.values.unitDistrict, formik.values.unitState, formik.values.unitPincode)}</span>
                                  <ul className="enterpriseInfoUl">
                                    <li>
                                      <img src={Icons.receiver} alt="documnet" className="icon-20 margin-right-8" />
                                      <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Mobile Number:</p>
                                      <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formik.values.unitMobile}</p>
                                    </li>
                                    <li>
                                      <img src={Icons.landline} alt="documnet" className="icon-20 margin-right-8" />
                                      <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Landline Number:</p>
                                      <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formik.values.unitLandline ? formik.values.unitLandline : '-'}</p>
                                    </li>
                                    <li>
                                      <img src={Icons.email} alt="documnet" className="icon-20 margin-right-8" />
                                      <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Email:</p>
                                      <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formatDisplayValue(formik.values.unitEmail)}\ </p>
                                    </li>
                                    <li>
                                      <img src={Icons.email} alt="documnet" className="icon-20 margin-right-8" />
                                      <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Alternate Email:</p>
                                      <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">
                                        <Link href={`mailto:${formik.values.unitAlternateEmail}`} target="_blank" rel="noopener noreferrer">
                                          {formatDisplayValue(formik.values.unitAlternateEmail ? formik.values.unitAlternateEmail : '-')}
                                        </Link>
                                      </p>
                                    </li>
                                    <li>
                                      <img src={Icons.gallery} alt="documnet" className="icon-20 margin-right-8" />
                                      <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Picture of Site Exterior:</p>
                                      <AppButton size="small" variant="link" title={'View'} onClick={() => handleOpenImagePreview(formik.values.siteExteriorPhoto)} />
                                    </li>
                                  </ul>
                                </div>
                              </div>
                              <div className="col-sm-6">
                                <div className="enterpriseInfoWrapper">
                                  <h5 className="dark-text">Registered Office Address</h5>
                                  <span>
                                    {formatFullAddress(
                                      formik.values.registeredOfficeAddress,
                                      formik.values.registeredOfficeDistrict,
                                      formik.values.registeredOfficeState,
                                      formik.values.registeredOfficePincode,
                                    )}
                                  </span>
                                  <ul className="enterpriseInfoUl">
                                    <li>
                                      <img src={Icons.receiver} alt="documnet" className="icon-20 margin-right-8" />
                                      <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Mobile Number:</p>
                                      <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formik.values.registeredOfficeMobile}</p>
                                    </li>
                                    <li>
                                      <img src={Icons.landline} alt="documnet" className="icon-20 margin-right-8" />
                                      <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Landline Number:</p>
                                      <p className="fs-12 fw-500 mb-0 heading-color margin-left-12"> {formik.values.registeredOfficeLandline ? formik.values.registeredOfficeLandline : '-'}</p>
                                    </li>
                                    <li>
                                      <img src={Icons.email} alt="documnet" className="icon-20 margin-right-8" />
                                      <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Email:</p>
                                      <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">
                                        <Link href={`mailto:${formik.values.registeredOfficeEmail}`} target="_blank" rel="noopener noreferrer">
                                          {formatDisplayValue(formik.values.registeredOfficeEmail)}
                                        </Link>
                                      </p>
                                    </li>
                                    <li>
                                      <img src={Icons.email} alt="documnet" className="icon-20 margin-right-8" />
                                      <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Alternate Email:</p>
                                      <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">
                                        <Link href={`mailto:${formik.values.registeredOfficeAlternateEmail}`} target="_blank" rel="noopener noreferrer">
                                          {formatDisplayValue(formik.values.registeredOfficeAlternateEmail ? formik.values.registeredOfficeAlternateEmail : '-')}
                                        </Link>
                                      </p>
                                    </li>
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </div>
                          <hr className="divider-small" />
                          <h5 className="heading-color">Category & Services</h5>
                          <div className="col-md-12 align-items-center">
                            <div className="cus-bx-1 ">
                              <span className="fs-12 fw-400 text-2-color">Category:</span>

                              <span className="fs-14 fw-500 heading-color margin-left-8">{formik.values.vendorCategory}</span>
                            </div>
                            <div className="cus-bx-1 ">
                              <span className="fs-12 fw-400 text-2-color">Services:</span>
                              {(formik.values.svcDrdoVendorLabs || [])?.map((item, idx) => (
                                <span key={idx} className="margin-left-8 cusTags">
                                  {typeof item === 'object' ? item.labName || item.processName || item.name : item}
                                </span>
                              ))}
                            </div>
                          </div>
                          <hr className="divider-small" />
                          <div className="bottom-EnterpriseInfo">
                            <h5 className="heading-color">Contact Person</h5>
                            <ul className="enterpriseInfoUl enterpriseInfoHorizontalUl">
                              <li>
                                <img src={Icons.user} alt="documnet" className="icon-20 margin-right-8" />
                                <p className="fs-12 fw-400 mb-0 text-3-color">Name:</p>
                                <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formatDisplayValue(formik.values.contactPersonName)}</p>
                              </li>
                              <li>
                                <img src={Icons.designation} alt="documnet" className="icon-20 margin-right-8" />
                                <p className="fs-12 fw-400 mb-0 text-3-color">Designation:</p>
                                <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formatDisplayValue(formik.values.contactPersonDesignation)}</p>
                              </li>
                              <li>
                                <img src={Icons.receiver} alt="documnet" className="icon-20 margin-right-8" />
                                <p className="fs-12 fw-400 mb-0 text-3-color">Mobile Number:</p>
                                <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formik.values.contactPersonMobile}</p>
                              </li>
                              <li>
                                <img src={Icons.email} alt="documnet" className="icon-20 margin-right-8" />
                                <p className="fs-12 fw-400 mb-0 text-3-color">Email:</p>
                                <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formatDisplayValue(formik.values.contactPersonEmail)}</p>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </Accordion.Body>
                    </Accordion.Item>
                    <Accordion.Item eventKey="1" className="details-card p-0 border-1-light-grey">
                      <Accordion.Header>Operational Details</Accordion.Header>
                      <Accordion.Body className="p-0">
                        <div className="details-card">
                          <div className="enterpriseInfoMainWrapper">
                            <div className="row">
                              <div className="col-sm-12">
                                <div className="enterpriseInfoWrapper">
                                  <ul className="enterpriseInfoUl gap-14">
                                    <li>
                                      <img src={Icons.tickCircle} alt="documnet" className="icon-20 margin-right-8" />
                                      <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-2-color w-auto">Ownership Type:</p>
                                      <p className="fs-12 fw-500 mb-0 heading-color margin-left-12 text-capitalize">
                                        {formatDisplayValue((ownershipTypeOptions.find(o => o.value === formik.values.ownershipType) || {}).label || formik.values.ownershipType)}
                                      </p>
                                    </li>
                                    <li>
                                      <img src={Icons.users} alt="documnet" className="icon-20 margin-right-8" />
                                      <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-2-color w-auto">Number of Employees:</p>
                                      <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">
                                        {formatNumber(
                                          (Number(formik.values.maleEmployeesCount) || 0) + (Number(formik.values.femaleEmployeesCount) || 0) + (Number(formik.values.otherEmployeesCount) || 0),
                                        )}
                                      </p>
                                      <ul className="numberEmployeesUl">
                                        <li>(</li>
                                        <li>
                                          <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-2-color w-auto">Male Employees</p>
                                          <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formatNumber(parseNumericOrNull(formik.values.maleEmployeesCount))}</p>
                                        </li>
                                        <li className="enterpriseInfoUl-divider"></li>
                                        <li>
                                          <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-2-color w-auto">Female Employees</p>
                                          <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formatNumber(parseNumericOrNull(formik.values.femaleEmployeesCount))}</p>
                                        </li>
                                        <li className="enterpriseInfoUl-divider"></li>
                                        <li className="me-0">
                                          <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-2-color w-auto">Other Employees</p>
                                          <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formatNumber(parseNumericOrNull(formik.values.otherEmployeesCount))}</p>
                                        </li>
                                        <li>)</li>
                                      </ul>
                                    </li>
                                    <li>
                                      <img src={Icons.documentText} alt="documnet" className="icon-20 margin-right-8" />
                                      <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-2-color w-auto">GST Number:</p>
                                      <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formik.values.hasGst === 'yes' ? formatDisplayValue(formik.values.gstNumber) : 'No'}</p>
                                      {formik.values.hasGst === 'yes' && formik.values.gstCertificateFile && (
                                        <AppButton size="small" variant="link" title={'View'} onClick={() => downloadFile(formik.values.gstCertificateFile, 'gst_certificate')} />
                                      )}
                                    </li>
                                    <li>
                                      <img src={Icons.organisation} alt="documnet" className="icon-20 margin-right-8" />
                                      <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-2-color w-auto">Registered with Government Organisation:</p>
                                      <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formik.values.hasGovtRegistration === 'yes' ? formik.values.govtOrganisationName : 'No'}</p>

                                      {formik.values.hasGovtRegistration === 'yes' && formik.values.govtRegistrationCertificate && (
                                        <AppButton size="small" variant="link" title={'View'} onClick={() => downloadFile(formik.values.govtRegistrationCertificate, 'govt_registration')} />
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
                    <Accordion.Item eventKey="2" className="details-card p-0 border-1-light-grey">
                      <Accordion.Header>Service & Customer Details</Accordion.Header>
                      <Accordion.Body className="p-0">
                        <div className="details-card">
                          <div className="enterpriseInfoMainWrapper">
                            <div className="row">
                              <div className="col-sm-6 support-form-section">
                                <div className="enterpriseInfoWrapper">
                                  <h5 className="dark-text mb-4">Services</h5>
                                  <table className="table product-details-table">
                                    <thead>
                                      <tr>
                                        <th>S.No</th>
                                        <th>Name of Service</th>
                                        <th>Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(() => {
                                        const filteredServices = Array.isArray(formik.values.svcServices) ? formik.values.svcServices.filter(s => (s?.serviceName || '').toString().trim() !== '') : [];
                                        return filteredServices.map((service, index) => (
                                          <tr key={index}>
                                            <td>{index + 1}</td>
                                            <td className="text-capitalize">{service.serviceName}</td>
                                            <td>
                                              <a
                                                href="#"
                                                onClick={e => {
                                                  e.preventDefault();
                                                  handleViewService(service);
                                                }}>
                                                View
                                              </a>
                                            </td>
                                          </tr>
                                        ));
                                      })()}
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
                                      {(() => {
                                        const filteredCustomers = Array.isArray(formik.values.customers) ? formik.values.customers.filter(c => (c?.customerName || '').toString().trim() !== '') : [];
                                        return filteredCustomers.map((customer, index) => (
                                          <tr key={index}>
                                            <td>{index + 1}</td>
                                            <td className="text-capitalize">{customer.customerName || '-'}</td>
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
                                        ));
                                      })()}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Accordion.Body>
                    </Accordion.Item>
                    <Accordion.Item eventKey="3" className="details-card p-0 border-1-light-grey">
                      <Accordion.Header>Key Services</Accordion.Header>
                      <Accordion.Body className="p-0">
                        <div className="details-card pt-0">
                          <div className="enterpriseInfoMainWrapper">
                            <div className="row align-items-center">
                              <div className="col-md-12 align-items-cente">
                                <div className="cus-bx-1 ">
                                  <span className="fs-12 fw-400 text-2-color">Key Services:</span>
                                  {(formik.values.svcKeyProcesses || []).map((item, i) => (
                                    <span key={`kp-${i}`} className="margin-left-8 cusTags">
                                      {typeof item === 'object' && item.processName ? item.processName : formatDisplayValue(item)}
                                    </span>
                                  ))}
                                </div>
                                {formik.values.svcOutsourcedProcesses.length > 0 && (
                                  <div className="cus-bx-1">
                                    <span className="fs-12 fw-400 text-2-color">Outsourced Services:</span>
                                    {(formik.values.svcOutsourcedProcesses || []).map((item, i) => (
                                      <span key={`op-${i}`} className="margin-left-8 cusTags">
                                        {typeof item === 'object' && item.processName ? item.processName : formatDisplayValue(item)}
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
                    <Accordion.Item eventKey="4" className="details-card p-0 border-1-light-grey">
                      <Accordion.Header>Key Service Resources / Outsourced Service Component</Accordion.Header>
                      <Accordion.Body className="p-0">
                        <div className="details-card pt-0 pb-0">
                          <div className="enterpriseInfoMainWrapper">
                            <table className="table product-details-table firstChildInherit">
                              <thead>
                                <tr>
                                  <th>
                                    Key Service Resources / <br /> Outsourced Service Component
                                  </th>
                                  <th>Name</th>
                                  <th>From Overseas?</th>
                                  <th>Source Country</th>
                                  <th>Overseas Sourcing (%)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  const filteredResources = Array.isArray(formik.values.svcKeyResources)
                                    ? formik.values.svcKeyResources.filter(r => (r?.resourceName || r?.resource || '').toString().trim() !== '')
                                    : [];
                                  return filteredResources.map((resource, idx) => (
                                    <tr key={`kr-${idx}`}>
                                      <td>Key Service Resource</td>
                                      <td>{formatDisplayValue(resource && resource.resourceName ? resource.resourceName : '')}</td>
                                      <td>{resource && (resource.isImported === true || resource.isImported === 'yes') ? 'Yes' : 'No'}</td>
                                      <td>{resource && resource.importCountry ? resource.importCountry : '-'}</td>
                                      <td>{resource && resource.importPercentage ? `${formatNumber(parseNumericOrNull(resource.importPercentage))}%` : '-'}</td>
                                    </tr>
                                  ));
                                })()}
                                {(() => {
                                  const filteredComponents = Array.isArray(formik.values.svcOutsourcedComponents)
                                    ? formik.values.svcOutsourcedComponents.filter(c => (c?.componentName || c?.resourceName || '').toString().trim() !== '')
                                    : [];
                                  return filteredComponents.map((component, idx) => (
                                    <tr key={`oc-${idx}`}>
                                      <td>Outsourced Service Component</td>
                                      <td>{formatDisplayValue(component && component.componentName ? component.componentName : '')}</td>
                                      <td>{component && (component.isImported === true || component.isImported === 'yes') ? 'Yes' : 'No'}</td>
                                      <td>{component && component.importCountry ? component.importCountry : '-'}</td>
                                      <td>{component && component.importPercentage ? `${formatNumber(parseNumericOrNull(component.importPercentage))}%` : '-'}</td>
                                    </tr>
                                  ));
                                })()}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </Accordion.Body>
                    </Accordion.Item>
                    <Accordion.Item eventKey="5" className="details-card p-0 border-1-light-grey">
                      <Accordion.Header>Documents & Declarations</Accordion.Header>
                      <Accordion.Body className="p-0">
                        <div className="details-card pt-0">
                          <div className="enterpriseInfoMainWrapper">
                            <div className="row align-items-center">
                              <div className="col-md-12 align-items-cente">
                                <div className="cus-bx-1 ">
                                  <img src={Icons.tickSuccess} alt="key-process" className="icon-16 margin-right-8" />
                                  <span className="fs-12 fw-400 text-2-color">Third Party Certifications:</span>
                                  {(formik.values.thirdPartyCertifications || []).map((name, idx) => (
                                    <span key={idx} className="margin-left-8 cusTags">
                                      {formatDisplayValue(name)}
                                    </span>
                                  ))}
                                </div>
                                <div className="cus-bx-1">
                                  <img src={Icons.tickSuccess} alt="outsourced-process" className="icon-16 margin-right-8" />
                                  <span className="fs-12 fw-400 text-2-color">Whether blacklisted/banned ever by any competent authority?</span>
                                  {formik.values?.isBlacklisted === 'yes' ? (
                                    safeSplitComma(formik.values?.blacklistedOrganizations || '').map((name, idx) => (
                                      <span key={idx} className="margin-left-8 cusTags">
                                        {formatDisplayValue(name)}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="fs-14 fw-500 heading-color margin-left-8">No</span>
                                  )}
                                </div>
                                <div className="cus-bx-1">
                                  <img src={Icons.danger} alt="outsourced-process" className="icon-16 margin-right-8" />
                                  <span className="fs-12 fw-400 text-2-color">Any ongoing enquiry/investigation against firm?</span>
                                  <span className="fs-14 fw-500 heading-color margin-left-8">{formik.values.hasOngoingEnquiry === 'yes' ? 'Yes' : 'No'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Accordion.Body>
                    </Accordion.Item>
                  </Accordion>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="table-container">
            <div className="header-section">
              <h1 className="heading-createApp">Create New Application</h1>
              <div className="heading-seperator"></div>
              <ul className="breadCrumbHeader">
                <li>My Applications</li>
                <div className="dot-separator" />
                <li>New Application</li>
              </ul>
            </div>
            <div className="main-content-section">
              <div className="row">
                <div className="col-12">
                  <Box>
                    {/* Fully Custom Stepper - no connector line */}
                    <div className="custom-stepper">
                      {steps?.map((step, idx) => {
                        let iconSrc = step.icon;
                        if (activeStep === idx) {
                          iconSrc = step.activeIcon;
                        }
                        if (activeStep > idx) {
                          iconSrc = step.doneIcon;
                        }
                        return (
                          <>
                            <div key={step.title} className={`step-item${activeStep === idx ? ' active' : ''}${activeStep > idx ? ' done' : ''}`}>
                              <div className="step-icon-wrapper">
                                <div className={`img-newApplication${activeStep === idx ? ' active' : ''}${activeStep > idx ? ' done' : ''}`}>
                                  <img src={iconSrc} alt={step.title} className="icon-24" />
                                </div>
                              </div>
                              <div className="step-labels">
                                <div className="fs-14 fw-600 step-title">{step.title}</div>
                                <div className="fs-12 fw-500 margin-top-4 text-3-color step-subtitle">{step.subtitle}</div>
                              </div>
                            </div>
                            {idx < steps.length - 1 && (
                              <div>
                                <img src={activeStep > idx ? Icons.arrowBlue : Icons.arrowGrey} alt="arrow" className="icon-12" />
                              </div>
                            )}
                          </>
                        );
                      })}
                    </div>

                    <Box className="margin-top-32" onBlur={handleAutosaveBlur}>
                      <FormikProvider value={formik}>{renderStepContent()}</FormikProvider>
                    </Box>

                    {autosaveStatus !== 'idle' && (
                      <div className={`fs-12 fw-500 margin-top-20 text-end ${autosaveStatus === 'error' ? 'text-danger' : 'text-3-color'}`}>
                        {autosaveStatus === 'saving' ? 'Saving...' : autosaveStatus === 'saved' ? 'All changes saved' : 'Could not save - changes will retry on next edit'}
                      </div>
                    )}

                    <Box className={'margin-top-50 d-flex align-items-center justify-content-between'}>
                      {activeStep === 0 ? null : <AppButton variant="tertiary" onClick={handleBack} title={'Previous'} leftIcon={Icons.arrowLeft} leftIconStyle={'icon-16'} />}

                      {activeStep === steps.length - 1 ? (
                        // Review step - show Submit Application button
                        <div className="d-flex flex-column align-items-end">
                          <AppButton
                            variant="primary"
                            onClick={handleOpenSubmitModal}
                            title={'Submit Application'}
                            rightIcon={Icons.arrowRight}
                            rightIconStyle={'icon-16'}
                            disabled={submitServiceApplicationLoading || !isApplicationSubmissionOpen}
                            loading={submitServiceApplicationLoading}
                          />
                          {!isApplicationSubmissionOpen && <p className="text-danger fs-12 mt-2 mb-0">Application submission is currently closed. Please try again later.</p>}
                        </div>
                      ) : activeStep === steps.length - 2 ? (
                        // Last form step (Compliance) - save and go to review
                        <AppButton
                          variant="primary"
                          onClick={handleNext}
                          title={'Save & Review'}
                          rightIcon={Icons.arrowRight}
                          rightIconStyle={'icon-16'}
                          disabled={isSubmittingStep || createServiceApplicationLoading || !formik.values.applicationAcceptanceAgreement || !formik.values.informationTrueAgreement}
                          loading={isSubmittingStep || createServiceApplicationLoading}
                        />
                      ) : (
                        // Other steps - save and next
                        <AppButton
                          variant="primary"
                          onClick={handleNext}
                          title={'Save & Next'}
                          customClass={'ms-auto'}
                          rightIcon={Icons.arrowRight}
                          rightIconStyle={'icon-16'}
                          disabled={isSubmittingStep || createServiceApplicationLoading}
                          loading={isSubmittingStep || createServiceApplicationLoading}
                        />
                      )}
                    </Box>
                  </Box>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        show={showSuccessModal}
        image={Icons.successCircle}
        header={'Application Submitted Successfully!'}
        subHeader={'Your application has been received. You will be notified of the next steps via email.'}
        singleButton={true}
        buttonClassName={'w-100 primary medium'}
        singleButtonLabel="Continue"
        buttonOnClick={handleSuccessModalContinue}
      />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--warning-light)' }}
        image={Icons.warningIcon}
        show={showSubmitModal}
        handleClose={handleCloseSubmitModal}
        header={'Submit Application'}
        subHeader={
          drdoSetting?.value !== '0'
            ? 'Your application will be sent to DRDO for review.You will receive email updates on the application status and next steps.'
            : 'Your application will be sent for review. You will receive email updates on the application status and next steps.'
        }
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonOnClick={handleCloseSubmitModal}
        leftButtonDisabled={submitServiceApplicationLoading}
        rightButton="Submit"
        rightButtonClassName={'w-100 btn-primary'}
        rightButtonLoading={submitServiceApplicationLoading}
        rightButtonDisabled={submitServiceApplicationLoading}
        rightButtonOnClick={() => {
          const applicationIdToSubmit = applicationIdRef.current || currentApplicationId;
          if (applicationIdToSubmit) {
            dispatch(submitServiceApplicationAction(applicationIdToSubmit));
          }
        }}
      />

      <ApplicationLabsModal open={showApplicationLabsModal} onClose={handleCloseApplicationLabsModal} labs={formik?.values?.svcDrdoVendorLabs} type={'Labs'} />
      <ImagePreviewModal show={imagePreviewOpen} onClose={() => setImagePreviewOpen(false)} src={imagePreviewSrc} alt="Site Exterior" />
      <ServiceDetailModal open={serviceModalOpen} onClose={handleCloseServiceModal} service={selectedService} />
      <CustomerDetailModal open={customerModalOpen} onClose={handleCloseCustomerModal} customer={selectedCustomer} />
    </Layout>
  );
};

export default ServicesSteps;
