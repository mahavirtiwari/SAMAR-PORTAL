// Steps each role is responsible for. A co-assessor's progress completes on
// their own three steps; the lead's covers the full assessment.
const LEAD_STEPS = [
  'parameter_allocation',
  'site_pictures',
  'opening_meeting',
  'site_tour',
  'basic_information',
  'assessment_parameters',
  'closing_meeting'
];
const CO_ASSESSOR_STEPS = ['site_pictures', 'site_tour', 'assessment_parameters'];

// Single progress formula shared by Home and the assessment details screen, so
// both show the same number from the same local data. `steps` is the array
// computeLocalStepProgress returns ([{ step, status }]); `isLead` scopes the
// denominator to the steps that role actually owns.
const getAssessmentPercentage = (steps, isLead) => {
  if (!Array.isArray(steps)) {
    return 0;
  }
  const stepKeys = isLead ? LEAD_STEPS : CO_ASSESSOR_STEPS;
  const completedKeys = new Set(steps.filter((s) => s?.status === 'completed').map((s) => s?.step));
  const completedSteps = stepKeys.filter((key) => completedKeys.has(key)).length;
  const percentage = Math.round((completedSteps / stepKeys.length) * 100);
  return percentage;
};
export default getAssessmentPercentage;
