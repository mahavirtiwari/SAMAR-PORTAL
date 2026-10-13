import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppButton, AppDropdown, AppInput, AppModal } from '../../../../components/base';
import AppFileUpload from '../../../../components/base/textInput/AppFileUpload';
import { toastError, toastWarning } from '../../../../components/base/toast';
import { Layout } from '../../../../components/layout';
import { OPENED_BLOB_URL_TTL_MS, SUCCESS_MESSAGE_DELAY_MS } from '../../../../constants/appConstants';
import Icons from '../../../../constants/Icons';
import { downloadDocumentAction, getDocumentsAction } from '../../../../redux/action/common/DocumentAction';
import { createSupportTicketAction } from '../../../../redux/action/enterpriseAdmin/SupportAction';
import { resetCreateSupportTicket } from '../../../../redux/slices/enterpriseAdmin/SupportSlice';
import { Logger } from '../../../../utils/logger';

const Support = () => {
  const dispatch = useDispatch();
  const { documents } = useSelector(state => state.SystemAdminDocument || {});
  const { createSupportTicket, createSupportTicketLoading, createSupportTicketError } = useSelector(state => state.EnterpriseAdminSupport || {});
  // current logged in user (used to include user_role in support payload)
  const { user } = useSelector(state => state.Account || {});
  const [formData, setFormData] = useState({
    issueType: '',
    issueCategory: '',
    issueSubCategory: '',
    subject: '',
    description: '',
    priority: 'medium', // default priority
    udyamNumber: '', // maps to udyam_number in payload
    attachment: null,
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState('');
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [_toastMsg, setToastMsg] = useState({ variant: 'error', title: 'Error', subTitle: '' });
  const showToast = (variant, title, subTitle) => {
    setToastMsg({ variant, title, subTitle });
    const fn = variant === 'warning' ? toastWarning : toastError;
    fn(subTitle, { title });
  };

  // top-level types
  const issueTypeOptions = [
    { value: 'complaint', label: 'Complaint' },
    { value: 'query', label: 'Query' },
  ];

  // mapping for categories/subcategories for each type
  const typeCategoryMap = {
    complaint: [
      { value: 'assessor', label: 'Assessor' },
      { value: 'Certification Process/empannelment process related', label: 'Certification Process/empannelment process related' },
      // future complaint categories can be added here
    ],
    query: [
      { value: 'samar', label: 'SAMAR' },
      // future query categories can be added here
    ],
  };

  const subCategoryMap = {
    // Complaint -> Assessor subcategories
    assessor: [
      { value: 'behavioral_issue', label: 'Behavioral Issue' },
      { value: 'ethical_issue', label: 'Ethical Issue' },
      { value: 'professional_competency', label: 'Professional Competency' },
    ],
    // Query -> SAMAR subcategories
    samar: [
      { value: 'assessor_training', label: 'Assessor Training Program Related' },
      { value: 'registration', label: 'Registration Related' },
      { value: 'application_status', label: 'SAMAR Application Status Related' },
      { value: 'assessment', label: 'Assessment Related' },
      { value: 'payment', label: 'Payment Related' },
      { value: 'invoice', label: 'Invoice Related' },
      { value: 'certification', label: 'Certification Related' },
      { value: 'others', label: 'Others' },
    ],
    // Certification category -> use the same subcategories you expect to see in main "Issue Sub-Category"
    'Certification Process/empannelment process related': [
      { value: 'operational_issue', label: 'Operational issue' },
      { value: 'samar_staff_related', label: 'SAMAR staff related' },
    ],
  };

  // computed category options based on selected type
  const issueCategoryOptions = useMemo(() => {
    return (
      typeCategoryMap[formData.issueType] || [
        // fallback options (neutral)
        { value: 'general', label: 'General' },
      ]
    );
  }, [formData.issueType]);

  // computed subcategory options based on selected category (assumes category values match keys in subCategoryMap)
  const issueSubCategoryOptions = useMemo(() => {
    return subCategoryMap[formData.issueCategory] || [];
  }, [formData.issueCategory]);

  // UserGuideCard component
  const UserGuideCard = ({ title, onDownload, downloadLoading, downloadingId, docId }) => (
    <div className="user-guide-container">
      <div className="rowCenter">
        <div className="user-guide-img">
          <img src={Icons.userGuide} alt="User Guide" className="img-fluid" />
        </div>
        <span className="fs-16 fw-500 heading-color">{title}</span>
      </div>
      <div className="rowCenter">
        <AppButton variant="link" size="small" title="Download" leftIcon={Icons.download} onClick={onDownload} loading={downloadLoading && downloadingId === docId} />
      </div>
    </div>
  );

  const handleInputChange = (name, value) => {
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      // clear dependent fields when category changes
      if (name === 'issueCategory' && value !== prev.issueCategory) {
        next.issueSubCategory = '';
      }
      return next;
    });

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleBlur = name => {
    setTouched(prev => ({
      ...prev,
      [name]: true,
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.issueType) {
      newErrors.issueType = 'Select an issue type';
    }
    if (!formData.issueCategory) {
      newErrors.issueCategory = 'Select an issue category';
    }
    if (!formData.issueSubCategory) {
      newErrors.issueSubCategory = 'Select an issue sub-category';
    }
    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = e => {
    e.preventDefault();

    // Mark all fields as touched
    const allTouched = {};
    Object.keys(formData).forEach(key => {
      allTouched[key] = true;
    });
    setTouched(allTouched);

    if (validateForm()) {
      (async () => {
        try {
          // build FormData to include file
          const computedUserRole = (() => {
            const resolveRole = roleValue => {
              if (!roleValue) {
                return '';
              }
              if (typeof roleValue === 'string') {
                return roleValue;
              }
              if (typeof roleValue === 'object') {
                return roleValue.slug || roleValue.name || roleValue.value || '';
              }
              return '';
            };

            if (Array.isArray(user?.roles) && user.roles.length > 0) {
              return resolveRole(user.roles[0]);
            }

            return resolveRole(user?.role || user?.roles);
          })();

          const payload =
            formData instanceof FormData
              ? (() => {
                  try {
                    if (computedUserRole) {
                      formData.append('userRole', computedUserRole);
                    }
                    // ensure subject present
                    if (formData.get && !formData.get('subject')) {
                      formData.append('subject', formData.get('subject') || '');
                    }
                  } catch (e) {
                    Logger.error('Failed to append userRole to FormData:', e);
                  }
                  return formData;
                })()
              : (() => {
                  const fd = new FormData();
                  // Append camelCase API keys
                  fd.append('subject', formData.subject || '');
                  fd.append('description', formData.description || '');
                  fd.append('priority', formData.priority || 'medium');
                  if (computedUserRole) {
                    fd.append('userRole', computedUserRole);
                  }
                  fd.append('issueCategory', formData.issueCategory || '');
                  fd.append('issueType', formData.issueType || '');
                  fd.append('issueSubCategory', formData.issueSubCategory || '');
                  fd.append('udyamNumber', formData.udyamNumber || '');

                  // Also append any remaining original keys (camelCase) and attachment
                  Object.entries(formData).forEach(([k, v]) => {
                    if (v === null || v === undefined) {
                      return;
                    }
                    if (k === 'attachment') {
                      if (typeof File !== 'undefined' && v instanceof File) {
                        // The API takes an attachments array (max 5); a singular key is
                        // silently ignored, creating the ticket with the file dropped.
                        fd.append('attachments[]', v);
                      }
                      return;
                    }
                    // skip keys already appended above
                    if (['subject', 'description', 'priority', 'userRole', 'issueCategory', 'issueType', 'issueSubCategory', 'udyamNumber'].includes(k)) {
                      return;
                    }
                    if (Array.isArray(v)) {
                      v.forEach(item => fd.append(k, item));
                    } else {
                      fd.append(k, String(v));
                    }
                  });
                  return fd;
                })();
          await dispatch(createSupportTicketAction(payload));
        } catch (err) {
          Logger.error('Support submit error:', err);
          setShowError(err?.message || 'Failed to submit. Please try again.');
        }
      })();
    }
  };

  useEffect(() => {
    if (!createSupportTicketLoading) {
      if (createSupportTicketError) {
        setShowError(createSupportTicketError?.message || 'Failed to submit. Please try again.');
        return;
      }
      if (createSupportTicket) {
        setShowSuccess(true);
        // hide success after delay
        setTimeout(() => setShowSuccess(false), SUCCESS_MESSAGE_DELAY_MS);
        setFormData({
          issueType: '',
          issueCategory: '',
          issueSubCategory: '',
          subject: '',
          description: '',
          priority: 'medium',
          udyamNumber: '',
          attachment: null,
        });
        setErrors({});
        setTouched({});
      }
      dispatch(resetCreateSupportTicket());
    }
  }, [createSupportTicketLoading, createSupportTicketError, createSupportTicket]);
  const contactInfo = [
    {
      icon: Icons.clock,
      title: 'Working days',
      info: '(Monday-Friday), 9:00 AM - 5:30 PM',
    },
    {
      icon: Icons.location,
      title: 'Quality Council of India: National Division for Industry Excellence (NDIE)',
      info: 'Tower K-200, Second Floor, World Trade Centre, Safdarjung Enclave, Nauroji Nagar, New Delhi - 110029, India',
    },
    {
      icon: Icons.call,
      title: 'Helpline: SAMAR Team',
      info: '+91-9311412838',
    },
    {
      icon: Icons.sms,
      title: 'Email',
      info: 'samar@qcin.org',
    },
  ];
  useEffect(() => {
    const params = {
      isActive: true,
      all: true,
    };
    dispatch(getDocumentsAction(params));
  }, []);

  const handleDownloadDocument = async doc => {
    try {
      if (!doc) {
        return;
      }
      setDownloadLoading(true);
      setDownloadingId(doc.id);
      if (doc.id) {
        const result = await dispatch(downloadDocumentAction(doc.id));
        setDownloadLoading(false);
        setDownloadingId(null);
        if (result?.type && result.type.endsWith('/fulfilled')) {
          const payload = result.payload ?? result.payload?.data;
          const fileName = doc.title || doc.name || 'document';
          const fileExtension = String(fileName).toLowerCase().split('.').pop() || '';
          let mimeType = 'application/pdf';
          if (fileExtension === 'docx') {
            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          }
          if (fileExtension === 'doc') {
            mimeType = 'application/msword';
          }
          const blobData = payload instanceof Blob ? payload : (payload?.data ?? payload);
          const blob = blobData instanceof Blob ? blobData : new Blob([blobData], { type: mimeType });
          const url = window.URL.createObjectURL(blob);
          window.open(url, '_blank');
          setTimeout(() => window.URL.revokeObjectURL(url), OPENED_BLOB_URL_TTL_MS);
          return;
        }
        Logger.error('Document download failed', result);
        showToast('error', 'Download failed', 'Failed to download document.');
      } else if (doc.downloadUrl) {
        window.open(doc.downloadUrl, '_blank');
        setDownloadLoading(false);
        setDownloadingId(null);
      } else {
        Logger.warn('No document URL or id available for', doc);
        showToast('warning', 'Not available', 'No document available to download.');
        setDownloadLoading(false);
        setDownloadingId(null);
      }
    } catch (err) {
      Logger.error('Download document error:', err);
      showToast('error', 'Download failed', 'Failed to download document. Please try again.');
      setDownloadLoading(false);
      setDownloadingId(null);
    }
  };

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="support-container">
            <div className="row">
              {/* Left Column - Form */}
              <div className="col-md-6 support-form-section">
                <h1 className="page-heading">SAMAR Query</h1>

                <form onSubmit={handleSubmit}>
                  <div className="row margintop-30" style={{ rowGap: '20px' }}>
                    {/* Issue Type */}
                    <div className="col-12">
                      <AppDropdown
                        name="issueType"
                        value={formData.issueType}
                        onChange={e => handleInputChange('issueType', e.target.value)}
                        onBlur={() => handleBlur('issueType')}
                        options={issueTypeOptions}
                        label="Issue Type"
                        isRequired={true}
                        error={touched.issueType && errors.issueType ? errors.issueType : ''}
                      />
                    </div>

                    {/* Issue Category */}
                    <div className="col-md-6">
                      <AppDropdown
                        name="issueCategory"
                        value={formData.issueCategory}
                        onChange={e => handleInputChange('issueCategory', e.target.value)}
                        onBlur={() => handleBlur('issueCategory')}
                        options={issueCategoryOptions}
                        label="Issue Category"
                        isRequired={true}
                        error={touched.issueCategory && errors.issueCategory ? errors.issueCategory : ''}
                      />
                    </div>

                    {/* Issue Sub-Category */}
                    <div className="col-md-6">
                      <AppDropdown
                        name="issueSubCategory"
                        value={formData.issueSubCategory}
                        onChange={e => handleInputChange('issueSubCategory', e.target.value)}
                        onBlur={() => handleBlur('issueSubCategory')}
                        options={issueSubCategoryOptions}
                        label="Issue Sub-Category"
                        isRequired={true}
                        error={touched.issueSubCategory && errors.issueSubCategory ? errors.issueSubCategory : ''}
                      />
                    </div>

                    {/* Subject */}
                    <div className="col-12">
                      <AppInput
                        name="subject"
                        value={formData.subject}
                        onChange={e => handleInputChange('subject', e.target.value)}
                        onBlur={() => handleBlur('subject')}
                        placeholder="Issue subject (e.g. Issue with certification process)"
                        label="Subject"
                        isRequired={true}
                        error={touched.subject && errors.subject ? errors.subject : ''}
                      />
                    </div>
                    {/* Priority */}

                    {/* UDYAM Number */}

                    {/* Description */}
                    <div className="col-12">
                      <AppInput
                        name="description"
                        value={formData.description}
                        onChange={e => handleInputChange('description', e.target.value)}
                        onBlur={() => handleBlur('description')}
                        placeholder="Enter Description"
                        label="Description"
                        multiline
                        rows={4}
                        isRequired={true}
                        error={touched.description && errors.description ? errors.description : ''}
                      />
                    </div>

                    {/* Attachment */}
                    <div className="col-12">
                      <AppFileUpload label="Attachment" accept=".jpg,.jpeg,.png,.pdf,.doc,.docx" maxSizeMB={10} onChange={file => handleInputChange('attachment', file)} value={formData.attachment} />
                    </div>

                    {/* Submit Button */}
                    <div className="col-12 margin-top-10">
                      <AppButton variant="primary" size="medium" title="Submit" type="submit" minWidth={'100%'} loading={createSupportTicketLoading} disabled={createSupportTicketLoading} />
                    </div>
                  </div>
                </form>
              </div>

              {/* Right Column - Contact Info */}
              <div className="col-md-6 contact-info-container">
                <h2 className="page-heading">Contact Info</h2>

                <div className="contact-info-list margintop-30 horizontal-seperator-24">
                  {contactInfo.map((item, index) => (
                    <div key={index} className="contact-info-item">
                      <div>
                        <img src={item.icon} alt={item.title} className="icon-24" />
                      </div>
                      <div className="contact-info-content">
                        <div className="contact-info-label">{item.title}</div>
                        <div className="contact-info-value">{item.info}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {documents?.length > 0 && (
                  <>
                    <h2 className="page-heading margin-bottom-30">User Guides</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {documents.map((doc, idx) => (
                        <UserGuideCard
                          key={`${doc.id}-${idx}`}
                          title={doc.title || doc.name}
                          onDownload={() => handleDownloadDocument(doc)}
                          downloadLoading={downloadLoading}
                          downloadingId={downloadingId}
                          docId={doc.id}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        image={Icons.successCircle}
        show={showSuccess}
        handleClose={() => setShowSuccess(false)}
        header={'Query Submitted'}
        subHeader={'Your query has been submitted. Our support team will contact you shortly.'}
      />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--danger-light)' }}
        image={Icons.danger}
        show={!!showError}
        handleClose={() => setShowError('')}
        header={'Submission Failed'}
        subHeader={showError}
      />
    </Layout>
  );
};

export default Support;
