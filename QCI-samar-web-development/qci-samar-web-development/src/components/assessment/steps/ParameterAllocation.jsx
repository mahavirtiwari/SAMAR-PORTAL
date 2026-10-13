import { useEffect, useMemo, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { ASSESSMENT_STATUS } from '../../../constants/assessmentStatus';
import { bulkAssignParametersAction, getParametersAction, getStepProgressAction } from '../../../redux/action/common/ApplicationAssessmentAction';
import { getStepStatus, isMemberExecutionLocked, isServiceSector, resolveTeamRole, STEP_STATUS } from '../../../utils/assessmentExecution';
import { AppAssessmentParameter, AppButton, AppDropdown } from '../../base';

const memberName = member => {
  const u = member?.user || {};
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || member?.name || `Member #${member?.id}`;
};

const roleLabel = role => (role === 'lead_assessor' ? 'Lead Assessor' : role === 'co_assessor' ? 'Co Assessor' : 'Assessor');

const ParameterAllocation = ({ showStatusIcon = false, showCompletedNumbers = false, showQuestionNumbers = false, InProgress = false }) => {
  const dispatch = useDispatch();
  const { id } = useParams();
  const { user } = useSelector(state => state.Account);
  const { assessment } = useSelector(state => state.Assessment);
  const { parameters, parametersLoading, parametersError, stepProgress, bulkAssignLoading, bulkAssignError } = useSelector(state => state.ApplicationAssessment);

  const [assignments, setAssignments] = useState({});
  const [apiLocked, setApiLocked] = useState(false);

  const assessmentData = assessment?.data?.assessment || assessment?.assessment || assessment;

  useEffect(() => {
    if (id) {
      dispatch(getParametersAction(id));
    }
  }, [dispatch, id]);

  const mandatoryParams = useMemo(() => parameters?.mandatoryParameters || [], [parameters]);
  const optionalParams = useMemo(() => parameters?.optionalParameters || [], [parameters]);

  useEffect(() => {
    const seed = {};
    [...mandatoryParams, ...optionalParams].forEach(param => {
      if (param.assignedToTeamMemberId) {
        seed[param.id] = param.assignedToTeamMemberId;
      }
    });
    setAssignments(seed);
  }, [mandatoryParams, optionalParams]);

  const teamMembers = assessmentData?.teamMembers?.length ? assessmentData.teamMembers : parameters?.teamMembers || [];

  const allocationLocked = Boolean(
    apiLocked || parameters?.allocationLocked || assessmentData?.allocationLockedAt || assessmentData?.allocation_locked_at || getStepStatus(stepProgress, 'opening_meeting') === STEP_STATUS.COMPLETED,
  );

  const { isLead } = resolveTeamRole(assessmentData, user?.id);
  const editableStatus =
    assessmentData?.status === ASSESSMENT_STATUS.SCHEDULED || assessmentData?.status === ASSESSMENT_STATUS.IN_PROGRESS || assessmentData?.status === ASSESSMENT_STATUS.MOBILE_COMPLETE;
  const canEdit = isLead && isServiceSector(assessmentData) && editableStatus && !allocationLocked && !isMemberExecutionLocked(assessmentData, user?.id);

  const memberOptions = teamMembers.map(member => ({ value: member.id, label: `${memberName(member)} (${roleLabel(member.role)})` }));

  const missingMandatory = mandatoryParams.filter(param => !assignments[param.id]);
  const assignedMemberIds = new Set(Object.values(assignments).filter(Boolean).map(String));
  const membersWithoutParam = teamMembers.filter(member => !assignedMemberIds.has(String(member.id)));

  const validationMessages = [];
  if (missingMandatory.length) {
    validationMessages.push(`${missingMandatory.length} mandatory parameter${missingMandatory.length > 1 ? 's' : ''} still need an assignee.`);
  }
  if (membersWithoutParam.length) {
    validationMessages.push(`${membersWithoutParam.map(memberName).join(', ')} must be assigned at least one parameter.`);
  }
  const canSave = validationMessages.length === 0 && !bulkAssignLoading;

  const handleAssign = (parameterId, value) => setAssignments(prev => ({ ...prev, [parameterId]: value }));

  const handleSave = () => {
    const data = {
      assignments: Object.entries(assignments)
        .filter(([, teamMemberId]) => teamMemberId)
        .map(([parameterId, teamMemberId]) => ({ parameterId: Number(parameterId), teamMemberId: Number(teamMemberId) })),
      skipOptionalUnassigned: false,
    };
    dispatch(bulkAssignParametersAction({ assessmentId: id, data }))
      .unwrap()
      .then(() => {
        dispatch(getParametersAction(id));
        dispatch(getStepProgressAction(id));
      })
      .catch(err => {
        const code = err?.errors?.errorCode || err?.errors?.error_code;
        if (code === 'ALLOCATION_LOCKED' || /locked/i.test(err?.message || '')) {
          setApiLocked(true);
          dispatch(getParametersAction(id));
        }
      });
  };

  if (parametersLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (parametersError) {
    return (
      <div className="alert alert-danger" role="alert">
        Failed to load parameters: {parametersError?.message || 'Unknown error'}
      </div>
    );
  }

  if (canEdit) {
    const serverErrors = !apiLocked && Array.isArray(bulkAssignError?.errors) ? bulkAssignError.errors : [];

    const renderSection = (heading, params) =>
      params.length > 0 && (
        <div className="margin-bottom-24">
          <h5 className="fs-14 fw-600 heading-color margin-bottom-12">{heading}</h5>
          {params.map(param => (
            <div className="payment-allocation-container rowBetween margin-bottom-16" key={param.id}>
              <div className="lh-normal-18">
                <h4 className="fs-16 fw-500 heading-color margin-bottom-2">{param.name || param.title}</h4>
                <span className="fs-12 fw-500 text-3-color">{param.isMandatory ? 'Mandatory' : 'Optional'}</span>
              </div>
              <div style={{ minWidth: 240 }}>
                <AppDropdown
                  label="Assign to"
                  name={`param-${param.id}`}
                  searchable={false}
                  value={assignments[param.id] ?? ''}
                  onChange={e => handleAssign(param.id, e.target.value)}
                  options={memberOptions}
                />
              </div>
            </div>
          ))}
        </div>
      );

    return (
      <div>
        <div className="margin-bottom-16">
          <h4 className="fs-18 fw-600 heading-color mb-0">Parameter Allocation</h4>
          <p className="fs-12 fw-400 text-3-color mb-0">Assign every mandatory parameter and give each assessor at least one parameter.</p>
        </div>

        {renderSection('Mandatory Parameters', mandatoryParams)}
        {renderSection('Optional Parameters', optionalParams)}

        {validationMessages.length > 0 && (
          <div className="alert alert-warning" role="alert">
            {validationMessages.map(message => (
              <div className="fs-13 fw-500" key={message}>
                {message}
              </div>
            ))}
          </div>
        )}

        {serverErrors.length > 0 && (
          <div className="alert alert-danger" role="alert">
            {serverErrors.map(message => (
              <div className="fs-13 fw-500" key={message}>
                {message}
              </div>
            ))}
          </div>
        )}

        <div className="d-flex justify-content-end margin-top-16">
          <AppButton title="Save Allocation" onClick={handleSave} disabled={!canSave} loading={bulkAssignLoading} minWidth={180} />
        </div>
      </div>
    );
  }

  const parameterData = [...mandatoryParams, ...optionalParams].map(param => ({
    id: param.id,
    title: param.name || param.title,
    questionCount: param.questions?.length || param.questionCount || 0,
    completedCount: param.completedCount || 0,
    totalCount: param.questions?.length || param.totalCount || 0,
    assignee: param?.assignedTeamMember?.user?.firstName,
    assigneeRole: roleLabel(param.assignedTeamMember?.role),
    assignedToTeamMemberId: param.assignedToTeamMemberId,
    status: param.assignedToTeamMemberId ? 'assigned' : 'pending',
    isMandatory: param.isMandatory,
  }));

  const assignedParams = parameterData.filter(item => item.assignedToTeamMemberId);

  const lockedBadge = allocationLocked ? (
    <div className="d-flex align-items-center margin-bottom-16">
      <span className="fs-12 fw-500" style={{ background: 'var(--outline)', color: 'var(--text-2)', padding: '4px 12px', borderRadius: 'var(--radius-8)' }}>
        Allocation locked
      </span>
    </div>
  ) : null;

  if (assignedParams.length === 0) {
    return (
      <div>
        {lockedBadge}
        <div className="text-center py-5">
          <p className="text-muted">No parameters assigned yet</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {lockedBadge}
      {assignedParams.map(item => (
        <AppAssessmentParameter
          key={item.id}
          title={item.title}
          questionCount={item.questionCount}
          completedCount={item.completedCount}
          totalCount={item.totalCount}
          assignee={item.assignee}
          assigneeRole={item.assigneeRole}
          status={item.status}
          statusIcon={showStatusIcon}
          completedNumbers={showCompletedNumbers}
          questionNumbers={showQuestionNumbers}
          mandatory={item.isMandatory}
          InProgress={InProgress}
        />
      ))}
    </div>
  );
};

export default ParameterAllocation;
