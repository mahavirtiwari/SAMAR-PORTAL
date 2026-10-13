import { useEffect, useMemo, useState } from 'react';
import Icons from '../../constants/Icons';
import { findMyTeamMember } from '../../utils/assessmentExecution';
import { hasRole } from '../../utils/roleUtils';
import { AppAvatar, AppButton } from '../base';
import AppCommonModal from './AppCommonModal';
import AppModal from './AppModal';

const memberName = member => {
  const u = member?.user || {};
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || member?.name || `Member #${member?.id}`;
};

const roleLabel = role => (role === 'lead_assessor' ? 'Lead Assessor' : role === 'co_assessor' ? 'Co Assessor' : 'Assessor');

const AllocatedParametersModal = ({ open, onClose, user, myAssignedParameterCount, mandatoryParameters = [], optionalParameters = [], teamMembers = [], loading = false, onAllocate }) => {
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'Assessor';

  const userPhoto = user?.profilePicture || user?.profile_picture || user?.profileImage || user?.profile_image || user?.avatar;

  const userLabel = hasRole(user, 'assessor') ? 'Lead Assessor' : 'Assessor';

  // Allocation is one-shot: parameters already assigned to this user cannot be re-allocated
  const alreadyAllocated = Number(myAssignedParameterCount) > 0;

  const [showConfirm, setShowConfirm] = useState(false);
  useEffect(() => {
    if (!open) {
      setShowConfirm(false);
    }
  }, [open]);
  const [selectedOptionalParameters, setSelectedOptionalParameters] = useState(optionalParameters.filter(param => param?.assignedToTeamMemberId).map(param => param.id));

  useEffect(() => {
    setSelectedOptionalParameters(optionalParameters.filter(param => param?.assignedToTeamMemberId).map(param => param.id));
  }, [optionalParameters]);

  // Before saving, every mandatory parameter goes to this assessor and the optional
  // ones they tick join them, so the badge previews the total they are about to take.
  const assignedCount = alreadyAllocated ? Number(myAssignedParameterCount) : mandatoryParameters.length + selectedOptionalParameters.length;
  const handleOptionalSelect = parameterId => {
    if (alreadyAllocated || loading) {
      return;
    }
    setSelectedOptionalParameters(prev => (prev.includes(parameterId) ? prev.filter(id => id !== parameterId) : [...prev, parameterId]));
  };
  const _memberOptions = useMemo(
    () =>
      teamMembers.map(member => ({
        value: member.id,
        label: `${memberName(member)} (${roleLabel(member.role)})`,
      })),
    [teamMembers],
  );

  const [_assignments, setAssignments] = useState({});

  useEffect(() => {
    const seed = {};

    [...mandatoryParameters, ...optionalParameters].forEach(param => {
      if (param.assignedToTeamMemberId) {
        seed[param.id] = param.assignedToTeamMemberId;
      }
    });

    setAssignments(seed);
  }, [mandatoryParameters, optionalParameters]);

  const _handleAssign = (parameterId, teamMemberId) => {
    setAssignments(prev => ({
      ...prev,
      [parameterId]: Number(teamMemberId),
    }));
  };

  const handleSave = () => {
    // The API's teamMemberId is the membership row id, not the user id — sending
    // user.id allocates against the wrong id space (or the wrong assessor).
    const myTeamMemberId = findMyTeamMember(teamMembers, user?.id)?.id;
    if (!myTeamMemberId) {
      return;
    }

    const mandatoryAssignments = mandatoryParameters.map(parameter => ({
      parameterId: Number(parameter.id),
      teamMemberId: Number(myTeamMemberId),
    }));

    const optionalAssignments = selectedOptionalParameters.map(parameterId => ({
      parameterId: Number(parameterId),
      teamMemberId: Number(myTeamMemberId),
    }));

    const payload = {
      assignments: [...mandatoryAssignments, ...optionalAssignments],
      skipOptionalUnassigned: false,
    };

    onAllocate?.(payload);
  };

  const renderParameterRow = (parameter, index, parameters, isMandatory = false) => {
    return (
      <div
        key={parameter.id}
        className="d-flex align-items-center justify-content-between"
        style={{
          gap: 16,
          marginBottom: index === parameters.length - 1 ? 0 : 14,
        }}>
        <div className="d-flex align-items-center" style={{ gap: 10, flex: 1 }}>
          <div className="fw-600 text-5-color" style={{ fontSize: 14 }}>
            {String(index + 1).padStart(2, '0')}
          </div>

          <div>
            <div className="fw-500 heading-color" style={{ fontSize: 14 }}>
              {parameter.name || parameter.title}
            </div>

            <div className="text-3-color" style={{ fontSize: 12 }}>
              {isMandatory ? 'Mandatory' : 'Optional'}
            </div>
          </div>
        </div>

        {isMandatory ? (
          <img
            src={Icons.roundTick}
            alt="selected"
            style={{
              width: 22,
              height: 22,
            }}
          />
        ) : (
          <div
            onClick={() => handleOptionalSelect(parameter.id)}
            style={{
              width: 22,
              height: 22,
              minWidth: 22,
              minHeight: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: alreadyAllocated || loading ? 'not-allowed' : 'pointer',
              borderRadius: 6,
              border: selectedOptionalParameters.includes(parameter.id) ? '1px solid transparent' : '1px solid var(--outline)',
              backgroundColor: selectedOptionalParameters.includes(parameter.id) ? 'rgba(61, 139, 253, 0.08)' : 'transparent',
            }}>
            <img
              src={selectedOptionalParameters.includes(parameter.id) ? Icons.roundTick : Icons.uncheck}
              alt={selectedOptionalParameters.includes(parameter.id) ? 'selected' : 'unselected'}
              style={{
                width: 22,
                height: 22,
              }}
            />
          </div>
        )}
      </div>
    );
  };
  return (
    <>
      <AppCommonModal
        open={open}
        onClose={onClose}
        modalHeader={<h3 className="fs-18 fw-700 heading-color mb-0">Select Parameters</h3>}
        modalContent={
          <div>
            <div
              className="d-flex align-items-center justify-content-between"
              style={{
                padding: '24px',
                border: '1px solid var(--outline)',
                borderRadius: '10px',
              }}>
              <div className="d-flex align-items-center" style={{ gap: 10 }}>
                <AppAvatar src={userPhoto} alt={userName} size="36" role="Lead Assessor" />

                <div>
                  <div className="fw-500 text-1-color" style={{ fontSize: 16 }}>
                    {userName}
                  </div>

                  <div className="fw-400 text-2-color" style={{ fontSize: 14 }}>
                    {userLabel}
                  </div>
                </div>
              </div>

              <div
                className="d-inline-flex align-items-center"
                style={{
                  padding: '0 8px',
                  height: '22px',
                  border: '1px solid var(--warning-clarity)',
                  borderRadius: 8,
                  background: 'var(--warning-light)',
                  color: 'var(--warning-primary)',
                  whiteSpace: 'nowrap',
                }}>
                <span className="fw-600" style={{ fontSize: 10 }}>
                  {assignedCount} ASSIGNED
                </span>
              </div>
            </div>

            <div
              style={{
                borderTop: '1px solid var(--outline)',
                marginTop: 24,
                paddingTop: 24,
              }}>
              <div
                className="fw-600 heading-color"
                style={{
                  marginBottom: 16,
                  fontSize: 16,
                }}>
                Mandatory Parameters ({mandatoryParameters.length})
              </div>

              {mandatoryParameters.length === 0 ? (
                <div className="fs-13 fw-500 text-3-color">No mandatory parameters available</div>
              ) : (
                mandatoryParameters.map((parameter, index, parameters) => renderParameterRow(parameter, index, parameters, true))
              )}

              <div
                className="fw-600 heading-color"
                style={{
                  margin: '24px 0 16px',
                  fontSize: 16,
                }}>
                Optional Parameters ({optionalParameters.length})
              </div>

              {optionalParameters.length === 0 ? (
                <div className="fs-13 fw-500 text-3-color">No optional parameters available</div>
              ) : (
                optionalParameters.map((parameter, index, parameters) => renderParameterRow(parameter, index, parameters, false))
              )}
            </div>
          </div>
        }
        modalFooter={
          <div className="d-flex justify-content-end">
            <AppButton
              title={alreadyAllocated ? 'Parameters Allocated' : 'Allocate Parameter'}
              size="medium"
              variant="primary"
              minWidth={170}
              onClick={() => setShowConfirm(true)}
              disabled={loading || alreadyAllocated}
              loading={loading}
            />
          </div>
        }
        paperSx={{
          width: {
            xs: '100%',
            sm: '90%',
            md: '900px',
          },
          maxWidth: '98vw',
          margin: {
            xs: 1,
            sm: 2,
            md: 3,
          },
        }}
      />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--warning-light)' }}
        show={showConfirm}
        handleClose={() => setShowConfirm(false)}
        disableBackdropClick
        image={Icons.warningIcon}
        header="Save Allocation?"
        subHeader="Once saved, this allocation is locked and cannot be edited."
        twoButtons
        leftButton="Cancel"
        leftButtonClassName="tertiary medium"
        leftButtonOnClick={() => setShowConfirm(false)}
        rightButton="Confirm"
        rightButtonClassName="primary medium"
        rightButtonLoading={loading}
        rightButtonDisabled={loading}
        rightButtonOnClick={handleSave}
      />
    </>
  );
};

export default AllocatedParametersModal;
