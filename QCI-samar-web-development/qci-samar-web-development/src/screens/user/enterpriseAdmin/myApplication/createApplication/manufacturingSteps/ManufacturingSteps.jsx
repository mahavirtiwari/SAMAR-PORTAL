import { Box, FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import dayjs from 'dayjs';
import { FieldArray, FormikProvider, useFormik } from 'formik';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Accordion } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import * as Yup from 'yup';
import { DeclarationAccuracyText, DeclarationDiscretionText } from '../../../../../../components/applicationTab/ApplicationDeclarations';
import { AppButton, AppDatePicker, AppDropdown, AppFileUpload, AppInput, AppInputWithDropdown, AppMultiSelectDropdown, AppSuggestionInput, RenewalTag } from '../../../../../../components/base';
import { toastError } from '../../../../../../components/base/toast';
import { Layout } from '../../../../../../components/layout';
import { ApplicationStoresModal, AppModal } from '../../../../../../components/modals';
import CustomerDetailModal from '../../../../../../components/modals/CustomerDetailModal';
import ImagePreviewModal from '../../../../../../components/modals/ImagePreviewModal';
import ProductDetailModal from '../../../../../../components/modals/ProductDetailModal';
import { ownershipTypeOptions } from '../../../../../../constants/filterData';
import Icons from '../../../../../../constants/Icons';
import { usePincodeAutofill } from '../../../../../../hooks';
import { getDrdoApprovalSettingByKeyAction } from '../../../../../../redux/action/common/SystemSettingAction';
import {
  autosaveManufacturingApplicationAction,
  createManufacturingApplicationAction,
  getApplicationAction,
  submitManufacturingApplicationAction,
  validateGstinAction,
} from '../../../../../../redux/action/enterpriseAdmin/application/ApplicationAction';
import {
  getStateAction,
  listBoughtOutPartsAction,
  listCountriesAction,
  listKeyProcessesAction,
  listKeyResourcesAction,
  listManufacturingStoresAction,
  listRawMaterialsAction,
  listThirdPartyCertsAction,
  listVendorCategoriesAction,
  listVendorLabsAction,
  pinCodeAction,
} from '../../../../../../redux/action/master/MasterAction';
import { getAllOrganizationsAction } from '../../../../../../redux/action/organizations/OrganizationAction';
import { resetCreateManufacturingApplication, resetSubmitManufacturingApplication } from '../../../../../../redux/slices/enterpriseAdmin/application/ApplicationSlice';
import SystemStatusService from '../../../../../../services/api/utils/SystemStatusService';
import { downloadFile } from '../../../../../../utils/FileUtils';
import { formatDate, formatDisplayValue, formatFullAddress, formatNumber, formatNumberInput, parseNumericOrNull } from '../../../../../../utils/formatters';
import { Logger } from '../../../../../../utils/logger';
import { cinNumberRegex, dpiitNumberRegex, emailRegex, gstNumberRegex, udyamNumberRegex } from '../../../../../../utils/Regex';
import { humanizeApplicationInProgressError } from '../../../../../../utils/serverErrorUtils';

