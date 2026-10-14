import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import { useFormik } from 'formik';
import PropTypes from 'prop-types';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as yup from 'yup';
import Icons from '../../constants/Icons';
import { getAssessorsAction, scheduleAssessmentAction } from '../../redux/action/common/AssessmentAction';
import { resetAssessmentState } from '../../redux/slices/common/AssessmentSlice';
import Api from '../../services/api';
import { getAssessmentDurationDays } from '../../utils/assessmentDuration';
import { formatDate } from '../../utils/formatters';
import { AppButton, AppDropdown, AppInput, AppModal, AppMultiSelectDropdown } from '../base';
import AppDatePicker from '../base/AppDatePicker';
import { toastError } from '../base/toast';
import AppCommonModal from './AppCommonModal';

dayjs.extend(isSameOrAfter);

function OperationScheduleAssessmentModal({ open, onClose, assessmentId = null, applicationData = null, onSuccess = null, editData = null }) {
  const dispatch = useDispatch();
  const [cofirmationModal, setcofirmationModal] = useState(false);
  const [pendingLeadAssessor, setPendingLeadAssessor] = useState(null);
  // Redux state
  const { assessors, assessorsLoading, scheduleLoading, scheduledAssessment, assessment } = useSelector(state => state.Assessment);

  // Mandatory/optional parameter counts for this assessment (from backend snapshot)
  const assessmentData = assessment?.data?.assessment || assessment?.assessment || assessment;
  const parametersSummary = assessmentData?.parametersSummary;

  // Meeting link is a service-sector-only scheduling field (online assessments).
  const isService = applicationData?.sector === 'service';

  // The unit's state is the sole assessor-eligibility gate at scheduling (mirrors the
  // backend allocate() guard). Without it the assessor list can't be filtered, so
  // scheduling is blocked until the unit state is on record.
  const hasUnitState = Boolean(applicationData?.unitState);

  // Form states
  // Form states will be managed by formik
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Off-time (unavailability) ranges keyed by assessor id. Temporary client-side
  // availability filter: the backend assessor list does not yet exclude off-time
  // assessors for the selected dates, so we cross-reference /off-times here.
  // Remove once the backend /users assessor query filters by scheduledStartDate/End.
  const [offTimesByAssessor, setOffTimesByAssessor] = useState({});

  // Fetch assessors when modal opens — filter by the application's unit state
  useEffect(() => {
    if (open) {
      const queryParams = {
        role: 'assessor',
        status: 'active',
      };
      if (applicationData?.unitState) {
        queryParams.assignedState = applicationData.unitState;
      }
      dispatch(getAssessorsAction(queryParams));
    }
  }, [open, dispatch, applicationData?.unitState]);

  // Fetch the in-scope assessors' off-times once when the list loads, so the
  // selected date range can be cross-referenced locally without refetching per change.
  // One batched call, not one per assessor: the per-assessor version exhausted the
  // user's request allowance on a large list and the server then refused their
  // unrelated requests for the rest of the minute. [BUG-08860]
  useEffect(() => {
    if (!open) {
      setOffTimesByAssessor({});
      return undefined;
    }
    const list = assessors || [];
    if (!list.length) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const byAssessor = await Api.AssessorOffTime.getOffTimesForAssessors(list.map(user => user.id));
        if (!cancelled) {
          setOffTimesByAssessor(byAssessor);
        }
      } catch {
        // An unavailable off-time list must not block scheduling, so everyone stays
        // selectable. But say so: with one batched call a single failure blanks the
        // whole list, where the old per-assessor version lost only the assessor whose
        // own call failed. Silently implying every assessor is free is the one thing
        // this availability check exists to prevent.
        if (!cancelled) {
          setOffTimesByAssessor({});
          toastError('Could not load assessor availability. Please check off-time manually before scheduling.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, assessors]);

  // Normalized selected lead assessor id for comparisons in options and submission
  // Normalized selected lead assessor id for comparisons in options and submission

  // Handle successful scheduling
  useEffect(() => {
    if (scheduledAssessment && !scheduleLoading) {
      setShowSuccessModal(true);
      onClose();
      setTimeout(() => {
        setShowSuccessModal(false);
        onSuccess && onSuccess(editData);
      }, 3000);
      dispatch(resetAssessmentState());
    }
  }, [scheduledAssessment, scheduleLoading]);

  // Transform assessors data for dropdown (memoized to avoid re-creating on each render)
  const assessorOptions = useMemo(() => {
    const list = (assessors || []).slice().sort((a, b) => {
      const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
      const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
      if (nameA < nameB) {
        return -1;
      }
      if (nameA > nameB) {
        return 1;
      }
      return 0;
    });

    return list.map(user => ({
      id: user.id,
      initials: `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase(),
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      phone: user.mobileNumber || '',
      description: Array.isArray(user.assessorDomains)
        ? user.assessorDomains
            .map(d => d?.domainName || d?.name)
            .filter(Boolean)
            .join(', ')
        : '',
      role: user.assessorDomains?.[0]?.name || user.designation || 'Assessor',
      location: user.assignedStates?.length ? user.assignedStates.join(', ') : user.city || user.state || '',
      status: user.status === 'active' ? 'Available' : 'Unavailable',
      statusColor: user.status === 'active' ? 'green' : 'red',
      avatar: user.profilePicture || null,
    }));
  }, [assessors]);

  // Options for dropdowns
  // For co-assessors we want to use names as the option values (memoized)
  const coOptions = useMemo(() => (assessorOptions || []).map(a => ({ value: a.name, label: a.name, id: a.id, phone: a.phone, description: a.description })), [assessorOptions]);

  // Helper to normalize date-like values
  const parseToDate = v => {
    if (!v && v !== 0) {
      return null;
    }
    if (v instanceof Date) {
      return v;
    }
    if (dayjs.isDayjs && dayjs.isDayjs(v)) {
      return v.toDate();
    }
    if (typeof v === 'number') {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof v === 'string') {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  const validationSchema = yup.object().shape({
    startDate: yup
      .date()
      .transform((value, originalValue) => parseToDate(originalValue))
      .typeError('Select an assessment start date')
      .required('Select an assessment start date')
      .test('is-today-or-after', 'Scheduled start date must be today or a future date', value => {
        if (!value) {
          return false;
        }
        // allow start date to be today or in the future
        const todayStart = dayjs().startOf('day');
        return dayjs(value).isSameOrAfter(todayStart, 'day');
      }),
    endDate: yup
      .date()
      .transform((value, originalValue) => parseToDate(originalValue))
      .typeError('Select an assessment end date')
      .required('Select an assessment end date')
      .when('startDate', (startDateVal, schema) =>
        startDateVal
          ? schema.test('is-after-start', 'End date must be same or after start date', endVal => {
              if (!endVal || !startDateVal) {
                return false;
              }
              return dayjs(endVal).isSameOrAfter(dayjs(startDateVal), 'day');
            })
          : schema,
      ),

    leadAssessor: yup.mixed().required('lead Assessor is required'),

    coAssessors: yup.array(),

    meetingLink: isService
      ? yup.string().trim().required('Meeting link is required').max(2048, 'Meeting link is too long').url('Enter a valid meeting link (https://...)')
      : yup
          .string()
          .trim()
          .max(2048, 'Meeting link is too long')
          .url('Enter a valid meeting link (https://...)')
          .nullable()
          .transform((value, originalValue) => (originalValue === '' ? null : value)),
  });

  const formik = useFormik({
    initialValues: { startDate: null, endDate: null, leadAssessor: null, coAssessors: [], meetingLink: '' },
    validationSchema,
    onSubmit: async values => {
      const normalizeId = id => {
        if (id === null || id === undefined) {
          return id;
        }
        const s = String(id);
        return /^\d+$/.test(s) ? Number(s) : id;
      };

      const leadAssessorId = normalizeId(values.leadAssessor);

      const teamAssessorIds = (values.coAssessors || [])
        .map(v => {
          const matchedById = assessorOptions.find(a => String(a.id) === String(v));
          if (matchedById) {
            return normalizeId(matchedById.id);
          }
          const matched = assessorOptions.find(a => String(a.name) === String(v));
          return matched ? normalizeId(matched.id) : null;
        })
        .filter(id => id && id !== leadAssessorId)
        .filter((id, idx, arr) => arr.indexOf(id) === idx);

      const data = {
        leadAssessorId,
        teamAssessorIds,
        scheduledStartDate: dayjs(parseToDate(values.startDate)).format('YYYY-MM-DD'),
        scheduledEndDate: dayjs(parseToDate(values.endDate)).format('YYYY-MM-DD'),
        ...(isService ? { meetingLink: values.meetingLink?.trim() || null } : {}),
      };

      try {
        await dispatch(scheduleAssessmentAction({ assessmentId, data })).unwrap();
      } catch (error) {
        // Surface any API error to the user via toast. The rejected payload is the
        // backend response body (Laravel: { message, errors }) or a plain string.
        const firstFieldError = error?.errors && typeof error.errors === 'object' ? error.errors[Object.keys(error.errors)[0]]?.[0] : null;
        const message = firstFieldError || error?.message || (typeof error === 'string' ? error : '') || 'Failed to schedule assessment. Please try again.';
        toastError(message);
      }
    },
    validateOnChange: false,
    validateOnBlur: false,
  });

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      formik.resetForm();
      dispatch(resetAssessmentState());
    }
  }, [open, dispatch]);

  // Assessors whose off-time overlaps the selected date range (inclusive).
  // Empty until both dates are chosen — availability can't be judged without them.
  const unavailableAssessorIds = useMemo(() => {
    const start = parseToDate(formik.values.startDate);
    const end = parseToDate(formik.values.endDate);
    if (!start || !end) {
      return new Set();
    }
    const selStart = dayjs(start);
    const selEnd = dayjs(end);
    const ids = new Set();
    Object.entries(offTimesByAssessor).forEach(([assessorId, ranges]) => {
      const conflict = (ranges || []).some(r => !dayjs(r.toDate).isBefore(selStart, 'day') && !dayjs(r.fromDate).isAfter(selEnd, 'day'));
      if (conflict) {
        ids.add(String(assessorId));
      }
    });
    return ids;
  }, [offTimesByAssessor, formik.values.startDate, formik.values.endDate]);

  // Drop any already-selected assessor that becomes unavailable for the chosen
  // dates, so an off-time assessor can't be submitted.
  useEffect(() => {
    if (!unavailableAssessorIds.size) {
      return;
    }
    if (formik.values.leadAssessor && unavailableAssessorIds.has(String(formik.values.leadAssessor))) {
      formik.setFieldValue('leadAssessor', null);
    }
    const cos = Array.isArray(formik.values.coAssessors) ? formik.values.coAssessors : [];
    if (cos.length) {
      const stillAvailable = cos.filter(co => {
        const match = assessorOptions.find(a => String(a.name) === String(co) || String(a.id) === String(co));
        return !(match && unavailableAssessorIds.has(String(match.id)));
      });
      if (stillAvailable.length !== cos.length) {
        formik.setFieldValue('coAssessors', stillAvailable);
      }
    }
  }, [unavailableAssessorIds]);

  // Prefill form when editData is provided (e.g., editing an existing schedule)
  useEffect(() => {
    if (!(open && typeof editData === 'object' && editData)) {
      return;
    }

    if (editData.scheduledStartDate) {
      formik.setFieldValue('startDate', parseToDate(editData.scheduledStartDate));
    }
    if (editData.scheduledEndDate) {
      formik.setFieldValue('endDate', parseToDate(editData.scheduledEndDate));
    }
    if (editData.leadAssessor) {
      formik.setFieldValue('leadAssessor', editData.leadAssessor.id);
    }
    if (editData.meetingLink) {
      formik.setFieldValue('meetingLink', editData.meetingLink);
    }

    if (Array.isArray(editData.coAssessors) && editData.coAssessors.length && assessorOptions && assessorOptions.length) {
      formik.setFieldValue(
        'coAssessors',
        editData.coAssessors.map(item => {
          if (!item) {
            return '';
          }
          // item may be an object {id, name} or an id/string
          const itemId = typeof item === 'object' ? item.id : item;
          const itemName = typeof item === 'object' ? item.name : null;
          const found = assessorOptions.find(a => String(a.id) === String(itemId) || (itemName && String(a.name) === String(itemName)));
          return found ? found.name : itemName || String(itemId);
        }),
      );
    }
  }, [open, editData, assessorOptions]);

  // replace old validate/submit with formik's submit handler
  const handleSchedule = () => {
    formik.submitForm();
  };

  const handleSuccessClose = () => {
    formik.setFieldValue('startDate', null);
    formik.setFieldValue('endDate', null);
    formik.setFieldValue('leadAssessor', null);
    formik.setFieldValue('coAssessors', []);
    formik.setFieldValue('meetingLink', '');
    dispatch(resetAssessmentState());
    onClose();
    if (onSuccess) {
      onSuccess();
    }
  };

  // Handle modal close
  const handleClose = () => {
    dispatch(resetAssessmentState());
    onClose();
  };

  const handleCloseCofirmationModal = () => {
    setcofirmationModal(false);
    setPendingLeadAssessor(null);
  };

  const handleConfirmCofirmationModal = () => {
    if (pendingLeadAssessor) {
      const { val, selectedName } = pendingLeadAssessor;
      const currentCoNames = Array.isArray(formik.values.coAssessors) ? formik.values.coAssessors.map(String) : [];

      // Remove from coAssessors
      const updatedCo = currentCoNames.filter(n => n !== String(selectedName));
      formik.setFieldValue('coAssessors', updatedCo);

      // Update Lead Assessor
      formik.setFieldValue('leadAssessor', val);
      // We need to set touched to true so validation runs if needed, but here we are setting a valid value mostly.
      formik.setFieldTouched('leadAssessor', true, false);
      if (val !== null && val !== undefined && String(val) !== '') {
        formik.setFieldError('leadAssessor', '');
      }
    }
    handleCloseCofirmationModal();
  };

  // formik values (used for debugging when needed)
  // Modal content
  const modalContent = (
    <>
      {!hasUnitState && (
        <div className="parameter-top-card mb-20" style={{ background: 'var(--warning-light)' }}>
          <div className="fs-13 fw-500 heading-color">This application has no unit state on record, so eligible assessors can&apos;t be determined. Set the unit state before scheduling.</div>
        </div>
      )}
      {/* Top Card - Application Info */}
      <div className="parameter-top-card mb-30">
        <div className="row">
          <div className="col-12 col-md-6">
            <div className="fs-12 fw-500 text-3-color">Unit Location</div>
            <div className="fs-14 fw-500 heading-color">
              {applicationData?.unitAddress}, {applicationData?.unitDistrict}, {applicationData?.unitState}
            </div>
          </div>
          <div className="col-12 col-md-6">
            <div className="fs-12 fw-500 text-3-color">Preferred Assessment Date</div>
            <div className="fs-14 fw-500 heading-color">{applicationData?.preferredAssessmentDate ? formatDate(applicationData?.preferredAssessmentDate) : 'Not specified'}</div>
          </div>
          {parametersSummary && (
            <>
              <div className="col-12 col-md-6 mt-3">
                <div className="fs-12 fw-500 text-3-color">Mandatory Parameters</div>
                <div className="fs-14 fw-500 heading-color">{parametersSummary.mandatory}</div>
              </div>
              <div className="col-12 col-md-6 mt-3">
                <div className="fs-12 fw-500 text-3-color">Optional Parameters</div>
                <div className="fs-14 fw-500 heading-color">{parametersSummary.optional}</div>
              </div>
            </>
          )}
        </div>
      </div>
      {/* Input Section */}
      <div className="row margin-top-24 gap-vertical-24">
        <div className="col-md-6">
          <AppDatePicker
            label="Assessment Start Date"
            placeholder="Select date"
            value={formik.values.startDate}
            onBlur={formik.handleBlur}
            onChange={val => {
              formik.setFieldValue('startDate', val);
              formik.setFieldTouched('startDate', true, false);
              if (val) {
                formik.setFieldError('startDate', '');
                // Auto-fill the end date from the enterprise classification to cut
                // manual error. The field stays editable, so the user can override.
                const durationDays = getAssessmentDurationDays(applicationData?.sector, applicationData?.enterpriseClassification);
                if (durationDays) {
                  const autoEndDate = dayjs(parseToDate(val))
                    .add(durationDays - 1, 'day')
                    .toDate();
                  formik.setFieldValue('endDate', autoEndDate);
                  formik.setFieldTouched('endDate', true, false);
                  formik.setFieldError('endDate', '');
                }
              } else {
                formik.validateField('startDate');
              }
            }}
            isRequired
            minDate={new Date(new Date())}
            error={formik.errors.startDate && formik.touched.startDate ? formik.errors.startDate : ''}
          />
        </div>

        <div className="col-md-6">
          <AppDatePicker
            label="Assessment End Date"
            placeholder="Select date"
            onBlur={formik.handleBlur}
            value={formik.values.endDate}
            onChange={val => {
              formik.setFieldValue('endDate', val);
              formik.setFieldTouched('endDate', true, false);
              if (val) {
                formik.setFieldError('endDate', '');
              } else {
                formik.validateField('endDate');
              }
            }}
            isRequired
            minDate={formik.values.startDate ? dayjs(parseToDate(formik.values.startDate)).toDate() : new Date(new Date())}
            error={formik.errors.endDate && formik.touched.endDate ? formik.errors.endDate : ''}
          />
        </div>

        <div className="col-md-12">
          <AppDropdown
            name="leadAssessor"
            label="Lead Assessor"
            isRequired={true}
            richOptions
            options={
              assessorOptions
                ?.filter(assessor => !(formik.values.coAssessors || []).map(String).includes(String(assessor.id)) && !unavailableAssessorIds.has(String(assessor.id)))
                .map(assessor => ({ value: assessor.id, label: assessor.name, phone: assessor.phone, description: assessor.description })) || []
            }
            placeholder={assessorsLoading ? 'Loading assessors...' : 'Select Lead Assessor'}
            disabled={assessorsLoading}
            onChange={e => {
              const val = e && e.target ? e.target.value : e;
              // Resolve selected assessor object
              const selected = assessorOptions.find(a => String(a.id) === String(val));
              const selectedName = selected ? selected.name : null;

              // If selected assessor is present in coAssessors (stored as names), confirm removal
              const currentCoNames = Array.isArray(formik.values.coAssessors) ? formik.values.coAssessors.map(String) : [];
              if (selectedName && currentCoNames.includes(String(selectedName))) {
                setPendingLeadAssessor({ val: val, selectedName });
                setcofirmationModal(true);
                return;
              }

              formik.setFieldValue('leadAssessor', val);
              formik.setFieldTouched('leadAssessor', true, false);
              if (val !== null && val !== undefined && String(val) !== '') {
                formik.setFieldError('leadAssessor', '');
              } else {
                formik.validateField('leadAssessor');
              }
            }}
            onBlur={formik.handleBlur}
            value={formik.values.leadAssessor}
            error={formik.touched.leadAssessor && formik.errors.leadAssessor ? formik.errors.leadAssessor : ''}
          />
        </div>
        <AppMultiSelectDropdown
          richOptions
          // Service applications are assessed by the Lead Assessor only — no co-assessors.
          disabled={isService}
          subLabel={isService ? 'Not applicable for service applications (Lead Assessor only)' : 'Select one or multiple co-assessors (optional)'}
          label="Co-Assessors"
          // Use co-assessor names as option values so they match Formik's coAssessors (which store names for display)
          options={coOptions
            .filter(opt => String(opt.id) !== String(formik.values.leadAssessor))
            .filter(opt => !unavailableAssessorIds.has(String(opt.id)))
            .map(opt => ({ value: opt.value, label: opt.label, id: opt.id, phone: opt.phone, description: opt.description }))}
          value={Array.isArray(formik.values.coAssessors) ? formik.values.coAssessors.map(String) : []}
          chipMode={true}
          onChange={value => {
            const mapped = (Array.isArray(value) ? value : []).map(v => (typeof v === 'string' || typeof v === 'number' ? v : v.value || v.label || ''));
            formik.setFieldValue('coAssessors', mapped);
            formik.setFieldTouched('coAssessors', true, false);
            if (Array.isArray(mapped) && mapped.length > 0) {
              formik.setFieldError('coAssessors', '');
            } else {
              formik.validateField('coAssessors');
            }
          }}
          onBlur={formik.handleBlur}
          placeholder="Select Co-Assessor(s)"
          name="coAssessors"
          isRequired={false}
          error={formik.touched.coAssessors && formik.errors.coAssessors ? formik.errors.coAssessors : ''}
        />
        {isService && (
          <div className="col-md-12">
            <AppInput
              name="meetingLink"
              label="Meeting Link"
              isRequired={true}
              placeholder="https://meet.google.com/..."
              subLabel="Shown to the applicant and assessors for the online assessment"
              maxLength={2048}
              value={formik.values.meetingLink}
              onChange={e => {
                formik.setFieldValue('meetingLink', e.target.value);
                formik.setFieldError('meetingLink', '');
              }}
              onBlur={formik.handleBlur}
              error={formik.touched.meetingLink && formik.errors.meetingLink ? formik.errors.meetingLink : ''}
            />
          </div>
        )}
      </div>
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--warning-light)' }}
        image={Icons.warningIcon}
        show={cofirmationModal}
        handleClose={handleCloseCofirmationModal}
        header="Change Assessor Role"
        subHeader={`${pendingLeadAssessor?.selectedName} is already assigned as Co-Assessor. Assigning them as Lead will remove them from the Co-Assessor list. Proceed with the update?`}
        twoButtons
        leftButton="Cancel"
        leftButtonClassName="w-100 tertiary"
        leftButtonOnClick={handleCloseCofirmationModal}
        rightButton={'Proceed'}
        rightButtonClassName="w-100 primary"
        rightButtonOnClick={handleConfirmCofirmationModal}
      />
    </>
  );

  // Modal footer
  const modalFooter = (
    <>
      <AppButton variant="tertiary" size="medium" title="Cancel" onClick={handleClose} disabled={scheduleLoading} />
      <AppButton
        variant="primary"
        size="medium"
        title={editData ? 'Update Schedule' : 'Schedule Assessment'}
        onClick={handleSchedule}
        disabled={scheduleLoading || !hasUnitState}
        loading={scheduleLoading}
      />
    </>
  );

  return (
    <>
      <AppCommonModal
        open={open}
        onClose={handleClose}
        modalHeader={editData ? 'Update Schedule' : 'Schedule Assessment'}
        modalContent={modalContent}
        modalFooter={modalFooter}
        paperSx={{
          width: { xs: 'calc(100% - 16px)', sm: '90%', md: '800px', lg: '700px' },
          maxWidth: '98vw',
          margin: { xs: 1, sm: 2, md: 3 },
        }}
      />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        image={Icons.successCircle}
        show={showSuccessModal}
        handleClose={handleSuccessClose}
        header="Assessment scheduled successfully"
        subHeader="The applicant and assessors have been notified."
      />
    </>
  );
}

OperationScheduleAssessmentModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  assessmentId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  applicationData: PropTypes.object,
  onSuccess: PropTypes.func,
  editData: PropTypes.object,
};

export default OperationScheduleAssessmentModal;
