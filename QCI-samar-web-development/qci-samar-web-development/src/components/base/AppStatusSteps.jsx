import PropTypes from 'prop-types';

export const defaultStatusSteps = [
  { label: 'Submitted', key: 'submitted' },
  { label: 'DRDO Approval', key: 'drdo_approval_pending' },
  { label: 'Payment', key: 'payment' },
  { label: 'In progress', key: 'inProgress' },
  { label: 'Certified', key: 'certified' },
];

const AppStatusSteps = ({ steps = defaultStatusSteps, data = null, stepStatesMap = null, stepDatesMap = null }) => {
  // Props: `steps` (array), `data` (object with optional `status` / `stepStates` / `stepStatesMap` / `stepDatesMap`), `stepStatesMap` (object), `stepDatesMap` (object)
  const providedStatus = data && typeof data.status === 'string' ? data.status : null;
  const providedStates = data && Array.isArray(data.stepStates) ? data.stepStates : null;
  const providedStatesMap = stepStatesMap || (data && data.stepStatesMap) || null;
  const providedDatesMap = stepDatesMap || (data && data.stepDatesMap) || null;
  const derivedIndex = typeof providedStatus === 'string' ? getActiveIndexFromStatus(providedStatus) : 0;

  // Compute final states array following rules:
  // - If `stepStatesMap` contains any 'active', use first active index: previous -> success, active -> active, after -> disabled.
  // - Else if `stepStatesMap` contains any 'success', use highest success index: if it's last index -> all success, else indices <= highest -> success, others disabled.
  // - Else fall back to providedStates array or derivedIndex logic.
  let finalStates = null;
  if (providedStatesMap) {
    const _keyToIndex = stepKey => steps.findIndex(s => s.key === stepKey);
    // find first active index in steps order
    let activeIdx = -1;
    for (let i = 0; i < steps.length; i++) {
      const k = steps[i].key;
      if (k && providedStatesMap[k] === 'active') {
        activeIdx = i;
        break;
      }
    }

    if (activeIdx !== -1) {
      finalStates = Array(steps.length).fill('disabled');
      for (let i = 0; i < activeIdx; i++) {
        finalStates[i] = 'success';
      }
      finalStates[activeIdx] = 'active';
    } else {
      // find highest success index
      let highestSuccess = -1;
      for (let i = 0; i < steps.length; i++) {
        const k = steps[i].key;
        if (k && providedStatesMap[k] === 'success') {
          highestSuccess = i;
        }
      }
      if (highestSuccess !== -1) {
        if (highestSuccess === steps.length - 1) {
          finalStates = Array(steps.length).fill('success');
        } else {
          finalStates = Array(steps.length).fill('disabled');
          for (let i = 0; i <= highestSuccess; i++) {
            finalStates[i] = 'success';
          }
        }
      }
    }
  }
  return (
    <div className="status-steps-wrapper">
      {steps.map((step, idx) => {
        // Determine state precedence: explicit `states` prop > derived from activeIndex
        let state = 'disabled';
        // precedence: finalStates (computed from stepStatesMap rules) > providedStatesMap/by-key > providedStates array > derivedIndex
        if (finalStates && typeof finalStates[idx] === 'string') {
          state = finalStates[idx];
        } else if (providedStatesMap && step.key && typeof providedStatesMap[step.key] === 'string') {
          state = providedStatesMap[step.key];
        } else if (Array.isArray(providedStates) && typeof providedStates[idx] === 'string') {
          state = providedStates[idx];
        } else {
          if (idx < derivedIndex) {
            state = 'success';
          }
          if (idx === derivedIndex) {
            state = 'active';
          }
        }

        const dateForStep = step.key && providedDatesMap && providedDatesMap[step.key] ? providedDatesMap[step.key] : null;
        return (
          <div className="status-step" key={step.key || idx}>
            <div className={`step-circle ${state}`}>{state === 'success' ? <span className="check">✓</span> : <span className="step-number"></span>}</div>
            <div className={`step-label ${state}`}>
              {step.label}
              <br />
              <span className="step-date">{state === 'success' ? dateForStep || '--' : '--'}</span>
            </div>
            {idx < steps.length - 1 && <div className={`step-connector ${state}`}></div>}
          </div>
        );
      })}
    </div>
  );
};

AppStatusSteps.propTypes = {
  steps: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      key: PropTypes.string,
    }),
  ).isRequired,
  data: PropTypes.object,
  stepStatesMap: PropTypes.object,
  stepDatesMap: PropTypes.object,
};

export const getActiveIndexFromStatus = status => {
  const s = (status || '').toString().toLowerCase();
  const map = {
    submitted: 0,
    'drdo approval': 1,
    drdoapproval: 1,
    drdo_approval: 1,
    drdo_approval_pending: 1,
    payment: 2,
    'in progress': 3,
    inprogress: 3,
    certified: 4,
  };
  return typeof map[s] === 'number' ? map[s] : 0;
};

export default AppStatusSteps;