const ApplicationSchema = Yup.object()
  .shape({
    isExistingDrdoVendor: Yup.string().required('Please select DRDO vendor status'),
    vendorCategory: Yup.string().required('Please select a vendor category'),
    mfgDrdoVendorStores: Yup.array()
      .of(
        Yup.object().shape({
          storeName: Yup.string().required('Please enter the store name'),
        }),
      )
      .min(1, 'Please add at least one DRDO vendor store')
      .required('Please add DRDO vendor stores'),
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
    unitName: Yup.string().max(100, 'Unit name cannot exceed 100 characters').required('Please enter the unit name'),
    registeredOfficeAddress: Yup.string().max(500, 'Address cannot exceed 500 characters').required('Please enter the registered office address'),
    registeredOfficeState: Yup.string().required('Please select the registered office state'),
    registeredOfficeDistrict: Yup.string().required('Please select the registered office district'),
    registeredOfficePincode: Yup.string()
      .required('Please enter the registered office pin code')
      .matches(/^[0-9]{6}$/, 'PIN code must be 6 digits'),

    registeredOfficeLandline: Yup.string().max(12, 'Landline Number cannot exceed 12 characters'),
    registeredOfficeMobile: Yup.string().max(10, 'Mobile number cannot exceed 10 digits').required('Please enter the registered office mobile number'),
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
    unitPincode: Yup.string()
      .required('Please enter the unit pin code')
      .matches(/^[0-9]{6}$/, 'PIN code must be 6 digits'),
    unitState: Yup.string().required('Please select the unit state'),
    unitDistrict: Yup.string().required('Please select the unit district'),
    unitMobile: Yup.string().max(10, 'Mobile number cannot exceed 10 digits').required('Please enter the unit mobile number'),
    unitEmail: Yup.string().max(320, 'Email address cannot exceed 320 characters').matches(emailRegex, 'Please enter a valid email address').required('Please enter the unit email address'),
    unitLandline: Yup.string().matches(/^[0-9]{12}$/, { message: 'Landline Number must be 12 digits', excludeEmptyString: true }),
    unitCommencementDate: Yup.string().required('Please select the unit commencement date'),
    siteExteriorPhoto: Yup.mixed().required('Please upload the site exterior photo'),
    contactPersonName: Yup.string().max(50, 'Contact person name cannot exceed 50 characters').required('Please enter the contact person name'),
    contactPersonDesignation: Yup.string().max(50, 'Contact person designation cannot exceed 50 characters').required('Please enter the contact person designation'),
    contactPersonMobile: Yup.string().max(10, 'Mobile number cannot exceed 10 digits').required('Please enter the contact person mobile number'),
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
      then: schema => schema.required('Please add GST number').matches(gstNumberRegex, 'GST number must be valid (e.g., 22AAAAA0000A1Z5)'),
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
    cin: Yup.string().when('enterpriseClassification', {
      is: 'large',
      then: schema =>
        schema.required('Please enter the CIN number').max(21, 'CIN number cannot exceed 21 characters').matches(cinNumberRegex, 'CIN number must be valid (e.g., L01631KA2010PTC096843)'),
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

    mfgKeyProcesses: Yup.array()
      .of(
        Yup.object().shape({
          processName: Yup.string()
            .required('Please enter the key process')
            .test('unique-process-name', 'Process name must be unique', function (value) {
              if (!value) {
                return true;
              }
              const processes = this.from?.[1]?.value?.mfgKeyProcesses || [];
              const currentIndex = parseInt(this.path?.match(/\[(\d+)\]/)?.[1] ?? '-1', 10);
              const duplicates = processes.filter((p, idx) => idx !== currentIndex && p.processName?.toLowerCase().trim() === value.toLowerCase().trim());
              return duplicates.length === 0;
            }),
        }),
      )
      .min(1, 'Please add at least one key process'),

    mfgOutsourcedProcesses: Yup.mixed()
      .test('mfg-outsourced-format', 'Outsourced processes must be an array of process names or objects', function (value) {
        if (value == null) {
          return true;
        }
        if (!Array.isArray(value)) {
          return false;
        }
        return true;
      })
      .test('mfg-outsourced-unique', 'Process name must be unique', function (value) {
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
        // Accept arrays or comma-separated strings
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
    mfgProducts: Yup.array()
      .of(
        Yup.object().shape({
          productName: Yup.string()
            .required('Please enter the product name')
            .test('unique-product-name', 'Product name must be unique', function (value) {
              if (!value) {
                return true;
              }
              const products = this.from?.[1]?.value?.mfgProducts || [];
              const currentIndex = parseInt(this.path?.match(/\[(\d+)\]/)?.[1] ?? '-1', 10);
              const duplicates = products.filter((p, idx) => idx !== currentIndex && p.productName?.toLowerCase().trim() === value.toLowerCase().trim());
              return duplicates.length === 0;
            }),
          totalProductionCapacity: Yup.number()
            .transform((value, originalValue) => parseNumericOrNull(originalValue))
            .typeError('Must be a number')
            .max(999999999999, 'Total production capacity cannot exceed 12 digits')
            .required('Please enter the total production capacity'),
          currentUtilizedCapacity: Yup.number()
            .transform((value, originalValue) => parseNumericOrNull(originalValue))
            .typeError('Must be a number')
            .max(999999999999, 'Utilized capacity cannot exceed 12 digits')
            .required('Please enter the current utilized capacity')
            .test('less-than-production', 'Utilized capacity cannot exceed total production capacity', function (value) {
              const { totalProductionCapacity } = this.parent;
              if (value === null || value === undefined || totalProductionCapacity === null || totalProductionCapacity === undefined) {
                return true;
              }
              return value <= totalProductionCapacity;
            }),
          commencementDate: Yup.string().required('Please select the commencement date'),
          isExported: Yup.boolean().required('Please select the exported status'),
          exportCountries: Yup.array().when('isExported', {
            is: true,
            then: schema => schema.min(1, 'Select at least one country').required('Export countries are required'),
            otherwise: schema => schema.notRequired(),
          }),
          exportPercentage: Yup.number()
            .transform((value, originalValue) => parseNumericOrNull(originalValue))
            .typeError('Must be a number')
            .when('isExported', {
              is: true,
              then: schema => schema.required('Please enter the export percentage').min(1, 'Percentage must be greater than 0').max(100, 'Percentage cannot exceed 100'),
              otherwise: schema => schema.notRequired(),
            }),
          // require capacity unit selection for each product
          capacityUnit: Yup.string().required('Please select a unit'),
        }),
      )
      .min(1, 'Please add at least one product')
      .required('Products are required')
      .test('export-percentage-total', 'Total export percentage across all products cannot exceed 100%', function (products) {
        if (!products) {
          return true;
        }
        const total = products.reduce((sum, p) => sum + (Number(p.exportPercentage) || 0), 0);
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
    mfgRawMaterials: Yup.array()
      .of(
        Yup.object().shape({
          materialName: Yup.string()
            .trim()
            .required('Please enter a key raw material name')
            .test('unique-material-name', 'Material name must be unique', function (value) {
              if (!value) {
                return true;
              }
              const materials = this.from?.[1]?.value?.mfgRawMaterials || [];
              const currentIndex = parseInt(this.path?.match(/\[(\d+)\]/)?.[1] ?? '-1', 10);
              const duplicates = materials.filter((m, idx) => idx !== currentIndex && m.materialName?.toLowerCase().trim() === value.toLowerCase().trim());
              return duplicates.length === 0;
            }),
          isImported: Yup.boolean().required('Please select the imported status'),
          importCountry: Yup.string().when('isImported', {
            is: true,
            then: schema => schema.required('Please select the import country'),
            otherwise: schema => schema.notRequired(),
          }),
          importPercentage: Yup.number()
            .transform((value, originalValue) => parseNumericOrNull(originalValue))
            .typeError('Must be a number')
            .when('isImported', {
              is: true,
              then: schema => schema.required('Please enter the import percentage').min(1, 'Percentage must be greater than 0').max(100, 'Percentage cannot exceed 100'),
              otherwise: schema => schema.notRequired(),
            }),
        }),
      )
      .notRequired()
      .test('import-percentage-total', 'Total import percentage across all raw materials cannot exceed 100%', function (materials) {
        if (!materials) {
          return true;
        }
        const total = materials.reduce((sum, m) => sum + (Number(m.importPercentage) || 0), 0);
        return total <= 100;
      }),

    mfgBoughtOutParts: Yup.array()
      .of(
        Yup.object().shape({
          partName: Yup.string()
            .trim()
            .required('Please enter the bought  part name')
            .test('unique-part-name', 'Part name must be unique', function (value) {
              if (!value) {
                return true;
              }
              const parts = this.from?.[1]?.value?.mfgBoughtOutParts || [];
              const currentIndex = parseInt(this.path?.match(/\[(\d+)\]/)?.[1] ?? '-1', 10);
              const duplicates = parts.filter((p, idx) => idx !== currentIndex && p.partName?.toLowerCase().trim() === value.toLowerCase().trim());
              return duplicates.length === 0;
            }),
          isImported: Yup.boolean().required('Please select the imported status'),
          importCountry: Yup.string().when('isImported', {
            is: true,
            then: schema => schema.required('Please select the import country'),
            otherwise: schema => schema.notRequired(),
          }),
          importPercentage: Yup.number()
            .transform((value, originalValue) => parseNumericOrNull(originalValue))
            .typeError('Must be a number')
            .when('isImported', {
              is: true,
              then: schema => schema.required('Please enter the import percentage').min(1, 'Percentage must be greater than 0').max(100, 'Percentage cannot exceed 100'),
              otherwise: schema => schema.notRequired(),
            }),
        }),
      )
      .notRequired()
      .test('import-percentage-total', 'Total import percentage across all bought-out parts cannot exceed 100%', function (parts) {
        if (!parts) {
          return true;
        }
        const total = parts.reduce((sum, p) => sum + (Number(p.importPercentage) || 0), 0);
        return total <= 100;
      }),
    // Add other fields as needed
  })
  .test('raw-or-bought-required', 'You must add at least one Key Raw Material or Bought-out Part.', function (value) {
    const raw = value?.mfgRawMaterials || [];
    const bought = value?.mfgBoughtOutParts || [];
    if ((Array.isArray(raw) && raw.length > 0) || (Array.isArray(bought) && bought.length > 0)) {
      return true;
    }
    return this.createError({ path: 'rawOrBought', message: 'You must add at least one Key Raw Material or Bought-out Part.' });
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
    title: 'Products',
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

// File fields are uploaded on step-save / explicit save only — never re-sent on per-field blur autosave.
const FILE_FIELDS = ['siteExteriorPhoto', 'gstCertificateFile', 'govtRegistrationCertificate', 'drdoCertificateFile', 'dpiitCertificateFile', 'udyamCertificateFile', 'incorporationCertificateFile'];

// A field qualifies for blur-autosave only if it is a top-level scalar (not a file,
// and not an array/table cell whose Formik name contains '.' or '[').
const isAutosavableFieldName = name => !!name && !name.includes('.') && !name.includes('[') && !FILE_FIELDS.includes(name);

// Dropdowns, date pickers, file inputs and the table rows never emit a blur that carries a field
// name, so nothing on them can trigger the blur autosave below. Their values are committed by
// watching for a change instead, debounced so a burst of edits costs one save.
const COMMIT_ON_CHANGE_DEBOUNCE_MS = 800;
const COMMIT_ON_CHANGE_FIELDS = [
  'vendorCategory',
  'registeredOfficeState',
  'unitState',
  'unitCommencementDate',
  'ownershipType',
  'mfgDrdoVendorStores',
  'thirdPartyCertifications',
  'mfgKeyProcesses',
  'mfgOutsourcedProcesses',
  'blacklistedOrganizations',
  'mfgProducts',
  'customers',
  'mfgRawMaterials',
  'mfgBoughtOutParts',
  ...FILE_FIELDS,
];

// JSON.stringify of a File is '{}', so a file is described by the fields that identify it.
const describeForChangeWatch = value => (typeof File !== 'undefined' && value instanceof File ? `${value.name}|${value.size}|${value.lastModified}` : value);

const ManufacturingSteps = ({ initialDraftValues, draftApplicationId }) => {
  const { user } = useSelector(state => state.Account);

  // ============================================================
  // HOOKS: useState
  // ============================================================
  const [activeStep, setActiveStep] = useState(0);
  const [combinedData, setCombinedData] = useState({});
  // default unit should be empty so dropdown shows "Select"
  const capacityUnit = '';

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isApplicationSubmissionOpen, setIsApplicationSubmissionOpen] = useState(true);
  const [showApplicationStoresModal, setShowApplicationStoresModal] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imagePreviewSrc, setImagePreviewSrc] = useState('');
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isSubmittingStep, setIsSubmittingStep] = useState(false);
  const handleViewProduct = data => {
    setSelectedProduct(data);
    setProductModalOpen(true);
  };
  const handleCloseProductModal = () => {
    setProductModalOpen(false);
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
  const { manufacturingStores, pinCodeLookups, countries, getKeyProcesses, thirdPartyCerts, drdoVendorCategories, getState: statesList } = useSelector(state => state.Master);
  const stateOptions = Array.isArray(statesList) ? statesList.map(state => ({ value: state.name || state, label: state.name || state })) : [];
  const REGISTERED_OFFICE_PINCODE_KEY = 'enterpriseRegisteredOffice';
  const UNIT_PINCODE_KEY = 'enterpriseUnit';
  const registeredOfficePinCodeLookup = pinCodeLookups?.[REGISTERED_OFFICE_PINCODE_KEY];
  const { drdoSetting } = useSelector(state => state.SystemSetting);
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

  // ============================================================
  // HOOKS: Router
  // ============================================================
  const navigate = useNavigate();

  // ============================================================
  // HOOKS: Redux
  // ============================================================
  const dispatch = useDispatch();
  const { createManufacturingApplicationLoading, createManufacturingApplication, submitManufacturingApplication, submitManufacturingApplicationLoading, submitManufacturingApplicationError } =
    useSelector(state => state.EnterpriseAdminApplication);
  const { rawMaterials, boughtOutParts } = useSelector(state => state.Master);
  const { organizations } = useSelector(state => state.Organization);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [_toastMessage, setToastMessage] = useState(null);
  // Server-side GST validation error (e.g. GSTIN↔PAN mismatch from the submit 422). Held separately
  // from Formik so per-step revalidation can't clear it when we jump back to the GST step.
  const [gstServerError, setGstServerError] = useState('');
  // Latest non-blocking GSTIN consistency result returned by the draft save (Option B).
  // A ref (not state) so handleNext can read it synchronously right after the save to
  // decide whether to gate advancement past the GST step.
  const gstWarningRef = useRef(null);
  const [showRawOrBoughtError, setShowRawOrBoughtError] = useState(false);
  // Clear any stale draft ID left in Redux from a previous save. Without this,
  // starting a new application would reuse the last draft's ID and overwrite it.
  useEffect(() => {
    if (!draftApplicationId) {
      dispatch(resetCreateManufacturingApplication());
    }
  }, [dispatch, draftApplicationId]);

  useEffect(() => {
    if (user?.organization?.id) {
      dispatch(getAllOrganizationsAction({ organizationId: user.organization.id }));
    }
  }, [dispatch, user?.organization?.id]);

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

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const data = { isActive: true, all: true };
      dispatch(getDrdoApprovalSettingByKeyAction('drdo_approval_required'));

      dispatch(getApplicationAction());
      dispatch(listVendorCategoriesAction(data));
      dispatch(listThirdPartyCertsAction(data));
      dispatch(listManufacturingStoresAction(data));
      dispatch(listVendorLabsAction(data));
      dispatch(listRawMaterialsAction(data));
      dispatch(listBoughtOutPartsAction(data));
      dispatch(listKeyResourcesAction(data));
      dispatch(listKeyProcessesAction(data));

      dispatch(listCountriesAction(data));
      dispatch(getStateAction(data));
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [dispatch]);
  // ============================================================
  // HOOKS: useMemo - Derived State
  // ============================================================
  const currentOrganization = organizations?.organization ?? null;

  // Get current application ID from draft response or props (for draft resume)
  const currentApplicationId = draftApplicationId || createManufacturingApplication?.data?.id || createManufacturingApplication?.id || null;

  // Get form values from navigation state or props (for draft resume)
  const initialFormValues = useMemo(() => initialDraftValues || {}, [initialDraftValues]);
  // Memoize initialValues to keep referential stability and avoid Formik re-initialization
  const memoizedInitialValues = useMemo(() => {
    return {
      // Use initialFormValues for these fields if present, else fallback to defaults
      applicationType: 'new',
      isExistingDrdoVendor:
        initialFormValues.isExistingDrdoVendor === true || initialFormValues.isExistingDrdoVendor === 'yes'
          ? 'yes'
          : initialFormValues.isExistingDrdoVendor === false || initialFormValues.isExistingDrdoVendor === 'no'
            ? 'no'
            : '',
      vendorCategory: initialFormValues.vendorCategory ?? '',
      mfgDrdoVendorStores: initialFormValues.mfgDrdoVendorStores?.length > 0 ? initialFormValues.mfgDrdoVendorStores.map(s => (typeof s === 'string' ? { storeName: s } : s)) : [],
      drdoRegistrationNumber: initialFormValues.drdoRegistrationNumber ?? '',
      drdoCertificateFile: initialFormValues.drdoCertificateFile ?? null,
      enterpriseClassification: initialFormValues.enterpriseClassification ?? '',
      dpiitRegistrationNumber: initialFormValues.dpiitRegistrationNumber ?? '',
      dpiitCertificateFile: initialFormValues.dpiitCertificateFile ?? null,
      udyamRegistrationNumber: initialFormValues.udyamRegistrationNumber ?? '',
      cin: initialFormValues.cin ?? '',
      udyamCertificateFile: initialFormValues.udyamCertificateFile ?? null,
      incorporationCertificateFile: initialFormValues.incorporationCertificateFile ?? null,

      // ...existing default fields (keep same structure as before) ...
      // Note: API returns camelCase on wire
      enterpriseName: initialFormValues.enterpriseName ?? currentOrganization?.name ?? '',
      registeredOfficeAddress: initialFormValues.registeredOfficeAddress ?? currentOrganization?.registeredAddress ?? '',
      registeredOfficeState: initialFormValues.registeredOfficeState ?? currentOrganization?.registeredState ?? '',
      registeredOfficeDistrict: initialFormValues.registeredOfficeDistrict ?? currentOrganization?.registeredDistrict ?? '',
      registeredOfficeDistrictCode: initialFormValues.registeredOfficeDistrictCode ?? '',
      registeredOfficePincode: initialFormValues.registeredOfficePincode ?? currentOrganization?.registeredPincode ?? '',
      registeredOfficeMobile: initialFormValues.registeredOfficeMobile ?? currentOrganization?.mobileNumber ?? '',
      registeredOfficeLandline: initialFormValues.registeredOfficeLandline ?? currentOrganization?.landlineNumber ?? '',
      registeredOfficeEmail: initialFormValues.registeredOfficeEmail ?? currentOrganization?.email ?? '',
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
      unitCommencementDate: initialFormValues.unitCommencementDate ?? '',
      siteExteriorPhoto: initialFormValues.siteExteriorPhoto ?? null,
      isSameAsRegistered: initialFormValues.isSameAsRegistered ?? false,
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
      thirdPartyCertifications: initialFormValues.thirdPartyCertifications ?? [],
      mfgKeyProcesses: initialFormValues.mfgKeyProcesses?.length > 0 ? initialFormValues.mfgKeyProcesses : [],
      mfgOutsourcedProcesses: initialFormValues.mfgOutsourcedProcesses?.length > 0 ? initialFormValues.mfgOutsourcedProcesses : [],
      isBlacklisted: initialFormValues.isBlacklisted ? 'yes' : initialFormValues.isBlacklisted === false ? 'no' : '',
      blacklistedOrganizations: initialFormValues.blacklistedOrganizations ?? [],
      hasOngoingEnquiry: initialFormValues.hasOngoingEnquiry ? 'yes' : initialFormValues.hasOngoingEnquiry === false ? 'no' : '',
      informationTrueAgreement: initialFormValues.informationTrueAgreement ?? false,
      applicationAcceptanceAgreement: initialFormValues.applicationAcceptanceAgreement ?? false,
      capacityUnit: initialFormValues.capacityUnit ?? '',

      mfgProducts:
        initialFormValues.mfgProducts?.length > 0
          ? initialFormValues.mfgProducts
          : [
              {
                productName: '',
                totalProductionCapacity: '',
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
      // mfgRawMaterials: array of { materialName: string, isImported: boolean, importCountry: string, importPercentage: string }
      mfgRawMaterials:
        initialFormValues.mfgRawMaterials?.length > 0
          ? initialFormValues.mfgRawMaterials.map(m => ({
              materialName: m.materialName ?? '',
              isImported: typeof m.isImported === 'boolean' ? m.isImported : null,
              importCountry: m.importCountry ?? '',
              importPercentage: m.importPercentage ?? '',
            }))
          : [],
      // mfgBoughtOutParts: array of { partName: string, isImported: boolean, importCountry: string, importPercentage: string }
      mfgBoughtOutParts:
        initialFormValues.mfgBoughtOutParts?.length > 0
          ? initialFormValues.mfgBoughtOutParts.map(p => ({
              partName: p.partName ?? '',
              isImported: typeof p.isImported === 'boolean' ? p.isImported : null,
              importCountry: p.importCountry ?? '',
              importPercentage: p.importPercentage ?? '',
            }))
          : [],
      // Add other fields as needed
    };
    // Only re-create when these inputs change
  }, [initialFormValues, currentOrganization]);

  // Helper to format display values across the review UI

  // ============================================================
  // HANDLERS: Modal Handlers
  // ============================================================

  const handleOpenSubmitModal = () => setShowSubmitModal(true);
  const handleCloseSubmitModal = () => setShowSubmitModal(false);

  // ============================================================
  // FUNCTIONS: Validation Schema & Helpers
  // ============================================================
  // Dynamically select schema for each step
  const getStepSchema = step => {
    switch (step) {
      case 0:
        return Yup.object().shape({
          // Fields from CreateNewApplication (pre-step) - not validated here, just passed through
          // Enterprise info fields
          enterpriseName: ApplicationSchema.fields.enterpriseName,
          registeredOfficeAddress: ApplicationSchema.fields.registeredOfficeAddress,
          registeredOfficeState: ApplicationSchema.fields.registeredOfficeState,
          registeredOfficeDistrict: ApplicationSchema.fields.registeredOfficeDistrict,
          registeredOfficePincode: ApplicationSchema.fields.registeredOfficePincode,
          registeredOfficeMobile: ApplicationSchema.fields.registeredOfficeMobile,
          registeredOfficeEmail: ApplicationSchema.fields.registeredOfficeEmail,
          unitAlternateEmail: ApplicationSchema.fields.unitAlternateEmail,

          unitAddress: ApplicationSchema.fields.unitAddress,
          unitName: ApplicationSchema.fields.unitName,
          unitState: ApplicationSchema.fields.unitState,
          unitDistrict: ApplicationSchema.fields.unitDistrict,
          unitPincode: ApplicationSchema.fields.unitPincode,
          unitMobile: ApplicationSchema.fields.unitMobile,
          unitEmail: ApplicationSchema.fields.unitEmail,
          unitLandline: ApplicationSchema.fields.unitLandline,
          unitCommencementDate: ApplicationSchema.fields.unitCommencementDate,
          vendorCategory: ApplicationSchema.fields.vendorCategory,
          mfgDrdoVendorStores: ApplicationSchema.fields.mfgDrdoVendorStores,
          isExistingDrdoVendor: ApplicationSchema.fields.isExistingDrdoVendor,
          drdoRegistrationNumber: ApplicationSchema.fields.drdoRegistrationNumber,
          drdoCertificateFile: ApplicationSchema.fields.drdoCertificateFile,
          enterpriseClassification: ApplicationSchema.fields.enterpriseClassification,
          dpiitRegistrationNumber: ApplicationSchema.fields.dpiitRegistrationNumber,
          dpiitCertificateFile: ApplicationSchema.fields.dpiitCertificateFile,
          cin: ApplicationSchema.fields.cin,
          udyamRegistrationNumber: ApplicationSchema.fields.udyamRegistrationNumber,
          udyamCertificateFile: ApplicationSchema.fields.udyamCertificateFile,
          incorporationCertificateFile: ApplicationSchema.fields.incorporationCertificateFile,
          // Contact Person fields
          siteExteriorPhoto: ApplicationSchema.fields.siteExteriorPhoto,
          contactPersonName: ApplicationSchema.fields.contactPersonName,
          contactPersonDesignation: ApplicationSchema.fields.contactPersonDesignation,
          contactPersonMobile: ApplicationSchema.fields.contactPersonMobile,
          contactPersonEmail: ApplicationSchema.fields.contactPersonEmail,
        });
      case 1:
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
        return Yup.object().shape({
          mfgProducts: ApplicationSchema.fields.mfgProducts,
          customers: ApplicationSchema.fields.customers,
          mfgKeyProcesses: ApplicationSchema.fields.mfgKeyProcesses,
          mfgOutsourcedProcesses: ApplicationSchema.fields.mfgOutsourcedProcesses,
          mfgRawMaterials: ApplicationSchema.fields.mfgRawMaterials,
          mfgBoughtOutParts: ApplicationSchema.fields.mfgBoughtOutParts,
        });
      case 3:
        return Yup.object().shape({
          thirdPartyCertifications: ApplicationSchema.fields.thirdPartyCertifications,
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
      dispatch(listRawMaterialsAction(data));
      dispatch(listBoughtOutPartsAction(data));
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
    // For step 2, set all fields as touched before validation so errors are visible
    if (activeStep === 2) {
      const touched = {
        mfgProducts: formik.values.mfgProducts.map(() => ({
          productName: true,
          totalProductionCapacity: true,
          capacityUnit: true,
          currentUtilizedCapacity: true,
          commencementDate: true,
          isExported: true,
          exportCountries: true,
          exportPercentage: true,
        })),
        customers: formik.values.customers.map(() => ({
          customerName: true,
          customerType: true,
          country: true,
        })),
        // processes are arrays of simple values (strings) so mark each entry touched as `true`
        mfgKeyProcesses: Array.isArray(formik.values.mfgKeyProcesses) ? formik.values.mfgKeyProcesses.map(() => true) : [],
        mfgOutsourcedProcesses: Array.isArray(formik.values.mfgOutsourcedProcesses) ? formik.values.mfgOutsourcedProcesses.map(() => true) : [],
        mfgRawMaterials: formik.values.mfgRawMaterials.map(() => ({
          materialName: true,
          isImported: true,
          importCountry: true,
          importPercentage: true,
        })),
        mfgBoughtOutParts: Array.isArray(formik.values.mfgBoughtOutParts)
          ? formik.values.mfgBoughtOutParts.map(() => ({
              partName: true,
              isImported: true,
              importCountry: true,
              importPercentage: true,
            }))
          : [],
      };
      formik.setTouched(touched, false);

      // Prevent advancing if any product has an empty name
      const originalProducts = Array.isArray(formik.values.mfgProducts) ? formik.values.mfgProducts : [];
      if (originalProducts.length > 0) {
        const _hasEmptyProductName = originalProducts.some(p => (p?.productName || '').toString().trim() === '');
      }
      // Prevent advancing if any customer has an empty name (UI may show error but filtering below removes blanks)
      const originalCustomers = Array.isArray(formik.values.customers) ? formik.values.customers : [];
      if (originalCustomers.length > 0) {
        const _hasEmptyName = originalCustomers.some(c => (c?.customerName || '').toString().trim() === '');
      }
    }

    // Prepare values for validation. For step 2, remove UI placeholder entries
    // (empty product/customer/raw material/part entries) so Yup's min()/required
    // checks run correctly against actual data rather than placeholder rows.
    const valuesToValidate = (() => {
      if (activeStep !== 2) {
        return formik.values;
      }

      const vals = { ...formik.values };

      // Some UI flows save selections into `combinedData` instead of directly
      // into Formik (for example when selecting from a modal). Use
      // `combinedData` as a fallback for validation when the formik arrays
      // are empty so we don't incorrectly report "no raw/bought provided".
      const ensureArrayFromCombined = key => {
        // For `mfgBoughtOutParts` and `mfgRawMaterials`, if the user has
        // cleared/closed the section (Formik array is empty) we should NOT
        // fallback to `combinedData` as that would rehydrate previously-
        // saved entries and force validation. Mirror bought-parts behavior
        // for raw materials so clearing them doesn't resurrect draft data.
        if (key === 'mfgBoughtOutParts' || key === 'mfgRawMaterials') {
          return; // skip combinedData fallback for these keys
        }
        if ((!Array.isArray(vals[key]) || vals[key].length === 0) && Array.isArray(combinedData[key]) && combinedData[key].length > 0) {
          vals[key] = combinedData[key];
        }
      };

      ensureArrayFromCombined('mfgProducts');
      ensureArrayFromCombined('customers');
      ensureArrayFromCombined('mfgKeyProcesses');
      ensureArrayFromCombined('mfgOutsourcedProcesses');
      ensureArrayFromCombined('mfgRawMaterials');
      ensureArrayFromCombined('mfgBoughtOutParts');

      // Filter out placeholder products (empty productName)
      if (Array.isArray(vals.mfgProducts)) {
        vals.mfgProducts = vals.mfgProducts.filter(p => (p?.productName || '').toString().trim() !== '');
      }

      // Filter out placeholder customers (empty customerName)
      if (Array.isArray(vals.customers)) {
        vals.customers = vals.customers.filter(c => (c?.customerName || '').toString().trim() !== '');
      }

      // Filter out empty key processes / outsourced processes (strings)
      if (Array.isArray(vals.mfgKeyProcesses)) {
        vals.mfgKeyProcesses = vals.mfgKeyProcesses.filter(p => (typeof p === 'string' ? p : p?.processName || '').toString().trim() !== '');
      }

      if (Array.isArray(vals.mfgOutsourcedProcesses)) {
        vals.mfgOutsourcedProcesses = vals.mfgOutsourcedProcesses.filter(p => (typeof p === 'string' ? p : p?.processName || '').toString().trim() !== '');
      }

      // Raw materials handling: if the user has any raw material rows
      // (even if empty), keep them as-is so Yup validation will require
      // `materialName`. Only when the array is absent/empty do we treat
      // it as not provided.
      if (Array.isArray(vals.mfgRawMaterials)) {
        if (Array.isArray(formik.values.mfgRawMaterials) && formik.values.mfgRawMaterials.length > 0) {
          // keep user-created rows (including empty ones) to allow Yup to
          // validate required fields like `materialName` and block Next.
        } else {
          // No user rows present; filter out any placeholders (defensive)
          vals.mfgRawMaterials = vals.mfgRawMaterials.filter(r => (r?.materialName || '').toString().trim() !== '');
        }
      }

      // If the user has any bought-out part rows (array length > 0), keep them
      // as-is so Yup validates required fields (e.g. `partName`). Only when the
      // array is absent or empty do we treat it as not provided.
      if (!Array.isArray(vals.mfgBoughtOutParts) || vals.mfgBoughtOutParts.length === 0) {
        vals.mfgBoughtOutParts = [];
      }

      return vals;
    })();

    // Additional validation: check for duplicate product names in step 2
    if (activeStep === 2) {
      // Ensure at least one raw material or bought part is present after filtering placeholders
      const hasRawMaterials = Array.isArray(valuesToValidate.mfgRawMaterials) && valuesToValidate.mfgRawMaterials.length > 0;
      const hasBoughtParts = Array.isArray(valuesToValidate.mfgBoughtOutParts) && valuesToValidate.mfgBoughtOutParts.length > 0;
      let _rawOrBoughtError = null;

      if (!hasRawMaterials && !hasBoughtParts) {
        _rawOrBoughtError = 'You must add at least one Key Raw Material or Bought-out Part.';
      }
      const productList = Array.isArray(valuesToValidate.mfgProducts) ? valuesToValidate.mfgProducts : [];
      const productNames = productList.map(product => (product?.productName || '').toString().trim());
      const productNamesLower = productNames.map(name => name.toLowerCase());
      const _productNameCounts = productNamesLower.reduce((acc, name) => {
        if (!name) {
          return acc;
        } // ignore empty names (they are filtered earlier)
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {});

      // Check duplicates for customers by customerName
      const customerList = Array.isArray(valuesToValidate.customers) ? valuesToValidate.customers : [];
      const customerNames = customerList.map(customer => (customer?.customerName || '').toString().trim());
      const customerNamesLower = customerNames.map(name => name.toLowerCase());
      const customerNameCounts = customerNamesLower.reduce((acc, name) => {
        if (!name) {
          return acc;
        }
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {});
      const duplicateCustomerNames = new Set(Object.keys(customerNameCounts).filter(key => customerNameCounts[key] > 1));
      let _customersErrors = null;

      if (duplicateCustomerNames.size > 0) {
        _customersErrors = customerList.map(customer => {
          const name = (customer?.customerName || '').toString().trim();

          if (name && duplicateCustomerNames.has(name.toLowerCase())) {
            return { customerName: 'Customer name must be unique' };
          }

          return {};
        });

        Logger.error('Duplicate customer names detected', customerNames);
      }

      // Check duplicates for raw materials by materialName
      const rawMaterialList = Array.isArray(valuesToValidate.mfgRawMaterials) ? valuesToValidate.mfgRawMaterials : [];
      const rawMaterialNames = rawMaterialList.map(material => (material?.materialName || '').toString().trim());
      const rawMaterialNamesLower = rawMaterialNames.map(name => name.toLowerCase());
      const rawMaterialNameCounts = rawMaterialNamesLower.reduce((acc, name) => {
        if (!name) {
          return acc;
        }
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {});
      const duplicateRawMaterialNames = new Set(Object.keys(rawMaterialNameCounts).filter(key => rawMaterialNameCounts[key] > 1));
      if (duplicateRawMaterialNames.size > 0) {
        const rawMaterialErrors = rawMaterialList.map(material => {
          const name = (material?.materialName || '').toString().trim();
          if (name && duplicateRawMaterialNames.has(name.toLowerCase())) {
            return { materialName: 'Material name must be unique' };
          }
          return {};
        });
        const rawMaterialTouched = rawMaterialList.map(() => ({ materialName: true }));
        const newErrors = { ...formik.errors, mfgRawMaterials: rawMaterialErrors };
        const newTouched = { ...formik.touched, mfgRawMaterials: rawMaterialTouched };
        formik.setErrors(newErrors);
        formik.setTouched(newTouched, false);
        Logger.error('Duplicate material names detected, preventing step advancement', rawMaterialNames);
        return;
      }

      // Check duplicates for bought out parts by partName
      const boughtOutPartList = Array.isArray(valuesToValidate.mfgBoughtOutParts) ? valuesToValidate.mfgBoughtOutParts : [];
      const boughtOutPartNames = boughtOutPartList.map(part => (part?.partName || '').toString().trim());
      const boughtOutPartNamesLower = boughtOutPartNames.map(name => name.toLowerCase());
      const boughtOutPartNameCounts = boughtOutPartNamesLower.reduce((acc, name) => {
        if (!name) {
          return acc;
        }
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {});
      const duplicateBoughtOutPartNames = new Set(Object.keys(boughtOutPartNameCounts).filter(key => boughtOutPartNameCounts[key] > 1));
      if (duplicateBoughtOutPartNames.size > 0) {
        const boughtOutPartErrors = boughtOutPartList.map(part => {
          const name = (part?.partName || '').toString().trim();
          if (name && duplicateBoughtOutPartNames.has(name.toLowerCase())) {
            return { partName: 'Part name must be unique' };
          }
          return {};
        });
        const boughtOutPartTouched = boughtOutPartList.map(() => ({ partName: true }));
        const newErrors = { ...formik.errors, mfgBoughtOutParts: boughtOutPartErrors };
        const newTouched = { ...formik.touched, mfgBoughtOutParts: boughtOutPartTouched };
        formik.setErrors(newErrors);
        formik.setTouched(newTouched, false);
        Logger.error('Duplicate bought-out part names detected, preventing step advancement', boughtOutPartNames);
        return;
      }
    }

    let errors = {};

    if (activeStep === 2) {
      errors = await formik.validateForm();
    } else {
      errors = await getStepSchema(activeStep)
        .validate(valuesToValidate, { abortEarly: false })
        .then(() => ({}))
        .catch(err => {
          const errorObj = {};

          if (err && Array.isArray(err.inner)) {
            err.inner.forEach(e => {
              errorObj[e.path] = e.message;
            });
          }

          return errorObj;
        });
    }
    if (Object.keys(errors)?.length === 0) {
      // Track whether step submission succeeded (like ManufacturingSteps)
      let stepSubmissionSuccess = true;

      if (activeStep === 0) {
        const step0Fields = [
          // Fields from CreateNewApplication (pre-step)
          'isExistingDrdoVendor',
          'vendorCategory',
          'dpiitRegistrationNumber',
          'dpiitCertificateFile',
          'udyamRegistrationNumber',
          'cin',
          'udyamCertificateFile',
          'incorporationCertificateFile',
          'mfgDrdoVendorStores',
          'drdoRegistrationNumber',
          'drdoCertificateFile',
          'enterpriseClassification',
          'registeredOfficeDistrictCode',
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
          'contactPersonName',
          'contactPersonDesignation',
          'contactPersonMobile',
          'contactPersonEmail',
        ];
        // Build step0Data from only the explicit fields for step 0
        // Do NOT spread `stepDataRef.current` here — it may contain fields from later steps
        const step0Data = {};
        step0Fields.forEach(key => {
          // Use formik value if set, otherwise fall back to initialFormValues
          step0Data[key] = formik.values[key] !== undefined && formik.values[key] !== '' ? formik.values[key] : initialFormValues[key];
        });
        // Preserve UI-only flags for rehydration (do not send to API)
        stepDataRef.current.isSameAsRegistered = formik.values.isSameAsRegistered;
        const step0SubmissionSuccess = await submitStepData(dispatch, initialFormValues, step0Data);
        if (!step0SubmissionSuccess) {
          stepSubmissionSuccess = false;
        }
        stepDataRef.current = { ...step0Data };
      }
      // For step 1, only send the specified fields
      if (activeStep === 1) {
        // Fields to send to API (actual data only)
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
        ];

        // Build step1Data uCINg step1Fields, merging previous data and uCINg initialFormValues as fallback
        const step1Data = { ...stepDataRef.current };
        // Build separate API/UI objects to preserve UI strings for rehydration
        const apiStep1Data = { ...step1Data };
        const uiStep1Data = { ...step1Data };

        step1ApiFields.forEach(key => {
          // hasGst / hasGovtRegistration ride the RadioGroups as 'yes'/'no' but the API takes
          // booleans. stepDataRef feeds every later step's payload too, so the UI copy must
          // hold the boolean as well — a leftover 'yes' string would 422 those steps.
          const value = key === 'hasGst' || key === 'hasGovtRegistration' ? formik.values[key] === 'yes' : formik.values[key];
          apiStep1Data[key] = value;
          uiStep1Data[key] = value;
        });

        const step1SubmissionSuccess = await submitStepData(dispatch, combinedData, apiStep1Data);
        if (!step1SubmissionSuccess) {
          stepSubmissionSuccess = false;
        } else if (gstWarningRef.current) {
          // Draft saved, but the GSTIN is inconsistent with the org PAN/registered state.
          // Keep the user on the GST step to resolve it before proceeding (submit is the
          // hard gate). The inline error is already pinned via gstServerError.
          stepSubmissionSuccess = false;
          formik.setFieldTouched('gstNumber', true, false);
        }
        // persist UI-shaped values so rehydration restores radio/string values correctly
        stepDataRef.current = { ...uiStep1Data };
      }
      // For step 2, only send the specified fields (from commented schema)
      if (activeStep === 2) {
        const step2Fields = ['mfgProducts', 'customers', 'mfgKeyProcesses', 'mfgOutsourcedProcesses', 'mfgRawMaterials', 'mfgBoughtOutParts'];
        Logger.info('Submitting Step 2 with fields:', step2Fields);
        // Build step2Data uCINg step2Fields, merging previous data and uCINg combinedData as fallback
        const step2Data = { ...stepDataRef.current };
        // Always merge combinedData and formik.values for step2Fields
        step2Fields.forEach(key => {
          step2Data[key] = combinedData[key];
        });
        step2Fields.forEach(key => {
          if (key === 'mfgKeyProcesses' || key === 'mfgOutsourcedProcesses') {
            step2Data[key] = (formik.values[key] || []).map(p => ({
              processName: typeof p === 'string' ? p : p.processName || '',
            }));
          } else if (key === 'mfgRawMaterials') {
            step2Data[key] = formik.values[key];
          } else {
            step2Data[key] = formik.values[key];
          }
        });
        const step2SubmissionSuccess = await submitStepData(dispatch, combinedData, step2Data);
        if (!step2SubmissionSuccess) {
          stepSubmissionSuccess = false;
        }
        stepDataRef.current = { ...step2Data };
      }
      // For step 3, only send the specified fields
      if (activeStep === 3) {
        const step3Fields = ['thirdPartyCertifications', 'isBlacklisted', 'blacklistedOrganizations', 'hasOngoingEnquiry', 'informationTrueAgreement', 'applicationAcceptanceAgreement'];
        // Build two versions:
        // - apiStep3Data: values transformed for backend (booleans for flags)
        // - uiStep3Data: preserve original formik values (strings like 'yes'/'no') for rehydration
        const apiStep3Data = { ...stepDataRef.current };
        const uiStep3Data = { ...stepDataRef.current };
        step3Fields.forEach(key => {
          if (key === 'isBlacklisted' || key === 'hasOngoingEnquiry') {
            // API expects boolean, UI wants 'yes'/'no' strings
            apiStep3Data[key] = formik.values[key] === 'yes';
            uiStep3Data[key] = formik.values[key];
          } else {
            apiStep3Data[key] = formik.values[key];
            uiStep3Data[key] = formik.values[key];
          }
        });
        const step3SubmissionSuccess = await submitStepData(dispatch, combinedData, apiStep3Data);
        if (!step3SubmissionSuccess) {
          stepSubmissionSuccess = false;
        }
        // persist UI-shaped values so rehydration restores radio/string values correctly
        stepDataRef.current = { ...uiStep3Data };
      }

      if (stepSubmissionSuccess) {
        setActiveStep(prev => prev + 1);
      }
    } else {
      // For step 2, use formik.validateForm to set errors in correct nested structure
      if (activeStep === 2) {
        const validationErrors = await formik.validateForm();
        formik.setErrors(validationErrors);
        // If our custom test added a rawOrBought error, show the inline message and mark touched
        if (validationErrors && validationErrors.rawOrBought) {
          setShowRawOrBoughtError(true);
          try {
            formik.setFieldTouched('rawOrBought', true);
          } catch (_e) {
            // ignore
          }
        }
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
      setGstServerError(res?.data?.valid ? '' : res?.data?.message || '');
    } catch {
      // Best-effort inline check; on network/validation failure stay silent (submit still gates).
    }
  };

  const submitStepData = async (dispatch, prevData, stepData, options = {}) => {
    const { isAutosave = false } = options;
    const combinedData = { ...prevData, ...stepData };

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
    if (combinedData.unitCommencementDate) {
      const parsed = dayjs(combinedData.unitCommencementDate);
      if (parsed.isValid()) {
        combinedData.unitCommencementDate = parsed.format('YYYY-MM-DD');
      }
    }

    // Skip during autosave: re-hydrating arrays from combinedData on every blur would churn the form.
    if (!isAutosave) {
      setCombinedData(combinedData);
    }

    // Normalize employee count fields to integers to satisfy server integer validation
    try {
      const toInt = value => {
        const numericValue = parseNumericOrNull(value);
        return numericValue === null ? null : Math.floor(Number(numericValue));
      };
      if (combinedData.maleEmployeesCount !== undefined) {
        combinedData.maleEmployeesCount = toInt(combinedData.maleEmployeesCount);
      }
      if (combinedData.femaleEmployeesCount !== undefined) {
        combinedData.femaleEmployeesCount = toInt(combinedData.femaleEmployeesCount);
      }
      if (combinedData.otherEmployeesCount !== undefined) {
        combinedData.otherEmployeesCount = toInt(combinedData.otherEmployeesCount);
      }
      if (combinedData.totalEmployees !== undefined) {
        combinedData.totalEmployees = toInt(combinedData.totalEmployees);
      }
    } catch (err) {
      Logger.error('Error normalizing employee counts', err);
    }

    // Remove empty placeholder entries that may exist from UI while editing
    try {
      if (Array.isArray(combinedData.mfgProducts)) {
        combinedData.mfgProducts = combinedData.mfgProducts.filter(p => (p?.productName || '').toString().trim() !== '');
        if (combinedData.mfgProducts.length === 0) {
          delete combinedData.mfgProducts;
        }
      }
      if (Array.isArray(combinedData.customers)) {
        combinedData.customers = combinedData.customers.filter(c => (c?.customerName || '').toString().trim() !== '');
        if (combinedData.customers.length === 0) {
          delete combinedData.customers;
        }
      }
      if (Array.isArray(combinedData.mfgKeyProcesses)) {
        combinedData.mfgKeyProcesses = combinedData.mfgKeyProcesses.filter(p => (typeof p === 'string' ? p : p?.processName || '').toString().trim() !== '');
        if (combinedData.mfgKeyProcesses.length === 0) {
          delete combinedData.mfgKeyProcesses;
        }
      }
      if (Array.isArray(combinedData.mfgOutsourcedProcesses)) {
        combinedData.mfgOutsourcedProcesses = combinedData.mfgOutsourcedProcesses.filter(p => (typeof p === 'string' ? p : p?.processName || '').toString().trim() !== '');
        if (combinedData.mfgOutsourcedProcesses.length === 0) {
          delete combinedData.mfgOutsourcedProcesses;
        }
      }
    } catch (err) {
      Logger.error('Error filtering combinedData arrays', err);
    }

    // Transform mfgRawMaterials into separate mfgRawMaterials and mfgBoughtOutParts arrays for backend
    let transformedData = { ...combinedData };

    // Include applicationId to ensure we update the existing draft instead of creating a new one
    // This is critical to prevent duplicate drafts when editing. The ref holds the freshest id
    // (updated synchronously after each save) so back-to-back autosaves can't duplicate the draft.
    const effectiveApplicationId = applicationIdRef.current || currentApplicationId;
    if (effectiveApplicationId) {
      transformedData.applicationId = effectiveApplicationId;
    }

    // Normalize mfgRawMaterials (ensure materialName is a string) and mfgBoughtOutParts (ensure partName is a string)
    if (Array.isArray(transformedData.mfgRawMaterials)) {
      const normalizedRaw = transformedData.mfgRawMaterials
        .map(r => ({
          materialName: Array.isArray(r.materialName) ? String(r.materialName[0] || '').trim() : String(r.materialName || '').trim(),
          isImported: !!r.isImported,
          importCountry: r.importCountry || '',
          importPercentage: r.importPercentage || '',
        }))
        .filter(r => r.materialName);

      if (normalizedRaw.length > 0) {
        transformedData.mfgRawMaterials = normalizedRaw;
      } else if (Object.hasOwn(transformedData, 'mfgRawMaterials')) {
        delete transformedData.mfgRawMaterials;
      }
    }

    if (Array.isArray(transformedData.mfgBoughtOutParts)) {
      const normalizedBought = transformedData.mfgBoughtOutParts
        .map(p => ({
          partName: Array.isArray(p.partName) ? String(p.partName[0] || '').trim() : String(p.partName || '').trim(),
          isImported: !!p.isImported,
          importCountry: p.importCountry || '',
          importPercentage: p.importPercentage || '',
        }))
        .filter(p => p.partName);

      if (normalizedBought.length > 0) {
        const seen = new Set();
        transformedData.mfgBoughtOutParts = normalizedBought.filter(p => {
          const key = `${p.partName}||${p.importCountry}||${p.importPercentage}`;
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        });
      } else if (Object.hasOwn(transformedData, 'mfgBoughtOutParts')) {
        delete transformedData.mfgBoughtOutParts;
      }
    }

    // Remove UI-only fields that should not be sent to backend
    if (Object.hasOwn(transformedData, 'isSameAsRegistered')) {
      delete transformedData.isSameAsRegistered;
    }

    // Normalize blacklistedOrganizations to a plain comma-separated string
    try {
      if (Object.hasOwn(transformedData, 'blacklistedOrganizations')) {
        let bo = transformedData.blacklistedOrganizations;
        Logger.debug?.('blacklistedOrganizations before normalization (manufacturing):', { value: bo, type: typeof bo });

        const normalizeList = raw => {
          if (raw == null) {
            return '';
          }
          // If already array, normalize each item
          if (Array.isArray(raw)) {
            return raw
              .map(item => {
                if (typeof item === 'string') {
                  const s = item.trim();
                  try {
                    // Handle values that are JSON-encoded strings like '"8"'
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

          if (typeof raw === 'string') {
            const s = raw.trim();
            // If string looks like a JSON array, try to parse it
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
                // fallthrough to comma-split
              }
            }
            // Otherwise, assume comma-separated already
            return s
              .split(',')
              .map(x => x.trim().replace(/^"|"$/g, ''))
              .filter(Boolean)
              .join(',');
          }

          // Fallback
          return String(raw).trim();
        };

        const cleaned = normalizeList(bo);
        transformedData.blacklistedOrganizations = cleaned;
        Logger.debug?.('blacklistedOrganizations after normalization (manufacturing):', { value: cleaned, type: typeof cleaned });
      }
    } catch (err) {
      Logger.error?.('Error normalizing blacklistedOrganizations (manufacturing):', err);
    }

    // Files appended by this save. Recorded as stored only once the save succeeds, so a failed
    // save never stops the next one from re-sending the file.
    const filesSentThisSave = {};
    const formData = new FormData();
    Object.entries(transformedData).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        // Special-case: send mfgKeyProcesses and mfgOutsourcedProcesses as a JSON string only
        if ((key === 'mfgKeyProcesses' || key === 'mfgOutsourcedProcesses') && Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
          return; // skip generic handling below for this key
        }

        // hasGst / hasGovtRegistration are tri-state: send a real boolean once answered (the blur
        // autosave posts the raw 'yes'/'no' RadioGroup value, which the API rejects) and omit the
        // field entirely while unanswered, so the stored null stays null.
        if (key === 'hasGst' || key === 'hasGovtRegistration') {
          if (value === true || value === false || value === 'yes' || value === 'no') {
            formData.append(key, value === true || value === 'yes');
          }
          return;
        }

        // Convert UI 'yes'/'no' strings to booleans for API for specific keys
        if ((key === 'isBlacklisted' || key === 'hasOngoingEnquiry' || key === 'isExistingDrdoVendor') && (value === 'yes' || value === 'no' || value === true || value === false)) {
          // Accept both boolean and 'yes'/'no' UI values
          const boolVal = value === true ? true : value === false ? false : value === 'yes';
          formData.append(key, boolVal);
          return;
        }

        // Ensure blacklistedOrganizations is always appended as a plain string
        if (key === 'blacklistedOrganizations') {
          try {
            const v = typeof value === 'string' ? value : JSON.stringify(value);
            formData.append(key, String(v));
            Logger.debug?.('FormData append (manufacturing) - blacklistedOrganizations:', String(v));
          } catch (_err) {
            formData.append(key, String(value));
            Logger.debug?.('FormData append (manufacturing) - blacklistedOrganizations (fallback):', String(value));
          }
          return;
        }

        // File fields - only append if value is an actual File object.
        // URL strings (from existing uploads) are skipped so the stored path survives. A newly
        // picked file rides the next save, autosave included, but only once: autosavedFilesRef
        // holds the files already stored so later saves don't re-upload the same bytes.
        if (FILE_FIELDS.includes(key)) {
          if (value instanceof File && (!isAutosave || autosavedFilesRef.current[key] !== value)) {
            formData.append(key, value);
            filesSentThisSave[key] = value;
          }
          return;
        }

        if (value instanceof File) {
          if (!isAutosave) {
            formData.append(key, value);
          }
        } else if (Array.isArray(value) || typeof value === 'object') {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, value);
        }
      }
    });

    // Log readable payload (avoid binary contents)
    try {
      const logPayload = { ...transformedData };
      Object.keys(logPayload).forEach(k => {
        if (logPayload[k] instanceof File) {
          logPayload[k] = { fileName: logPayload[k].name, size: logPayload[k].size, type: logPayload[k].type };
        }
      });
      Logger.debug?.('Submitting FormData (serialized)', logPayload);
    } catch (err) {
      Logger.error?.('Error serializing submission payload', err);
    }

    const dispatchPromise = dispatch((isAutosave ? autosaveManufacturingApplicationAction : createManufacturingApplicationAction)(formData));
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

    // Capture the created/updated draft id synchronously so a trailing autosave
    // or the next step-save updates the same draft instead of creating a duplicate.
    const savedId = result?.payload?.data?.id ?? result?.payload?.id ?? null;
    if (savedId) {
      applicationIdRef.current = savedId;
    }

    // When the action is fulfilled, result.payload is present and result.error undefined
    if (result && !result?.error) {
      Object.assign(autosavedFilesRef.current, filesSentThisSave);
      // Non-blocking GSTIN consistency result (Option B): the draft always persists;
      // we surface the message on the GST field and let handleNext gate advancement.
      const gstWarning = result?.payload?.gstWarning ?? result?.payload?.data?.gstWarning ?? null;
      gstWarningRef.current = gstWarning;
      setGstServerError(gstWarning?.message ?? '');
      return combinedData;
    }

    // Autosave fails quietly — the "Saving…/Saved" indicator reflects status; no toast.
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

  // Helper for field error
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

  // ============================================================
  // HOOKS: useFormik
  // ============================================================
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
    // Guarded: an autosave that created the draft holds the only id in the ref, and Redux may
    // still report none — an unguarded assignment would clear it and the next save would duplicate.
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

  // Commit-on-change: the fields above never reach handleAutosaveBlur, so any change to one of
  // them schedules a save of its own.
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

  // Hydrate Formik arrays from `combinedData` when combinedData arrives
  // (some flows update `combinedData` asynchronously; ensure form shows values)
  useEffect(() => {
    if (!combinedData || !formik) {
      return;
    }
    try {
      const arrayFields = ['mfgProducts', 'customers', 'mfgKeyProcesses', 'mfgOutsourcedProcesses', 'mfgRawMaterials', 'mfgBoughtOutParts'];
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

  // Clear the visible raw/bought error when user adds any non-empty raw material or bought part
  useEffect(() => {
    try {
      const raws = Array.isArray(formik?.values?.mfgRawMaterials) ? formik.values.mfgRawMaterials : [];
      const bought = Array.isArray(formik?.values?.mfgBoughtOutParts) ? formik.values.mfgBoughtOutParts : [];
      const hasRaw = raws.some(r => (r?.materialName || '').toString().trim() !== '');
      const hasBought = bought.some(b => (b?.partName || '').toString().trim() !== '');
      if (hasRaw || hasBought) {
        if (showRawOrBoughtError) {
          setShowRawOrBoughtError(false);
        }
        // also clear any touched flag for this pseudo-field
        if (formik && formik.setFieldTouched) {
          formik.setFieldTouched('rawOrBought', false);
        }
      }
    } catch (_e) {
      // ignore
    }
  }, [formik?.values?.mfgRawMaterials, formik?.values?.mfgBoughtOutParts]);

  // Set district code from registered-office pincode lookup when available (safe: formik is initialized).
  // Tracks the current pincode so editing it refreshes the code instead of keeping a stale value.
  useEffect(() => {
    const match = Array.isArray(registeredOfficePinCodeLookup) ? registeredOfficePinCodeLookup[0] : null;
    if (match?.districtCode && formik.values.registeredOfficePincode === match.pincode && formik.values.registeredOfficeDistrictCode !== match.districtCode) {
      formik.setFieldValue('registeredOfficeDistrictCode', match.districtCode);
    }
  }, [registeredOfficePinCodeLookup, formik.values.registeredOfficePincode]);

  // ============================================================
  // HANDLERS: Form Field Handlers (depend on formik)
  // ============================================================
  const handleCopyFromRegisteredOffice = () => {
    try {
      formik.setFieldValue('unitAddress', formik.values.registeredOfficeAddress || '');
      formik.setFieldValue('unitState', formik.values.registeredOfficeState || '');
      formik.setFieldValue('unitDistrict', formik.values.registeredOfficeDistrict || '');
      formik.setFieldValue('unitPincode', formik.values.registeredOfficePincode || '');
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
  // Application Stores modal handlers

  const _handleOpenApplicationStoresModal = () => {
    setShowApplicationStoresModal(true);
  };

  const handleCloseApplicationStoresModal = () => {
    setShowApplicationStoresModal(false);
  };

  const handleOpenImagePreview = imageUrl => {
    setImagePreviewSrc(imageUrl);
    setImagePreviewOpen(true);
  };
  const handleEnterpriseClassificationChange = e => {
    const { value } = e.target;
    formik.setFieldValue('enterpriseClassification', value);

    // Clear all classification-related fields first
    formik.setFieldValue('dpiitRegistrationNumber', '');
    formik.setFieldValue('dpiitCertificateFile', null);
    formik.setFieldValue('udyamRegistrationNumber', '');
    formik.setFieldValue('cin', '');
    formik.setFieldValue('udyamCertificateFile', null);
    formik.setFieldValue('incorporationCertificateFile', null);

    // Set touched state to false to clear validation errors
    formik.setFieldTouched('dpiitRegistrationNumber', false);
    formik.setFieldTouched('dpiitCertificateFile', false);
    formik.setFieldTouched('udyamRegistrationNumber', false);
    formik.setFieldTouched('cin', false);
    formik.setFieldTouched('udyamCertificateFile', false);
    formik.setFieldTouched('incorporationCertificateFile', false);
  };
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
          'vendorCategory',
          'dpiitRegistrationNumber',
          'dpiitCertificateFile',
          'udyamRegistrationNumber',
          'cin',
          'udyamCertificateFile',
          'incorporationCertificateFile',
          'mfgDrdoVendorStores',
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
        return ['mfgProducts', 'customers', 'mfgKeyProcesses', 'mfgOutsourcedProcesses', 'mfgRawMaterials'];
      case 3:
        return ['thirdPartyCertifications', 'isBlacklisted', 'blacklistedOrganizations', 'hasOngoingEnquiry', 'informationTrueAgreement', 'applicationAcceptanceAgreement'];
      default:
        return [];
    }
  };

  // ============================================================
  // HOOKS: useEffect
  // ============================================================
  // Load master lists required by the review page

  // Handle successful application submission
  useEffect(() => {
    if (submitManufacturingApplication) {
      Logger.info('Application submitted successfully:', submitManufacturingApplication);
      handleCloseSubmitModal();
      setShowSuccessModal(true);
      dispatch(resetSubmitManufacturingApplication());
      dispatch(getApplicationAction({ status: null, type: null, q: null, perPage: 10, page: 1 }));
    }
  }, [submitManufacturingApplication, dispatch]);

  // Surface final-submit failures (the dispatch in the Submit button doesn't await the thunk,
  // so without this watcher the user would see no feedback on failure).
  useEffect(() => {
    if (submitManufacturingApplicationError) {
      const gstMsg = submitManufacturingApplicationError?.errors?.gstNumber?.[0];
      setShowSubmitModal(false);
      // GSTIN consistency failure (backend 422): the GSTIN is the only input to this check
      // that is editable in this wizard (org PAN + registered state live in the Organisation
      // profile, not here), so always pin on the GST field and land on the GST step. The
      // pan_required / pan_mismatch messages themselves point the user to the Organisation profile.
      if (gstMsg) {
        // Shown inline under the GST field — no toast (it would duplicate the field error).
        setGstServerError(gstMsg);
        formik.setFieldTouched('gstNumber', true, false);
        setActiveStep(1);
      } else {
        toastError(submitManufacturingApplicationError.message || 'An error occurred while submitting the application.', { duration: 9000 });
      }
    }
  }, [submitManufacturingApplicationError]);

  // Handle success modal continue button
  const handleSuccessModalContinue = () => {
    setShowSuccessModal(false);
    navigate('/applications');
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
            // hasGst / hasGovtRegistration are stored as booleans for the API payload, but their
            // RadioGroups expect 'yes'/'no' strings — convert back so the selection is shown
            // when navigating back to this step.
            if ((key === 'hasGst' || key === 'hasGovtRegistration') && typeof restoredVal === 'boolean') {
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

  // Auto sum totalEmployees when any employee count changes
  useEffect(() => {
    const male = Number(formik.values.maleEmployeesCount) || 0;
    const female = Number(formik.values.femaleEmployeesCount) || 0;
    const other = Number(formik.values.otherEmployeesCount) || 0;
    const total = male + female + other;
    // Only update totalEmployees if at least one employee count field has a value
    const _hasAnyEmployeeCount = formik.values.maleEmployeesCount || formik.values.femaleEmployeesCount || formik.values.otherEmployeesCount;
    // if (hasAnyEmployeeCount && formik.values.totalEmployees !== String(total)) {
    formik.setFieldValue('totalEmployees', String(total));
    // }
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
        dispatch(pinCodeAction({ pincode: formik.values.registeredOfficePincode, key: REGISTERED_OFFICE_PINCODE_KEY }));
      }
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [dispatch, formik.values.registeredOfficePincode]);

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
                  <p className="step-header-subtitle">Provide basic information about your enterprise and the unit applying for certification</p>
                </div>
              </div>
            </div>

            {/* Registered Office Address Section */}
            <div className="form-section bottom-seperator">
              <h5 className="section-title">Enterprise Details</h5>
              <div className="row  gap-vertical-30">
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
                    inputMode="numeric"
                    maxLength={15}
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
                  />
                </div>
              </div>
            </div>
            {/* Unit/Plant Address Section */}
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
                      label="Unit or Plant Address"
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
                <div className="row gap-vertical-30 margintop-30">
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
                      onChange={e => {
                        formik.handleChange(e);
                      }}
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
                      onChange={e => {
                        formik.handleChange(e);
                      }}
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
            </div>
            {/* Unit/Plant Address Section */}
            <div className="form-section bottom-seperator">
              <h5 className="section-title">Unit classification</h5>

              <div className="row gap-vertical-30">
                <div>
                  <div className="row">
                    <div className="col-12 col-md-6">
                      <AppDropdown
                        name="vendorCategory"
                        label="Category"
                        isRequired={true}
                        options={drdoVendorCategories?.data?.map(category => ({ value: category.categoryName, label: category.categoryName }))}
                        value={formik.values.vendorCategory}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={formik.touched.vendorCategory && formik.errors.vendorCategory ? formik.errors.vendorCategory : ''}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <AppMultiSelectDropdown
                        subLabel="Select the stores under which your products are supplied."
                        label="Stores"
                        chipMode={true}
                        options={manufacturingStores?.data?.map(store => ({ value: store.storeName, label: store.storeName })) || []}
                        value={Array.isArray(formik.values.mfgDrdoVendorStores) ? formik.values.mfgDrdoVendorStores.map(s => (typeof s === 'string' ? s : s.storeName || '')) : []}
                        onChange={value => {
                          const newValues = (Array.isArray(value) ? value : []).map(val => ({ storeName: val }));
                          formik.setFieldValue('mfgDrdoVendorStores', newValues);
                        }}
                        placeholder="Select Store(s)"
                        name="mfgDrdoVendorStores"
                        isRequired={true}
                        error={formik.touched.mfgDrdoVendorStores && formik.errors.mfgDrdoVendorStores ? formik.errors.mfgDrdoVendorStores : ''}
                      />
                    </div>
                  </div>
                </div>
                <div>
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
                              label="DRDO/DRDO Lab Certificate"
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
                <div>
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
                                value={formik.values.dpiitRegistrationNumber}
                                onChange={e => {
                                  formik.setFieldValue('dpiitRegistrationNumber', e.target.value.toUpperCase());
                                }}
                                maxLength={20}
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
                      {formik.values.enterpriseClassification === 'micro' && (
                        <div style={{ marginTop: '20px', width: '100%' }}>
                          <div className="row">
                            <div className="col-12 col-md-6">
                              <AppInput
                                name="udyamRegistrationNumber"
                                placeholder="UDYAM-XX-00-0123456"
                                label="UDYAM Registration Number"
                                isRequired={true}
                                value={formik.values.udyamRegistrationNumber}
                                onChange={e => {
                                  formik.setFieldValue('udyamRegistrationNumber', e.target.value.toUpperCase());
                                }}
                                onBlur={formik.handleBlur}
                                maxLength={19}
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
                      {formik.values.enterpriseClassification === 'small' && (
                        <div style={{ marginTop: '20px', width: '100%' }}>
                          <div className="row">
                            <div className="col-12 col-md-6">
                              <AppInput
                                name="udyamRegistrationNumber"
                                placeholder="UDYAM-XX-00-0123456"
                                label="UDYAM Registration Number"
                                isRequired={true}
                                maxLength={19}
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
                      {formik.values.enterpriseClassification === 'medium' && (
                        <div style={{ marginTop: '20px', width: '100%' }}>
                          <div className="row">
                            <div className="col-12 col-md-6">
                              <AppInput
                                name="udyamRegistrationNumber"
                                placeholder="UDYAM-XX-00-0123456"
                                label="UDYAM Registration Number"
                                isRequired={true}
                                maxLength={19}
                                onBlur={formik.handleBlur}
                                value={formik.values.udyamRegistrationNumber}
                                onChange={e => {
                                  formik.setFieldValue('udyamRegistrationNumber', e.target.value.toUpperCase());
                                }}
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
                    maxLength={50}
                    value={formik.values.contactPersonName || ''}
                    onChange={e => {
                      const raw = e && e.target ? e.target.value : '';
                      // Allow letters, spaces, apostrophe, hyphen and dot
                      const cleaned = raw.replace(/[^A-Za-z\s'\-.]/g, '').slice(0, 100);
                      formik.setFieldValue('contactPersonName', cleaned);
                    }}
                    isRequired={true}
                    error={formik.errors.contactPersonName && formik.touched.contactPersonName ? formik.errors.contactPersonName : ''}
                  />
                </div>
                <div className="col-md-6">
                  <AppInput
                    name="contactPersonDesignation"
                    label="Designation"
                    placeholder="Enter Designation"
                    maxLength={50}
                    value={formik.values.contactPersonDesignation}
                    onChange={e => {
                      const raw = e && e.target ? e.target.value : '';
                      // Allow letters, spaces, apostrophe, hyphen and dot
                      const cleaned = raw.replace(/[^A-Za-z\s'\-.]/g, '').slice(0, 100);
                      formik.setFieldValue('contactPersonDesignation', cleaned);
                    }}
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
                    onChange={formik.handleChange}
                    inputType="email"
                    isRequired={true}
                    error={formik.errors.contactPersonEmail && formik.touched.contactPersonEmail ? formik.errors.contactPersonEmail : ''}
                  />
                </div>
                <div className="col-md-12">
                  <div className="contact-person-note-container d-block">
                    <img src={Icons.infoCircle} alt="info" className="icon-16 margin-right-6" />
                    <span className="contact-person-note">Kindly note the following:</span>
                    <ul className="margin-top-6 mb-0">
                      <li>A separate login will be created for the contact person as you move to the new step</li>
                      <li>Login credentials will be sent to their email</li>
                      <li>They can login to edit and update this draft application</li>
                      <li>The contact person can only access this specific application</li>
                    </ul>
                  </div>
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
                    label="Number of  Male Employees"
                    maxLength={5}
                    placeholder="Enter Number of Male Employees"
                    // keep raw value while editing to avoid formatting-on-change issues
                    value={formik.values.maleEmployeesCount ?? ''}
                    formatOnBlur={true}
                    numericCase={true}
                    onChange={formik.handleChange}
                    isRequired={true}
                    error={formik.errors.maleEmployeesCount && formik.touched.maleEmployeesCount ? formik.errors.maleEmployeesCount : ''}
                  />
                </div>
                <div className="col-md-3">
                  <AppInput
                    name="femaleEmployeesCount"
                    maxLength={5}
                    label="Number of Female Employees"
                    placeholder="Enter Number of Female Employees"
                    value={formik.values.femaleEmployeesCount ?? ''}
                    formatOnBlur={true}
                    onChange={formik.handleChange}
                    numericCase={true}
                    isRequired={true}
                    error={formik.errors.femaleEmployeesCount && formik.touched.femaleEmployeesCount ? formik.errors.femaleEmployeesCount : ''}
                  />
                </div>
                <div className="col-md-3">
                  <AppInput
                    name="otherEmployeesCount"
                    label="Number of Other Employees"
                    maxLength={5}
                    placeholder="Enter Number of Other Employees"
                    value={formik.values.otherEmployeesCount ?? ''}
                    formatOnBlur={true}
                    onChange={formik.handleChange}
                    numericCase={true}
                    isRequired={true}
                    error={formik.errors.otherEmployeesCount && formik.touched.otherEmployeesCount ? formik.errors.otherEmployeesCount : ''}
                  />
                </div>
                <div className="col-md-3">
                  <div className="total-employee">
                    <span className="mb-0 fs-18 fw-600 info-active-color">
                      {formik.values.totalEmployees && parseNumericOrNull(formik.values.totalEmployees) > 0 ? formatNumber(parseNumericOrNull(formik.values.totalEmployees)) : '-'}
                    </span>
                    <p className="mb-0 fs-14 fw-500 text-1-color">Total Number of Employees</p>
                  </div>
                  {formik.errors.totalEmployees && formik.touched.totalEmployees && <p className="error-text margin-top-4 mb-0">{formik.errors.totalEmployees}</p>}
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
                        onChange={e => {
                          formik.setFieldValue('gstNumber', e.target.value);
                          if (gstServerError) {
                            setGstServerError('');
                          }
                        }}
                        onBlur={handleGstBlur}
                        isRequired
                        error={formik.touched.gstNumber && formik.errors.gstNumber ? formik.errors.gstNumber : gstServerError || ''}
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
                      Is the unit registered with any other government organisation?<span className="asterics">*</span>
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
                        label="Upload Enterprise Certificate"
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
                  <h2 className="step-header-title">Product Details</h2>
                  <p className="step-header-subtitle">Products, Customers, Processes, Raw Materials</p>
                </div>
              </div>
              <h5 className="section-title margin-top-30">Product Information</h5>
              <FieldArray name="mfgProducts">
                {({ push, remove }) => (
                  <>
                    {formik?.values?.mfgProducts?.map((product, index) => (
                      <div key={product.id} className={`box-border margin-bottom-20`}>
                        <div className="rowBetween margin-bottom-16">
                          <h5 className="section-title-product">Product {index + 1}</h5>
                          {formik?.values?.mfgProducts?.length > 1 && (
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
                              placeholder="Enter Name of Product"
                              label="Name of Product"
                              isRequired
                              value={product.productName}
                              onChange={formik.handleChange}
                              onBlur={formik.handleBlur}
                              maxLength={150}
                              name={`mfgProducts[${index}].productName`}
                              error={getFieldError(`mfgProducts.${index}.productName`)}
                            />
                          </div>
                          <div className="col-md-6">
                            <AppInputWithDropdown
                              label="Total Production Capacity Per Year"
                              value={formatNumberInput(product.totalProductionCapacity)}
                              onChange={e => formik.setFieldValue(`mfgProducts[${index}].totalProductionCapacity`, e.target.value)}
                              onBlur={() => formik.setFieldTouched(`mfgProducts.${index}.totalProductionCapacity`, true)}
                              name={`mfgProducts[${index}].totalProductionCapacity`}
                              placeholder="Enter Capacity"
                              subLabel="As on Date of Application for Assessment"
                              unit={product.capacityUnit || capacityUnit}
                              onUnitChange={e => formik.setFieldValue(`mfgProducts[${index}].capacityUnit`, e.target.value)}
                              unitOptions={[
                                { label: 'Select', value: '' },
                                { label: 'Kg', value: 'kg' },
                                { label: 'Liter', value: 'liter' },
                                { label: 'Meter', value: 'meter' },
                                { label: 'Number', value: 'number' },
                                { label: 'Ton', value: 'ton' },
                              ]}
                              isRequired
                              numericFormat={true}
                              error={getFieldError(`mfgProducts.${index}.totalProductionCapacity`)}
                            />
                            {getFieldError(`mfgProducts.${index}.capacityUnit`) && (
                              <div className="error-text" style={{ marginTop: 6 }}>
                                {getFieldError(`mfgProducts.${index}.capacityUnit`)}
                              </div>
                            )}
                          </div>
                          <div className="col-md-6">
                            <AppInputWithDropdown
                              label="Current Utilized Capacity Per Year"
                              value={formatNumberInput(product.currentUtilizedCapacity)}
                              onChange={e => formik.setFieldValue(`mfgProducts[${index}].currentUtilizedCapacity`, e.target.value)}
                              onBlur={() => formik.setFieldTouched(`mfgProducts.${index}.currentUtilizedCapacity`, true)}
                              name={`mfgProducts[${index}].currentUtilizedCapacity`}
                              placeholder="Enter Capacity"
                              subLabel="As on Date of Application for Assessment"
                              unit={product.capacityUnit || capacityUnit}
                              onUnitChange={e => formik.setFieldValue(`mfgProducts[${index}].capacityUnit`, e.target.value)}
                              unitOptions={[
                                { label: 'Select', value: '' },
                                { label: 'Kg', value: 'kg' },
                                { label: 'Liter', value: 'liter' },
                                { label: 'Meter', value: 'meter' },
                                { label: 'Number', value: 'number' },
                                { label: 'Ton', value: 'ton' },
                              ]}
                              isRequired
                              numericFormat={true}
                              maxValue={parseNumericOrNull(product.totalProductionCapacity)}
                              error={getFieldError(`mfgProducts.${index}.currentUtilizedCapacity`)}
                            />
                          </div>
                          <div className="col-md-6">
                            <AppDatePicker
                              label="Date of Commencement"
                              value={product.commencementDate}
                              onChange={value => formik.setFieldValue(`mfgProducts[${index}].commencementDate`, value)}
                              placeholder="Select date"
                              isRequired={true}
                              subLabel="Commencement date of product"
                              error={getFieldError(`mfgProducts.${index}.commencementDate`)}
                              minDate={formik.values.unitCommencementDate ? dayjs(formik.values.unitCommencementDate) : undefined}
                              maxDate={dayjs()}
                            />
                          </div>
                          <div className="col-md-12">
                            <FormControl component="fieldset" sx={{ marginBottom: 2, width: '100%' }}>
                              <div className="d-flex">
                                <span className="label">Is the Product Being Exported?</span>
                                <span className="asterics">*</span>
                              </div>
                              <RadioGroup
                                value={product.isExported === true ? 'yes' : product.isExported === false ? 'no' : ''}
                                onChange={e => {
                                  formik.setFieldValue(`mfgProducts[${index}].isExported`, e.target.value === 'yes');
                                  // Clear export-related fields when "No" is selected
                                  if (e.target.value === 'no') {
                                    formik.setFieldValue(`mfgProducts[${index}].exportCountries`, []);
                                    formik.setFieldValue(`mfgProducts[${index}].exportPercentage`, '');
                                    formik.setFieldTouched(`mfgProducts.${index}.exportCountries`, false);
                                    formik.setFieldTouched(`mfgProducts.${index}.exportPercentage`, false);
                                  }
                                }}
                                name={`mfgProducts[${index}].isExported`}
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
                              {formik.touched.mfgProducts?.[index]?.isExported && formik.errors.mfgProducts?.[index]?.isExported && (
                                <div className="error-text">{formik.errors.mfgProducts[index].isExported}</div>
                              )}
                              {product.isExported && (
                                <div style={{ marginTop: '20px' }}>
                                  <div className="row">
                                    <div className="col-12 col-md-6">
                                      <AppMultiSelectDropdown
                                        label="Export Country"
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
                                        chipMode={true}
                                        value={Array.isArray(product.exportCountries) ? product.exportCountries : []}
                                        onChange={newValue => formik.setFieldValue(`mfgProducts[${index}].exportCountries`, Array.isArray(newValue) ? newValue : [])}
                                        placeholder="Select Export Country"
                                        name={`mfgProducts[${index}].exportCountries`}
                                        isRequired={true}
                                        error={getFieldError(`mfgProducts.${index}.exportCountries`)}
                                      />
                                    </div>
                                    <div className="col-12 col-md-6">
                                      <AppInput
                                        placeholder="Enter Percentage(%)"
                                        label="Percentage(%) of Export of the Product"
                                        value={product.exportPercentage}
                                        onChange={e => formik.setFieldValue(`mfgProducts[${index}].exportPercentage`, e.target.value)}
                                        onBlur={formik.handleBlur}
                                        name={`mfgProducts[${index}].exportPercentage`}
                                        isRequired
                                        percentageFormat={true}
                                        error={getFieldError(`mfgProducts.${index}.exportPercentage`)}
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
                          productName: '',
                          totalProductionCapacity: '',
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
            <div className="bottom-seperator margin-bottom-30"></div>
            <h5 className="section-title">Customer Details</h5>

            <FieldArray name="customers">
              {({ push, remove }) => (
                <>
                  {formik?.values?.customers?.map((customer, index) => (
                    <div key={customer.id || index} className={`box-border margin-bottom-20`}>
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
                        <div className="col-xl-4 col-lg-6 cus-radio-gap">
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
                                // Clear country field when switching customer type
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
              <h5 className="section-title">Key Manufacturing Processes</h5>
              <div className="contact-person-note-container">
                <img src={Icons.infoCircle} alt="info" className="icon-16 margin-right-6" />
                <span className="contact-person-note">
                  Enter the main manufacturing processes involved in delivering your product. Start typing to see suggestions or enter the Process name. Mark a process as outsourced if it is carried
                  out outside your unit.
                </span>
              </div>
              <div className="col-md-12 margin-top-20">
                <AppSuggestionInput
                  label="Key Processes"
                  suggestions={getKeyProcesses?.data?.map(process => ({ label: process.processName, value: process.processName })) || []}
                  value={Array.isArray(formik.values.mfgKeyProcesses) ? formik.values.mfgKeyProcesses.map(p => (typeof p === 'string' ? p : p.processName || '')) : []}
                  onChange={newValue => {
                    const selected = Array.isArray(newValue) ? newValue : [];
                    const newValues = selected.map(val => ({ processName: val }));
                    // Update key processes
                    formik.setFieldValue('mfgKeyProcesses', newValues);
                    // If any outsourced processes exist, ensure they are subset of selected key processes
                    const existingOutsourced = Array.isArray(formik.values.mfgOutsourcedProcesses) ? formik.values.mfgOutsourcedProcesses : [];
                    const filteredOutsourced = existingOutsourced
                      .map(op => (typeof op === 'string' ? op : op.processName || ''))
                      .filter(Boolean)
                      .filter(name => selected.includes(name));
                    // If none of the previously selected outsourced processes remain, clear the field
                    formik.setFieldValue('mfgOutsourcedProcesses', filteredOutsourced);
                  }}
                  name="mfgKeyProcesses"
                  maxSuggestions={10}
                  Outsourced={true}
                  outsourcedValues={Array.isArray(formik.values.mfgOutsourcedProcesses) ? formik.values.mfgOutsourcedProcesses.map(p => (typeof p === 'string' ? p : p.processName || '')) : []}
                  onToggleOutsourced={(idx, outsourced) => {
                    // Determine the name of the item at this index in the visible tags list
                    const currentTags = Array.isArray(formik.values.mfgKeyProcesses) ? formik.values.mfgKeyProcesses.map(p => (typeof p === 'string' ? p : p.processName || '')) : [];
                    const processName = currentTags[idx];
                    if (!processName) {
                      return;
                    }
                    // Update mfgOutsourcedProcesses to mark this process as outsourced or not
                    const currentOutsourced = Array.isArray(formik.values.mfgOutsourcedProcesses) ? formik.values.mfgOutsourcedProcesses : [];
                    const existsIdx = currentOutsourced.findIndex(op => (typeof op === 'string' ? op : op.processName) === processName);
                    if (outsourced) {
                      // add if not exists
                      if (existsIdx === -1) {
                        formik.setFieldValue('mfgOutsourcedProcesses', [...currentOutsourced, { processName }], true);
                      }
                    } else {
                      // remove if exists
                      if (existsIdx !== -1) {
                        const next = [...currentOutsourced];
                        next.splice(existsIdx, 1);
                        formik.setFieldValue('mfgOutsourcedProcesses', next, true);
                      }
                    }
                  }}
                  max={100}
                  isRequired={true}
                  error={formik.touched.mfgKeyProcesses && getFieldError('mfgKeyProcesses')}
                />
              </div>
            </div>
            <div className="bottom-seperator"></div>
            <div className="row margintop-30">
              <div className="col-12">
                <div className="contact-person-note-container">
                  <img src={Icons.infoCircle} alt="info" className="icon-16 margin-right-6" />
                  <span className="contact-person-note">You must add at least one Key Raw Material or Bought-out Part.</span>
                </div>

                {(showRawOrBoughtError || (formik.touched.rawOrBought && formik.errors.rawOrBought)) && (
                  <div className="error-text" style={{ marginTop: 6 }}>
                    {formik.errors.rawOrBought || 'Please add at least one Key Raw Material or Bought-out Part.'}
                  </div>
                )}
                <h5 className="section-title  margintop-30">Key Raw Material</h5>
              </div>
            </div>

            <FieldArray name="mfgRawMaterials">
              {({ push, remove }) =>
                formik?.values?.mfgRawMaterials?.length === 0 ? (
                  <AppButton
                    variant="primary"
                    onClick={() =>
                      push({
                        materialName: '',
                        isImported: null,
                        importCountry: '',
                        importPercentage: '',
                      })
                    }
                    title={'Add Key Raw Material'}
                    leftIcon={Icons.addMore}
                    leftIconStyle={'icon-16'}
                    customClass={'ms-auto'}
                  />
                ) : (
                  <>
                    {formik?.values?.mfgRawMaterials?.map((rawMaterial, index) => (
                      <div key={index} className={`box-border margin-bottom-20`}>
                        <div className="row">
                          <div className="rowBetween ">
                            <h5 className="section-title-product">Key Raw Material {formik?.values?.mfgRawMaterials?.length > 1 ? index + 1 : ''}</h5>
                            {/* <div className="rowCenter" onClick={() => remove(index)} style={{ cursor: 'pointer' }}>
                              <img src={Icons.trash} alt="Remove Icon" className="icon-12" />
                              <span className="remove-text">Remove</span>
                            </div> */}
                            <AppButton size="small" variant="danger-secondary" title={'Remove'} onClick={() => remove(index)} rightIcon={Icons.trash} rightIconStyle={'icon-12'} />
                          </div>
                          <div className="col-md-6">
                            <AppSuggestionInput
                              placeholder="Enter Name of Key Raw Material"
                              label="Key Raw Material"
                              optionWidth="100%"
                              max={100}
                              maxSuggestionLength={1}
                              suggestions={rawMaterials?.data?.map(m => ({ label: m.materialName, value: m.materialName })) || []}
                              value={rawMaterial.materialName || ''}
                              onChange={newValue => {
                                // AppSuggestionInput may return an array of tags or a CINgle string; coerce to string
                                const val = Array.isArray(newValue) ? newValue[0] || '' : newValue || '';
                                formik.setFieldValue(`mfgRawMaterials[${index}].materialName`, val);
                              }}
                              onBlur={formik.handleBlur}
                              name={`mfgRawMaterials[${index}].materialName`}
                              isRequired
                              error={getFieldError(`mfgRawMaterials.${index}.materialName`)}
                            />
                          </div>
                        </div>
                        <div className="row margintop-30">
                          <div className="col-md-4">
                            <FormControl component="fieldset" sx={{ marginBottom: 2, width: '100%' }}>
                              <div className="d-flex">
                                <span className="label">Is this Raw Material being Imported?</span>
                                <span className="asterics">*</span>
                              </div>
                              <RadioGroup
                                value={rawMaterial.isImported === true ? 'yes' : rawMaterial.isImported === false ? 'no' : ''}
                                onChange={e => {
                                  formik.setFieldValue(`mfgRawMaterials[${index}].isImported`, e.target.value === 'yes');
                                  if (e.target.value === 'no') {
                                    formik.setFieldValue(`mfgRawMaterials[${index}].importCountry`, '');
                                    formik.setFieldValue(`mfgRawMaterials[${index}].importPercentage`, '');
                                    formik.setFieldTouched(`mfgRawMaterials.${index}.importCountry`, false);
                                    formik.setFieldTouched(`mfgRawMaterials.${index}.importPercentage`, false);
                                  }
                                }}
                                name={`mfgRawMaterials[${index}].isImported`}
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
                              {getFieldError(`mfgRawMaterials.${index}.isImported`) && <div className="error-text">{getFieldError(`mfgRawMaterials.${index}.isImported`)}</div>}
                            </FormControl>
                          </div>
                          {rawMaterial.isImported === true && (
                            <>
                              <div className="col-md-5">
                                <AppDropdown
                                  label="Import Country"
                                  name={`mfgRawMaterials[${index}].importCountry`}
                                  value={rawMaterial.importCountry}
                                  onChange={e => formik.setFieldValue(`mfgRawMaterials[${index}].importCountry`, e.target.value)}
                                  onBlur={formik.handleBlur}
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
                                  placeholder="Select Import Country"
                                  isRequired={true}
                                  error={getFieldError(`mfgRawMaterials.${index}.importCountry`)}
                                />
                              </div>
                              <div className="col-md-3">
                                <AppInput
                                  placeholder="Enter Percentage(%)"
                                  label="Percentage(%) of Import"
                                  percentageFormat={true}
                                  value={rawMaterial.importPercentage}
                                  onChange={e => formik.setFieldValue(`mfgRawMaterials[${index}].importPercentage`, e.target.value)}
                                  onBlur={formik.handleBlur}
                                  name={`mfgRawMaterials[${index}].importPercentage`}
                                  isRequired
                                  error={getFieldError(`mfgRawMaterials.${index}.importPercentage`)}
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
                          materialName: '',
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
              <h5 className="section-title">
                Bought-out Part {(showRawOrBoughtError || (formik.touched && formik.touched.rawOrBought && formik.errors && formik.errors.rawOrBought)) && <span className="asterics">*</span>}
              </h5>
              <FieldArray name="mfgBoughtOutParts">
                {({ push, remove }) =>
                  formik?.values?.mfgBoughtOutParts?.length === 0 ? (
                    <AppButton
                      variant="primary"
                      onClick={() =>
                        push({
                          partName: '',
                          isImported: null,
                          importCountry: '',
                          importPercentage: '',
                        })
                      }
                      title={'Add Key Bought-out Part'}
                      leftIcon={Icons.addMore}
                      leftIconStyle={'icon-16'}
                      customClass={'ms-auto'}
                    />
                  ) : (
                    <>
                      {formik?.values?.mfgBoughtOutParts?.map((boughtOutPart, index) => (
                        <div key={index} className={`box-border margin-bottom-20`}>
                          <div className="row">
                            <div className="rowBetween">
                              <h5 className="section-title-product">Bought-out Part {formik?.values?.mfgBoughtOutParts?.length > 1 ? index + 1 : ''}</h5>
                              {/* <div className="rowCenter" onClick={() => remove(index)} style={{ cursor: 'pointer' }}>
                                <img src={Icons.trash} alt="Remove Icon" className="icon-12" />
                                <span className="remove-text">Remove</span>
                              </div> */}
                              <AppButton size="small" variant="danger-secondary" title={'Remove'} onClick={() => remove(index)} rightIcon={Icons.trash} rightIconStyle={'icon-12'} />

                              {/* )} */}
                            </div>
                            <div className="col-md-6">
                              <AppSuggestionInput
                                placeholder="Enter Name of Bought-out part"
                                label="Bought-out part"
                                optionWidth="100%"
                                maxSuggestionLength={1}
                                suggestions={boughtOutParts?.data?.map(m => ({ label: m.partName, value: m.partName })) || []}
                                value={boughtOutPart.partName || ''}
                                onChange={newValue => {
                                  const val = Array.isArray(newValue) ? newValue[0] || '' : newValue || '';
                                  formik.setFieldValue(`mfgBoughtOutParts[${index}].partName`, val);
                                }}
                                onBlur={formik.handleBlur}
                                name={`mfgBoughtOutParts[${index}].partName`}
                                isRequired
                                max={100}
                                error={getFieldError(`mfgBoughtOutParts.${index}.partName`)}
                              />
                            </div>
                          </div>
                          <div className="row margintop-30">
                            <div className="col-md-4">
                              <FormControl component="fieldset" sx={{ marginBottom: 2, width: '100%' }}>
                                <div className="d-flex">
                                  <span className="label">
                                    Is this Bought-Out Part being Imported? <span className="asterics">*</span>
                                  </span>
                                </div>
                                <RadioGroup
                                  value={boughtOutPart.isImported === true ? 'yes' : boughtOutPart.isImported === false ? 'no' : ''}
                                  onChange={e => {
                                    formik.setFieldValue(`mfgBoughtOutParts[${index}].isImported`, e.target.value === 'yes');
                                    // Clear import-related fields when "No" is selected
                                    if (e.target.value === 'no') {
                                      formik.setFieldValue(`mfgBoughtOutParts[${index}].importCountry`, '');
                                      formik.setFieldValue(`mfgBoughtOutParts[${index}].importPercentage`, '');
                                      formik.setFieldTouched(`mfgBoughtOutParts.${index}.importCountry`, false);
                                      formik.setFieldTouched(`mfgBoughtOutParts.${index}.importPercentage`, false);
                                    }
                                  }}
                                  name={`mfgBoughtOutParts[${index}].isImported`}
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
                                {getFieldError(`mfgBoughtOutParts.${index}.isImported`) && <div className="error-text">{getFieldError(`mfgBoughtOutParts.${index}.isImported`)}</div>}
                              </FormControl>
                            </div>
                            {boughtOutPart.isImported === true && (
                              <>
                                <div className="col-md-5">
                                  <AppDropdown
                                    label="Import Country"
                                    name={`mfgBoughtOutParts[${index}].importCountry`}
                                    value={boughtOutPart.importCountry}
                                    onChange={e => formik.setFieldValue(`mfgBoughtOutParts[${index}].importCountry`, e.target.value)}
                                    onBlur={formik.handleBlur}
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
                                    placeholder="Select Import Country"
                                    isRequired={true}
                                    error={getFieldError(`mfgBoughtOutParts.${index}.importCountry`)}
                                  />
                                </div>
                                <div className="col-md-3">
                                  <AppInput
                                    placeholder="Enter Percentage(%)"
                                    label="Percentage(%) of Import"
                                    percentageFormat={true}
                                    value={boughtOutPart.importPercentage}
                                    onChange={e => formik.setFieldValue(`mfgBoughtOutParts[${index}].importPercentage`, e.target.value)}
                                    onBlur={formik.handleBlur}
                                    name={`mfgBoughtOutParts[${index}].importPercentage`}
                                    isRequired
                                    error={getFieldError(`mfgBoughtOutParts.${index}.importPercentage`)}
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
                            partName: '',
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
                    placeholder="Select or type & press enter"
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
                        Has the unit ever been blacklisted or banned by any government organisation? <span className="asterics">*</span>
                      </span>
                    </div>
                    <RadioGroup
                      value={formik.values.isBlacklisted}
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
                      value={formik.values.blacklistedOrganizations}
                      onChange={newValue => formik.setFieldValue('blacklistedOrganizations', Array.isArray(newValue) ? newValue : [])}
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
                        {formik.values.informationTrueAgreement ? (
                          <img src={Icons.squareTick} alt="checkbox" className="icon-22" onClick={handleInformationTrueAgreementChange} style={{ cursor: 'pointer' }} />
                        ) : (
                          <img src={Icons.squareUncheck} alt="checkbox" className="icon-22" onClick={handleInformationTrueAgreementChange} style={{ cursor: 'pointer' }} />
                        )}
                        <label className="form-check-label mb-0">
                          <DeclarationAccuracyText />
                        </label>
                      </div>
                      {formik.touched.informationTrueAgreement && formik.errors.informationTrueAgreement && <div className="error-text">{formik.errors.informationTrueAgreement}</div>}
                    </div>

                    {/* Second Declaration Checkbox */}
                    <div className="form-check margin-top-16">
                      <div className="custom-checkbox d-flex align-items-start">
                        {formik.values.applicationAcceptanceAgreement ? (
                          <img src={Icons.squareTick} alt="checkbox" className="icon-22" onClick={handleApplicationAcceptanceAgreementChange} style={{ cursor: 'pointer' }} />
                        ) : (
                          <img src={Icons.squareUncheck} alt="checkbox" className="icon-22" onClick={handleApplicationAcceptanceAgreementChange} style={{ cursor: 'pointer' }} />
                        )}
                        <label className="form-check-label mb-0">
                          <DeclarationDiscretionText />
                        </label>
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
      case steps.length - 1:
        // Snapshot step (image-only preview)
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
                            <li className="fs-14 fw-500 text-2-color text-capitalize">Manufacturing</li>
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
                                <AppButton
                                  size="small"
                                  variant="link"
                                  title={'View'}
                                  onClick={() => downloadFile({ downloadUrl: formik.values.dpiitCertificateFile || formik.values.dpiitCertificateFileUrl })}
                                />
                              )}
                            </div>
                          </div>
                        )}
                        {formik.values.enterpriseClassification === 'large' && (
                          <div>
                            <p className="fs-12 fw-500 mb-1 text-3-color">Incorporation Number </p>
                            <div className="d-flex align-items-end">
                              <p className="fs-14 fw-500 mb-0 heading-color">{formatDisplayValue(formik.values.cin)}</p>

                              {(formik.values.incorporationCertificateFile || formik.values.incorporationCertificateFileUrl) && (
                                <AppButton
                                  size="small"
                                  variant="link"
                                  title={'View'}
                                  onClick={() => downloadFile({ downloadUrl: formik.values.incorporationCertificateFile || formik.values.incorporationCertificateFileUrl })}
                                />
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
                                <AppButton
                                  size="small"
                                  variant="link"
                                  title={'View'}
                                  onClick={() => downloadFile({ downloadUrl: formik.values.udyamCertificateFile || formik.values.udyamCertificateFileUrl })}
                                />
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
                      <Accordion.Header>Unit / Plant Location & Contact Details</Accordion.Header>
                      <Accordion.Body className="p-0">
                        <div className="details-card">
                          <div className="enterpriseInfoMainWrapper">
                            <div className="row">
                              <div className="col-sm-6">
                                <div className="enterpriseInfoWrapper">
                                  <h5 className="dark-text">Unit / Plant Address</h5>
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
                                      <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formatDisplayValue(formik.values.unitEmail)}</p>
                                    </li>
                                    <li>
                                      <img src={Icons.email} alt="documnet" className="icon-20 margin-right-8" />
                                      <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Alternate Email:</p>
                                      <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formatDisplayValue(formik.values.unitAlternateEmail ? formik.values.unitAlternateEmail : '-')}</p>
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
                                      <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formik.values.registeredOfficeLandline ? formik.values.registeredOfficeLandline : '-'}</p>
                                    </li>
                                    <li>
                                      <img src={Icons.email} alt="documnet" className="icon-20 margin-right-8" />
                                      <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Email:</p>
                                      <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{formatDisplayValue(formik.values.registeredOfficeEmail)}</p>
                                    </li>
                                    <li>
                                      <img src={Icons.email} alt="documnet" className="icon-20 margin-right-8" />
                                      <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Alternate Email:</p>
                                      <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">
                                        {formatDisplayValue(formik.values.registeredOfficeAlternateEmail ? formik.values.registeredOfficeAlternateEmail : '-')}
                                      </p>
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

                              <span className="fs-14 fw-500 heading-color margin-left-8">{formik.values.vendorCategory}</span>
                            </div>
                            <div className="cus-bx-1 ">
                              <span className="fs-12 fw-400 text-2-color">Stores:</span>
                              {(formik.values.mfgDrdoVendorStores || formik.values.mfgKeyProcesses || [])?.map((item, idx) => (
                                <span key={idx} className="margin-left-8 cusTags">
                                  {typeof item === 'object' ? item.storeName || item.processName || item.name : item}
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
                                        {ownershipTypeOptions.find(option => option.value === formik.values.ownershipType)?.label}
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

                                      {formik.values.hasGovtRegistration === 'yes' && (formik.values.govtRegistrationCertificate || formik.values.govtRegistrationCertificateUrl) && (
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
                                      {(formik.values.mfgProducts || [])
                                        .filter(p => (p?.productName || '').toString().trim() !== '')
                                        .map((product, index) => (
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
                                      {(formik.values.customers || [])
                                        .filter(c => (c?.customerName || '').toString().trim() !== '')
                                        .map((customer, index) => (
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
                    <Accordion.Item eventKey="3" className="details-card p-0 border-1-light-grey">
                      <Accordion.Header>Key Manufacturing Processes</Accordion.Header>
                      <Accordion.Body className="p-0">
                        <div className="details-card pt-0">
                          <div className="enterpriseInfoMainWrapper">
                            <div className="row align-items-center">
                              <div className="col-md-12 align-items-cente">
                                <div className="cus-bx-1 ">
                                  <span className="fs-12 fw-400 text-2-color">Key Manufacturing Processes:</span>
                                  {(formik.values.mfgKeyProcesses || []).map((name, i) => (
                                    <span key={`kp-${i}`} className="margin-left-8 cusTags">
                                      {formatDisplayValue(name.processName)}
                                    </span>
                                  ))}
                                </div>
                                <div className="cus-bx-1">
                                  {formik.values.mfgOutsourcedProcesses && formik.values.mfgOutsourcedProcesses.length > 0 && <span className="fs-12 fw-400 text-2-color">Outsourced Processes:</span>}
                                  {formik.values.mfgOutsourcedProcesses.map((name, i) => (
                                    <span key={`op-${i}`} className="margin-left-8 cusTags">
                                      {formatDisplayValue(name.processName)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Accordion.Body>
                    </Accordion.Item>
                    <Accordion.Item eventKey="4" className="details-card p-0 border-1-light-grey">
                      <Accordion.Header>Key Raw Material / Bought-out Part</Accordion.Header>
                      <Accordion.Body className="p-0">
                        <div className="details-card pt-0 pb-0">
                          <div className="enterpriseInfoMainWrapper">
                            <table className="table product-details-table firstChildInherit">
                              <thead>
                                <tr>
                                  <th>
                                    Key Raw Material /<br /> Bought-out Part
                                  </th>
                                  <th>Name</th>
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
                                {(formik.values.mfgRawMaterials || []).map((rawMaterial, idx) => (
                                  <tr key={`rm-${idx}`}>
                                    <td>Key Raw Material</td>
                                    <td>{rawMaterial.materialName}</td>
                                    <td>{rawMaterial.isImported ? 'Yes' : 'No'}</td>
                                    <td>{rawMaterial.importCountry || '-'}</td>
                                    <td>{rawMaterial.importPercentage ? `${rawMaterial.importPercentage}%` : '-'}</td>
                                  </tr>
                                ))}
                                {(formik.values.mfgBoughtOutParts || []).map((boughtOutPart, idx) => (
                                  <tr key={`bop-${idx}`}>
                                    <td>Bought Out Part</td>
                                    <td>{boughtOutPart.partName || ''}</td>
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

                                <div className="cus-bx-1 ">
                                  <img src={Icons.tickSuccess} alt="key-process" className="icon-16 margin-right-8" />
                                  <span className="fs-12 fw-400 text-2-color">Whether blacklisted/banned ever by any competent authority?</span>
                                  {formik.values?.isBlacklisted === 'yes' ? (
                                    (Array.isArray(formik.values?.blacklistedOrganizations) ? formik.values.blacklistedOrganizations : String(formik.values?.blacklistedOrganizations || '').split(','))
                                      .map(org => String(org || '').trim())
                                      .filter(Boolean)
                                      .map((name, idx) => (
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
                        {autosaveStatus === 'saving' ? 'Saving…' : autosaveStatus === 'saved' ? 'All changes saved' : 'Couldn’t save — changes will retry on next edit'}
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
                            disabled={!isApplicationSubmissionOpen}
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
                          disabled={isSubmittingStep || createManufacturingApplicationLoading || !formik.values.applicationAcceptanceAgreement || !formik.values.informationTrueAgreement}
                          loading={isSubmittingStep || createManufacturingApplicationLoading}
                        />
                      ) : (
                        // Other steps - save and next
                        <AppButton
                          variant="primary"
                          onClick={handleNext}
                          customClass={'ms-auto'}
                          title={'Save & Next'}
                          rightIcon={Icons.arrowRight}
                          rightIconStyle={'icon-16'}
                          disabled={isSubmittingStep || createManufacturingApplicationLoading}
                          loading={isSubmittingStep || createManufacturingApplicationLoading}
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
      <ApplicationStoresModal open={showApplicationStoresModal} onClose={handleCloseApplicationStoresModal} stores={formik?.values?.mfgDrdoVendorStores} type={'Stores'} />
      <ImagePreviewModal show={imagePreviewOpen} onClose={() => setImagePreviewOpen(false)} src={imagePreviewSrc} alt="Site Exterior" />
      <ProductDetailModal open={productModalOpen} onClose={handleCloseProductModal} product={selectedProduct} />
      <CustomerDetailModal open={customerModalOpen} onClose={handleCloseCustomerModal} customer={selectedCustomer} />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--warning-light)' }}
        image={Icons.warningIcon}
        show={showSubmitModal}
        handleClose={handleCloseSubmitModal}
        header={'Submit Application for Assessment? '}
        subHeader={
          drdoSetting?.value !== '0'
            ? 'Your application will be sent to DRDO for review.You will receive email updates on the application status and next steps.'
            : 'Your application will be sent for review. You will receive email updates on the application status and next steps.'
        }
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonOnClick={handleCloseSubmitModal}
        leftButtonDisabled={submitManufacturingApplicationLoading}
        rightButton="Submit"
        rightButtonClassName={'w-100 btn-primary'}
        rightButtonLoading={submitManufacturingApplicationLoading}
        rightButtonDisabled={submitManufacturingApplicationLoading}
        rightButtonOnClick={() => {
          if (currentApplicationId) {
            dispatch(submitManufacturingApplicationAction(currentApplicationId));
          }
        }}
      />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        show={showSuccessModal}
        image={Icons.successCircle}
        header={'Application Submitted Successfully!'}
        subHeader={'Your application has been received. You will be notified of the next steps via email.'}
        singleButton={true}
        buttonClassName={'w-100 primary medium'}
        buttonOnClick={handleSuccessModalContinue}
        singleButtonLabel={'Continue'}
      />
    </Layout>
  );
};

export default ManufacturingSteps;
