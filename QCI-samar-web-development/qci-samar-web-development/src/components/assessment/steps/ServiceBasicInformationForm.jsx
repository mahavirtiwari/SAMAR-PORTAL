import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import dayjs from 'dayjs';
import { FieldArray, FormikProvider, getIn, useFormik } from 'formik';
import { useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import Icons from '../../../constants/Icons';
import { getBasicInformationAction, getStepProgressAction, saveBasicInformationAction } from '../../../redux/action/common/ApplicationAssessmentAction';
import {
  listCountriesAction,
  listKeyProcessV1Action,
  listKeyResourcesAction,
  listOutsourcedComponentsAction,
  listThirdPartyCertsAction,
  listVendorCategoriesV1Action,
  listVendorLabsAction,
} from '../../../redux/action/master/MasterAction';
import { formatNumberInput, parseNumericOrNull } from '../../../utils/formatters';
import { AppButton, AppDatePicker, AppDropdown, AppInput, AppInputWithDropdown, AppMultiSelectDropdown, AppSuggestionInput } from '../../base';
import { toastError, toastSuccess } from '../../base/toast';

const EMPTY_SERVICE = {
  serviceName: '',
  totalServicesCapacity: '',
  capacityUnit: 'Number',
  currentUtilizedCapacity: '',
  commencementDate: '',
  isExported: null,
  exportCountries: [],
  exportPercentage: '',
};
const EMPTY_CUSTOMER = { customerName: '', customerType: '', country: '' };
const EMPTY_RESOURCE = { resourceName: '', isImported: null, importCountry: '', importPercentage: '' };
const EMPTY_COMPONENT = { componentName: '', isImported: null, importCountry: '', importPercentage: '' };

const radioControl = <Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />;

const uniqueTest = field =>
  (function(value) {
    if (!value) {
      return true;
    }
    const list = this.from?.[1]?.value?.[field] || [];
    const currentIndex = parseInt(this.path?.match(/\[(\d+)\]/)?.[1] ?? '-1', 10);
    const duplicates = list.filter(
      (item, idx) =>
        idx !== currentIndex &&
        String(item?.[this.path.split('.').pop()] || item)
          ?.toLowerCase?.()
          .trim() === value.toLowerCase().trim(),
    );
    return duplicates.length === 0;
  });

const validationSchema = Yup.object().shape({
  svcProviderType: Yup.string().required('Please select the type of service provider'),
  category: Yup.string().required('Please select a category'),
  svcDrdoVendorLabs: Yup.array()
    .of(Yup.object().shape({ labName: Yup.string().required('Please enter the service') }))
    .min(1, 'Please select at least one service'),
  svcServices: Yup.array()
    .of(
      Yup.object().shape({
        serviceName: Yup.string().required('Please enter the service name').test('unique-service-name', 'Service name must be unique', uniqueTest('svcServices')),
        totalServicesCapacity: Yup.number()
          .transform((v, o) => parseNumericOrNull(o))
          .typeError('Must be a number')
          .required('Please enter the total service capacity'),
        currentUtilizedCapacity: Yup.number()
          .transform((v, o) => parseNumericOrNull(o))
          .typeError('Must be a number')
          .required('Please enter the current utilized capacity')
          .test('less-than-total', 'Utilized capacity cannot exceed total service capacity', function (value) {
            const total = parseNumericOrNull(this.parent.totalServicesCapacity);
            if (value == null || total == null) {
              return true;
            }
            return value <= total;
          }),
        commencementDate: Yup.string().required('Please select the commencement date'),
        isExported: Yup.boolean().typeError('Please select international supply status').required('Please select international supply status'),
        exportCountries: Yup.array().when('isExported', { is: true, then: schema => schema.min(1, 'Please select at least one country'), otherwise: schema => schema.notRequired() }),
        exportPercentage: Yup.number()
          .transform((v, o) => (o === '' ? null : v))
          .typeError('Must be a number')
          .when('isExported', {
            is: true,
            then: schema => schema.required('Please enter the supply percentage').min(1, 'Percentage must be greater than 0').max(100, 'Percentage cannot exceed 100'),
            otherwise: schema => schema.notRequired(),
          }),
      }),
    )
    .min(1, 'Please add at least one service')
    .test(
      'export-total',
      'Total international supply percentage across all services cannot exceed 100%',
      services => (services || []).reduce((sum, s) => sum + (Number(s.exportPercentage) || 0), 0) <= 100,
    ),
  customers: Yup.array()
    .of(
      Yup.object().shape({
        customerName: Yup.string().required('Please enter the customer name').test('unique-customer-name', 'Customer name must be unique', uniqueTest('customers')),
        customerType: Yup.string().oneOf(['domestic', 'international'], 'Please select the customer location').required('Please select the customer location'),
        country: Yup.string().when('customerType', { is: 'international', then: schema => schema.required('Please select the customer country'), otherwise: schema => schema.notRequired() }),
      }),
    )
    .min(1, 'Please add at least one customer'),
  svcKeyProcesses: Yup.array()
    .of(Yup.object().shape({ processName: Yup.string().required('Please enter the key service') }))
    .min(1, 'Please add at least one key service'),
  svcOutsourcedProcesses: Yup.array()
    .of(Yup.object().shape({ processName: Yup.string() }))
    .notRequired(),
  svcKeyResources: Yup.array()
    .of(
      Yup.object().shape({
        resourceName: Yup.string().required('Please enter the resource name').test('unique-resource-name', 'Resource name must be unique', uniqueTest('svcKeyResources')),
        isImported: Yup.boolean().typeError('Please select imported status').required('Please select imported status'),
        importCountry: Yup.string().when('isImported', { is: true, then: schema => schema.required('Please select the import country'), otherwise: schema => schema.notRequired() }),
        importPercentage: Yup.number()
          .transform((v, o) => (o === '' ? null : v))
          .typeError('Must be a number')
          .when('isImported', {
            is: true,
            then: schema => schema.required('Please enter the import percentage').min(1, 'Percentage must be greater than 0').max(100, 'Percentage cannot exceed 100'),
            otherwise: schema => schema.notRequired(),
          }),
      }),
    )
    .test('resource-or-component-required', 'Please add at least one Key Service Resource or Outsourced Service Component.', function () {
      const resources = this.parent?.svcKeyResources || [];
      const components = this.parent?.svcOutsourcedComponents || [];
      const hasResource = resources.some(r => (r?.resourceName || '').toString().trim() !== '');
      const hasComponent = components.some(c => (c?.componentName || '').toString().trim() !== '');
      return hasResource || hasComponent;
    })
    .test(
      'resource-import-total',
      'Total import percentage across all key resources cannot exceed 100%',
      resources => (resources || []).reduce((sum, r) => sum + (Number(r.importPercentage) || 0), 0) <= 100,
    ),
  svcOutsourcedComponents: Yup.array()
    .of(
      Yup.object().shape({
        componentName: Yup.string().required('Please enter the component name').test('unique-component-name', 'Component name must be unique', uniqueTest('svcOutsourcedComponents')),
        isImported: Yup.boolean().typeError('Please select imported status').required('Please select imported status'),
        importCountry: Yup.string().when('isImported', { is: true, then: schema => schema.required('Please select the import country'), otherwise: schema => schema.notRequired() }),
        importPercentage: Yup.number()
          .transform((v, o) => (o === '' ? null : v))
          .typeError('Must be a number')
          .when('isImported', {
            is: true,
            then: schema => schema.required('Please enter the import percentage').min(1, 'Percentage must be greater than 0').max(100, 'Percentage cannot exceed 100'),
            otherwise: schema => schema.notRequired(),
          }),
      }),
    )
    .test(
      'component-import-total',
      'Total import percentage across all outsourced components cannot exceed 100%',
      components => (components || []).reduce((sum, c) => sum + (Number(c.importPercentage) || 0), 0) <= 100,
    ),
  thirdPartyCertifications: Yup.array().of(Yup.string()).min(1, 'Please add at least one third party certification'),
});

const buildInitialValues = info => {
  const services = Array.isArray(info?.svcServices) ? info.svcServices : [];
  const customers = Array.isArray(info?.customers) ? info.customers : [];
  return {
    svcProviderType: info?.svcProviderType || '',
    category: info?.category || '',
    svcDrdoVendorLabs: (info?.svcDrdoVendorLabs || []).map(l => ({ labName: l?.labName || l?.storeName || (typeof l === 'string' ? l : '') })).filter(l => l.labName),
    svcServices:
      services.length > 0
        ? services.map(s => ({
            serviceName: s.serviceName || '',
            totalServicesCapacity: s.totalProductionCapacity ?? s.totalServicesCapacity ?? '',
            capacityUnit: s.capacityUnit || 'Number',
            currentUtilizedCapacity: s.currentUtilizedCapacity ?? '',
            commencementDate: s.commencementDate || '',
            isExported: typeof s.isExported === 'boolean' ? s.isExported : null,
            exportCountries: Array.isArray(s.exportCountries) ? s.exportCountries : [],
            exportPercentage: s.exportPercentage ?? '',
          }))
        : [{ ...EMPTY_SERVICE }],
    customers: (customers.length > 0 ? customers : [{ ...EMPTY_CUSTOMER }]).map(c => ({ customerName: c.customerName || '', customerType: c.customerType || '', country: c.country || '' })),
    svcKeyProcesses: (info?.svcKeyProcesses || []).map(p => ({ processName: p?.processName || (typeof p === 'string' ? p : '') })).filter(p => p.processName),
    svcOutsourcedProcesses: (info?.svcOutsourcedProcesses || []).map(p => ({ processName: p?.processName || (typeof p === 'string' ? p : '') })).filter(p => p.processName),
    svcKeyResources: (info?.svcKeyResources || []).map(r => ({
      resourceName: r.resourceName || '',
      isImported: typeof r.isImported === 'boolean' ? r.isImported : null,
      importCountry: r.importCountry ?? '',
      importPercentage: r.importPercentage ?? '',
    })),
    svcOutsourcedComponents: (info?.svcOutsourcedComponents || []).map(c => ({
      componentName: c.componentName || '',
      isImported: typeof c.isImported === 'boolean' ? c.isImported : null,
      importCountry: c.importCountry ?? '',
      importPercentage: c.importPercentage ?? '',
    })),
    thirdPartyCertifications: Array.isArray(info?.thirdPartyCertificationNames)
      ? info.thirdPartyCertificationNames
      : Array.isArray(info?.thirdPartyCertifications)
        ? info.thirdPartyCertifications
        : [],
  };
};

const buildPayload = v => ({
  svcProviderType: v.svcProviderType,
  category: v.category,
  svcDrdoVendorLabs: (v.svcDrdoVendorLabs || []).filter(l => l.labName).map(l => ({ labName: l.labName })),
  svcServices: (v.svcServices || []).map(s => ({
    serviceName: s.serviceName,
    isExported: !!s.isExported,
    exportCountries: s.isExported ? (Array.isArray(s.exportCountries) ? s.exportCountries : []) : [],
    exportPercentage: s.isExported ? parseNumericOrNull(s.exportPercentage) : null,
    totalProductionCapacity: parseNumericOrNull(s.totalServicesCapacity),
    capacityUnit: s.capacityUnit || 'Number',
    currentUtilizedCapacity: parseNumericOrNull(s.currentUtilizedCapacity),
    capacityUnitUtilized: s.capacityUnit || 'Number',
    commencementDate: s.commencementDate || null,
  })),
  customers: (v.customers || []).map(c => ({ customerName: c.customerName, customerType: c.customerType, country: c.customerType === 'international' ? c.country || null : null })),
  svcKeyProcesses: (v.svcKeyProcesses || []).map(p => ({ processName: p.processName })),
  svcOutsourcedProcesses: (v.svcOutsourcedProcesses || []).map(p => ({ processName: p.processName })),
  svcKeyResources: (v.svcKeyResources || [])
    .filter(r => r.resourceName)
    .map(r => ({
      resourceName: r.resourceName,
      isImported: !!r.isImported,
      importCountry: r.isImported ? r.importCountry || null : null,
      importPercentage: r.isImported ? parseNumericOrNull(r.importPercentage) : null,
    })),
  svcOutsourcedComponents: (v.svcOutsourcedComponents || [])
    .filter(c => c.componentName)
    .map(c => ({
      componentName: c.componentName,
      isImported: !!c.isImported,
      importCountry: c.isImported ? c.importCountry || null : null,
      importPercentage: c.isImported ? parseNumericOrNull(c.importPercentage) : null,
    })),
  thirdPartyCertifications: Array.isArray(v.thirdPartyCertifications) ? v.thirdPartyCertifications : [],
});

const ServiceBasicInformationForm = ({ assessmentId, basicInformation, onSaved }) => {
  const dispatch = useDispatch();
  const { drdoVendorCategoriesV1, vendorLabs, keyProcessV1, keyResources, outsourcedComponents, thirdPartyCerts, countries } = useSelector(state => state.Master);
  const { saveBasicInformationLoading } = useSelector(state => state.ApplicationAssessment);

  useEffect(() => {
    const params = { isActive: true, all: true };
    dispatch(listVendorCategoriesV1Action(params));
    dispatch(listVendorLabsAction(params));
    dispatch(listKeyProcessV1Action(params));
    dispatch(listKeyResourcesAction(params));
    dispatch(listOutsourcedComponentsAction(params));
    dispatch(listThirdPartyCertsAction(params));
    dispatch(listCountriesAction(params));
  }, [dispatch]);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: buildInitialValues(basicInformation),
    validationSchema,
    onSubmit: async values => {
      const res = await dispatch(saveBasicInformationAction({ assessmentId, data: buildPayload(values) }));
      if (saveBasicInformationAction.fulfilled.match(res)) {
        toastSuccess('Basic information saved successfully');
        dispatch(getBasicInformationAction(assessmentId));
        // Awaited so the host's step gating sees this step as completed before it advances.
        await dispatch(getStepProgressAction(assessmentId));
        onSaved?.();
      } else {
        toastError(typeof res.payload === 'string' ? res.payload : res.payload?.message || 'Failed to save basic information');
      }
    },
  });

  const formRef = useRef(null);
  // On a failed Save & Next, bring the first validation error into view — errored fields can be far
  // off-screen. Errors render once submitCount > 0, so this runs after each submit attempt; the short
  // timeout lets the error markers paint before we measure. Covers every field type (custom
  // .error-text messages and MUI .Mui-error inputs/helpers).
  useEffect(() => {
    if (formik.submitCount === 0) {
      return undefined;
    }
    const timer = setTimeout(() => {
      const container = formRef.current;
      if (!container) {
        return;
      }
      const markers = Array.from(container.querySelectorAll('.error-text, .Mui-error'));
      if (markers.length === 0) {
        return;
      }
      const target = markers.reduce((topmost, el) => (el.getBoundingClientRect().top < topmost.getBoundingClientRect().top ? el : topmost), markers[0]);
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.closest('.MuiFormControl-root, .input-container, .box-border')?.querySelector('input, textarea')?.focus?.({ preventScroll: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [formik.submitCount]);

  const providerType = formik.values.svcProviderType;

  const countryOptions = useMemo(
    () =>
      (countries || [])
        .filter(
          c =>
            String(c?.name || '')
              .trim()
              .toLowerCase() !== 'india',
        )
        .map(c => ({ value: String(c?.name || ''), label: String(c?.name || '') })),
    [countries],
  );

  const categoryOptions = useMemo(
    () => (drdoVendorCategoriesV1?.data || []).filter(c => c.serviceProviderType === providerType).map(c => ({ value: c.categoryName, label: c.categoryName })),
    [drdoVendorCategoriesV1, providerType],
  );
  const labOptions = useMemo(() => (vendorLabs?.data || []).filter(l => l.serviceProviderType === providerType).map(l => ({ value: l.labName, label: l.labName })), [vendorLabs, providerType]);
  const keyProcessSuggestions = useMemo(
    () => (keyProcessV1?.data || []).filter(p => p.serviceProviderType === providerType).map(p => ({ value: p.processName, label: p.processName })),
    [keyProcessV1, providerType],
  );
  const resourceSuggestions = useMemo(
    () => (keyResources?.data || []).filter(r => r.serviceProviderType === providerType).map(r => ({ value: r.resourceName, label: r.resourceName })),
    [keyResources, providerType],
  );
  const componentSuggestions = useMemo(
    () => (outsourcedComponents?.data || []).filter(c => c.serviceProviderType === providerType).map(c => ({ value: c.componentName, label: c.componentName })),
    [outsourcedComponents, providerType],
  );
  const certSuggestions = useMemo(() => (thirdPartyCerts?.data || []).map(c => ({ value: c.certificationName, label: c.certificationName })), [thirdPartyCerts]);

  const fieldError = path => {
    const err = getIn(formik.errors, path);
    const touched = getIn(formik.touched, path);
    return (touched || formik.submitCount > 0) && typeof err === 'string' ? err : '';
  };
  const arrayError = path => {
    const err = getIn(formik.errors, path);
    return formik.submitCount > 0 && typeof err === 'string' ? err : '';
  };

  const handleProviderTypeChange = e => {
    formik.setFieldValue('svcProviderType', e.target.value);
    formik.setFieldValue('category', '', false);
    formik.setFieldValue('svcDrdoVendorLabs', [], false);
    formik.setFieldTouched('category', false);
    formik.setFieldTouched('svcDrdoVendorLabs', false);
  };

  return (
    <FormikProvider value={formik}>
      <form ref={formRef} onSubmit={formik.handleSubmit} noValidate className="service-basic-information-form">
        <div className="form-section bottom-seperator">
          {/* <h5 className="section-title">Category & Services</h5> */}
          <div className="row gap-vertical-30">
            <div className="col-md-12">
              <FormControl component="fieldset" sx={{ width: '100%' }}>
                <span className="label">
                  Type of Service Provider<span className="asterics">*</span>
                </span>
                <RadioGroup value={providerType} onChange={handleProviderTypeChange} sx={{ flexDirection: 'row' }}>
                  <FormControlLabel
                    value="annual_maintenance_contract"
                    control={radioControl}
                    label="Annual Maintenance Contract (AMC)"
                    sx={{ marginRight: 3, '& .MuiFormControlLabel-label': { fontSize: '14px' } }}
                  />
                  <FormControlLabel
                    value="critical_service_provider"
                    control={radioControl}
                    label="Critical Service Provider"
                    sx={{ marginRight: 3, '& .MuiFormControlLabel-label': { fontSize: '14px' } }}
                  />
                  <FormControlLabel value="civil_works_contractor" control={radioControl} label="Civil Works Contractors" sx={{ '& .MuiFormControlLabel-label': { fontSize: '14px' } }} />
                </RadioGroup>
                {fieldError('svcProviderType') && <div className="error-text margin-top-4">{fieldError('svcProviderType')}</div>}
              </FormControl>
            </div>

            {providerType && (
              <div className="col-12">
                <div className="row">
                  <div className="col-12 col-md-6">
                    <AppDropdown
                      name="category"
                      label="Category"
                      isRequired
                      options={categoryOptions}
                      value={formik.values.category}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={fieldError('category')}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <AppMultiSelectDropdown
                      name="svcDrdoVendorLabs"
                      chipMode
                      label="Services"
                      subLabel="Select the service(s) under which the unit is applying."
                      isRequired
                      options={labOptions}
                      value={Array.isArray(formik.values.svcDrdoVendorLabs) ? formik.values.svcDrdoVendorLabs.map(l => (typeof l === 'string' ? l : l.labName || '')) : []}
                      onChange={value =>
                        formik.setFieldValue(
                          'svcDrdoVendorLabs',
                          (Array.isArray(value) ? value : []).map(val => ({ labName: val })),
                        )
                      }
                      placeholder="Select Services"
                      error={arrayError('svcDrdoVendorLabs')}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="form-section bottom-seperator">
          <h5 className="section-title">Service Details</h5>
          <FieldArray name="svcServices">
            {({ push, remove }) => (
              <>
                {formik.values.svcServices.map((service, index) => (
                  <div key={index} className="box-border margin-bottom-20">
                    <div className="rowBetween margin-bottom-16">
                      <h5 className="section-title-product">Service {index + 1}</h5>
                      {formik.values.svcServices.length > 1 && (
                        <AppButton size="small" variant="danger-secondary" title="Remove" onClick={() => remove(index)} rightIcon={Icons.trash} rightIconStyle="icon-12" />
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
                          error={fieldError(`svcServices[${index}].serviceName`)}
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
                          disableDropdown
                          isRequired
                          numericFormat
                          error={fieldError(`svcServices[${index}].totalServicesCapacity`)}
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
                          disableDropdown
                          isRequired
                          numericFormat
                          maxValue={parseNumericOrNull(service.totalServicesCapacity)}
                          error={fieldError(`svcServices[${index}].currentUtilizedCapacity`)}
                        />
                      </div>
                      <div className="col-md-6">
                        <AppDatePicker
                          label="Date of Commencement"
                          value={service.commencementDate}
                          onChange={value => formik.setFieldValue(`svcServices[${index}].commencementDate`, value)}
                          placeholder="Select date"
                          isRequired
                          subLabel="Commencement date of service"
                          error={fieldError(`svcServices[${index}].commencementDate`)}
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
                                formik.setFieldValue(`svcServices[${index}].exportCountries`, [], false);
                                formik.setFieldValue(`svcServices[${index}].exportPercentage`, '', false);
                                formik.setFieldTouched(`svcServices[${index}].exportCountries`, false);
                                formik.setFieldTouched(`svcServices[${index}].exportPercentage`, false);
                              }
                            }}
                            name={`svcServices[${index}].isExported`}
                            sx={{ flexDirection: 'row', gap: 2 }}>
                            <FormControlLabel value="yes" control={radioControl} label="Yes" sx={{ marginRight: 3, '& .MuiFormControlLabel-label': { fontSize: '14px' } }} />
                            <FormControlLabel value="no" control={radioControl} label="No" sx={{ '& .MuiFormControlLabel-label': { fontSize: '14px' } }} />
                          </RadioGroup>
                          {fieldError(`svcServices[${index}].isExported`) && <div className="error-text">{fieldError(`svcServices[${index}].isExported`)}</div>}
                          {service.isExported && (
                            <div style={{ marginTop: '20px' }}>
                              <div className="row">
                                <div className="col-12 col-md-6">
                                  <AppMultiSelectDropdown
                                    label="Destination Country"
                                    options={countryOptions}
                                    chipMode
                                    value={Array.isArray(service.exportCountries) ? service.exportCountries : []}
                                    onChange={newValue => formik.setFieldValue(`svcServices[${index}].exportCountries`, Array.isArray(newValue) ? newValue : [])}
                                    placeholder="Select Destination Country"
                                    name={`svcServices[${index}].exportCountries`}
                                    isRequired
                                    error={fieldError(`svcServices[${index}].exportCountries`)}
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
                                    percentageFormat
                                    error={fieldError(`svcServices[${index}].exportPercentage`)}
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
                {arrayError('svcServices') && <div className="error-text margin-top-4">{arrayError('svcServices')}</div>}
                <AppButton variant="primary" onClick={() => push({ ...EMPTY_SERVICE })} title="Add More" leftIcon={Icons.addMore} leftIconStyle="icon-16" customClass="ms-auto" />
              </>
            )}
          </FieldArray>
        </div>

        <div className="form-section bottom-seperator">
          <h5 className="section-title">Customer Details</h5>
          <FieldArray name="customers">
            {({ push, remove }) => (
              <>
                {formik.values.customers.map((customer, index) => (
                  <div key={index} className="box-border margin-bottom-20">
                    <div className="rowBetween margin-bottom-16">
                      <h5 className="section-title-product">Customer {index + 1}</h5>
                      {formik.values.customers.length > 1 && (
                        <AppButton size="small" variant="danger-secondary" title="Remove" onClick={() => remove(index)} rightIcon={Icons.trash} rightIconStyle="icon-12" />
                      )}
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
                          isRequired
                          error={fieldError(`customers[${index}].customerName`)}
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
                              formik.setFieldValue(`customers[${index}].country`, '', false);
                              formik.setFieldTouched(`customers[${index}].country`, false);
                            }}
                            name={`customers[${index}].customerType`}
                            sx={{ flexDirection: 'row', gap: 2 }}>
                            <FormControlLabel value="domestic" control={radioControl} label="Domestic" sx={{ marginRight: 3, '& .MuiFormControlLabel-label': { fontSize: '14px' } }} />
                            <FormControlLabel value="international" control={radioControl} label="International" sx={{ '& .MuiFormControlLabel-label': { fontSize: '14px' } }} />
                          </RadioGroup>
                          {fieldError(`customers[${index}].customerType`) && <div className="error-text">{fieldError(`customers[${index}].customerType`)}</div>}
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
                            options={countryOptions}
                            placeholder="Select Country"
                            isRequired
                            error={fieldError(`customers[${index}].country`)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {arrayError('customers') && <div className="error-text margin-top-4">{arrayError('customers')}</div>}
                <AppButton variant="primary" onClick={() => push({ ...EMPTY_CUSTOMER })} title="Add More" leftIcon={Icons.addMore} leftIconStyle="icon-16" customClass="ms-auto" />
              </>
            )}
          </FieldArray>
        </div>

        <div className="form-section bottom-seperator">
          <h5 className="section-title">Key Services</h5>
          <div className="contact-person-note-container">
            <img src={Icons.infoCircle} alt="info" className="icon-16 margin-right-6" />
            <span className="contact-person-note">Enter the key services involved in delivering the service. Mark a service as outsourced if it is carried out outside the unit.</span>
          </div>
          <div className="col-md-12 margin-top-20">
            <AppSuggestionInput
              placeholder="Select or type & press enter"
              label="Key Services"
              suggestions={keyProcessSuggestions}
              value={formik.values.svcKeyProcesses.map(p => (typeof p === 'string' ? p : p.processName || ''))}
              onChange={newValue => {
                const selected = Array.isArray(newValue) ? newValue : [];
                formik.setFieldValue(
                  'svcKeyProcesses',
                  selected.map(val => ({ processName: val })),
                );
                const retainedOutsourced = formik.values.svcOutsourcedProcesses
                  .map(op => (typeof op === 'string' ? op : op.processName || ''))
                  .filter(name => selected.includes(name))
                  .map(name => ({ processName: name }));
                formik.setFieldValue('svcOutsourcedProcesses', retainedOutsourced);
              }}
              name="svcKeyProcesses"
              maxSuggestions={10}
              Outsourced
              outsourcedValues={formik.values.svcOutsourcedProcesses.map(p => (typeof p === 'string' ? p : p.processName || ''))}
              onToggleOutsourced={(idx, outsourced) => {
                const tags = formik.values.svcKeyProcesses.map(p => (typeof p === 'string' ? p : p.processName || ''));
                const processName = tags[idx];
                if (!processName) {
                  return;
                }
                const current = formik.values.svcOutsourcedProcesses;
                const existsIdx = current.findIndex(op => (typeof op === 'string' ? op : op.processName) === processName);
                if (outsourced && existsIdx === -1) {
                  formik.setFieldValue('svcOutsourcedProcesses', [...current, { processName }], true);
                } else if (!outsourced && existsIdx !== -1) {
                  const next = [...current];
                  next.splice(existsIdx, 1);
                  formik.setFieldValue('svcOutsourcedProcesses', next, true);
                }
              }}
              max={100}
              isRequired
              error={arrayError('svcKeyProcesses')}
            />
          </div>
        </div>

        <div className="form-section bottom-seperator">
          <div className="contact-person-note-container">
            <img src={Icons.infoCircle} alt="info" className="icon-16 margin-right-6" />
            <span className="contact-person-note">You must add at least one Key Service Resource or Outsourced Service Component.</span>
          </div>
          {arrayError('svcKeyResources') && (
            <div className="error-text" style={{ marginTop: 6 }}>
              {arrayError('svcKeyResources')}
            </div>
          )}
          <h5 className="section-title margintop-30">Key Service Resources</h5>
          <FieldArray name="svcKeyResources">
            {({ push, remove }) =>
              formik.values.svcKeyResources.length === 0 ? (
                <AppButton variant="primary" onClick={() => push({ ...EMPTY_RESOURCE })} title="Add Key Service Resource" leftIcon={Icons.addMore} leftIconStyle="icon-16" customClass="ms-auto" />
              ) : (
                <>
                  {formik.values.svcKeyResources.map((resource, index) => (
                    <div key={index} className="box-border margin-bottom-20">
                      <div className="row">
                        <div className="rowBetween">
                          <h5 className="section-title-product">Key Service Resource {index + 1}</h5>
                          <AppButton size="small" variant="danger-secondary" title="Remove" onClick={() => remove(index)} rightIcon={Icons.trash} rightIconStyle="icon-12" />
                        </div>
                        <div className="col-md-6">
                          <AppSuggestionInput
                            placeholder="Select or type manually"
                            label="Key Service Resource"
                            suggestions={resourceSuggestions}
                            value={resource.resourceName || ''}
                            onChange={newValue => {
                              const val = Array.isArray(newValue) ? newValue[0] || '' : typeof newValue === 'object' && newValue ? newValue.value || newValue.label || '' : newValue || '';
                              formik.setFieldValue(`svcKeyResources[${index}].resourceName`, val);
                            }}
                            onBlur={() => formik.setFieldTouched(`svcKeyResources[${index}].resourceName`, true)}
                            name={`svcKeyResources[${index}].resourceName`}
                            isRequired
                            max={100}
                            maxSuggestionLength={1}
                            error={fieldError(`svcKeyResources[${index}].resourceName`)}
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
                              value={resource.isImported === true ? 'yes' : resource.isImported === false ? 'no' : ''}
                              onChange={e => {
                                formik.setFieldValue(`svcKeyResources[${index}].isImported`, e.target.value === 'yes');
                                if (e.target.value === 'no') {
                                  formik.setFieldValue(`svcKeyResources[${index}].importCountry`, '', false);
                                  formik.setFieldValue(`svcKeyResources[${index}].importPercentage`, '', false);
                                  formik.setFieldTouched(`svcKeyResources[${index}].importCountry`, false);
                                  formik.setFieldTouched(`svcKeyResources[${index}].importPercentage`, false);
                                }
                              }}
                              name={`svcKeyResources[${index}].isImported`}
                              sx={{ flexDirection: 'row', gap: 2 }}>
                              <FormControlLabel value="yes" control={radioControl} label="Yes" sx={{ marginRight: 3, '& .MuiFormControlLabel-label': { fontSize: '14px' } }} />
                              <FormControlLabel value="no" control={radioControl} label="No" sx={{ '& .MuiFormControlLabel-label': { fontSize: '14px' } }} />
                            </RadioGroup>
                            {fieldError(`svcKeyResources[${index}].isImported`) && <div className="error-text">{fieldError(`svcKeyResources[${index}].isImported`)}</div>}
                          </FormControl>
                        </div>
                        {resource.isImported === true && (
                          <>
                            <div className="col-md-5">
                              <AppDropdown
                                label="Source Country"
                                name={`svcKeyResources[${index}].importCountry`}
                                value={resource.importCountry}
                                onChange={e => formik.setFieldValue(`svcKeyResources[${index}].importCountry`, e.target.value)}
                                onBlur={formik.handleBlur}
                                options={countryOptions}
                                placeholder="Select Source Country"
                                isRequired
                                error={fieldError(`svcKeyResources[${index}].importCountry`)}
                              />
                            </div>
                            <div className="col-md-3">
                              <AppInput
                                placeholder="Enter Percentage(%)"
                                label="Overseas Sourcing (%)"
                                percentageFormat
                                value={resource.importPercentage}
                                onChange={e => formik.setFieldValue(`svcKeyResources[${index}].importPercentage`, e.target.value)}
                                onBlur={formik.handleBlur}
                                name={`svcKeyResources[${index}].importPercentage`}
                                isRequired
                                error={fieldError(`svcKeyResources[${index}].importPercentage`)}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  <AppButton variant="primary" onClick={() => push({ ...EMPTY_RESOURCE })} title="Add More" leftIcon={Icons.addMore} leftIconStyle="icon-16" customClass="ms-auto" />
                </>
              )
            }
          </FieldArray>

          <div className="margintop-30">
            <h5 className="section-title">Outsourced Service Components</h5>
            <FieldArray name="svcOutsourcedComponents">
              {({ push, remove }) =>
                formik.values.svcOutsourcedComponents.length === 0 ? (
                  <AppButton
                    variant="primary"
                    onClick={() => push({ ...EMPTY_COMPONENT })}
                    title="Add Outsourced Service Component"
                    leftIcon={Icons.addMore}
                    leftIconStyle="icon-16"
                    customClass="ms-auto"
                  />
                ) : (
                  <>
                    {formik.values.svcOutsourcedComponents.map((component, index) => (
                      <div key={index} className="box-border margin-bottom-20">
                        <div className="row">
                          <div className="rowBetween">
                            <h5 className="section-title-product">Outsourced Service Component {index + 1}</h5>
                            <AppButton size="small" variant="danger-secondary" title="Remove" onClick={() => remove(index)} rightIcon={Icons.trash} rightIconStyle="icon-12" />
                          </div>
                          <div className="col-md-6">
                            <AppSuggestionInput
                              placeholder="Select or type manually"
                              optionWidth="100%"
                              label="Outsourced Service Component"
                              suggestions={componentSuggestions}
                              value={component.componentName || ''}
                              onChange={newValue => {
                                const val = Array.isArray(newValue) ? newValue[0] || '' : typeof newValue === 'object' && newValue ? newValue.value || newValue.label || '' : newValue || '';
                                formik.setFieldValue(`svcOutsourcedComponents[${index}].componentName`, val);
                              }}
                              onBlur={() => formik.setFieldTouched(`svcOutsourcedComponents[${index}].componentName`, true)}
                              name={`svcOutsourcedComponents[${index}].componentName`}
                              isRequired
                              max={100}
                              maxSuggestionLength={1}
                              error={fieldError(`svcOutsourcedComponents[${index}].componentName`)}
                            />
                          </div>
                        </div>
                        <div className="row margintop-30">
                          <div className="col-md-4">
                            <FormControl component="fieldset" sx={{ marginBottom: 2, width: '100%' }}>
                              <div className="d-flex">
                                <span className="label">
                                  Is this Service Component from Overseas? <span className="asterics">*</span>
                                </span>
                              </div>
                              <RadioGroup
                                value={component.isImported === true ? 'yes' : component.isImported === false ? 'no' : ''}
                                onChange={e => {
                                  formik.setFieldValue(`svcOutsourcedComponents[${index}].isImported`, e.target.value === 'yes');
                                  if (e.target.value === 'no') {
                                    formik.setFieldValue(`svcOutsourcedComponents[${index}].importCountry`, '', false);
                                    formik.setFieldValue(`svcOutsourcedComponents[${index}].importPercentage`, '', false);
                                    formik.setFieldTouched(`svcOutsourcedComponents[${index}].importCountry`, false);
                                    formik.setFieldTouched(`svcOutsourcedComponents[${index}].importPercentage`, false);
                                  }
                                }}
                                name={`svcOutsourcedComponents[${index}].isImported`}
                                sx={{ flexDirection: 'row', gap: 2 }}>
                                <FormControlLabel value="yes" control={radioControl} label="Yes" sx={{ marginRight: 3, '& .MuiFormControlLabel-label': { fontSize: '14px' } }} />
                                <FormControlLabel value="no" control={radioControl} label="No" sx={{ '& .MuiFormControlLabel-label': { fontSize: '14px' } }} />
                              </RadioGroup>
                              {fieldError(`svcOutsourcedComponents[${index}].isImported`) && <div className="error-text">{fieldError(`svcOutsourcedComponents[${index}].isImported`)}</div>}
                            </FormControl>
                          </div>
                          {component.isImported === true && (
                            <>
                              <div className="col-md-5">
                                <AppDropdown
                                  label="Source Country"
                                  placeholder="Select Source Country"
                                  value={component.importCountry}
                                  onChange={e => formik.setFieldValue(`svcOutsourcedComponents[${index}].importCountry`, e.target.value)}
                                  onBlur={formik.handleBlur}
                                  name={`svcOutsourcedComponents[${index}].importCountry`}
                                  options={countryOptions}
                                  isRequired
                                  error={fieldError(`svcOutsourcedComponents[${index}].importCountry`)}
                                />
                              </div>
                              <div className="col-md-3">
                                <AppInput
                                  label="Overseas Sourcing (%)"
                                  placeholder="Enter Percentage(%)"
                                  value={component.importPercentage}
                                  percentageFormat
                                  onChange={e => formik.setFieldValue(`svcOutsourcedComponents[${index}].importPercentage`, e.target.value)}
                                  onBlur={formik.handleBlur}
                                  name={`svcOutsourcedComponents[${index}].importPercentage`}
                                  isRequired
                                  error={fieldError(`svcOutsourcedComponents[${index}].importPercentage`)}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    <AppButton variant="primary" onClick={() => push({ ...EMPTY_COMPONENT })} title="Add More" leftIcon={Icons.addMore} leftIconStyle="icon-16" customClass="ms-auto" />
                  </>
                )
              }
            </FieldArray>
          </div>
        </div>

        <div className="form-section">
          <div className="col-md-12 margin-top-20">
            <AppSuggestionInput
              name="thirdPartyCertifications"
              label="Third Party Certifications"
              subLabel="Type or select all quality certifications the unit has obtained (e.g., ISO 9001, ISO 14001, etc.)"
              suggestions={certSuggestions}
              value={formik.values.thirdPartyCertifications}
              placeholder="Select or Type & press enter"
              max={100}
              optionWidth="100%"
              enableBulkActions
              onChange={newValue => formik.setFieldValue('thirdPartyCertifications', Array.isArray(newValue) ? newValue : [])}
              isRequired
              maxSuggestions={10}
              error={arrayError('thirdPartyCertifications')}
            />
          </div>
        </div>

        <div className="d-flex justify-content-end margin-top-20">
          <AppButton
            type="button"
            variant="primary"
            title="Save & Next"
            loading={saveBasicInformationLoading}
            disabled={saveBasicInformationLoading}
            onClick={formik.handleSubmit}
            rightIcon={Icons.rightWhiteArrow}
          />
        </div>
      </form>
    </FormikProvider>
  );
};

export default ServiceBasicInformationForm;
