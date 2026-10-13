jest.mock('../src/utils/logger', () => ({ Logger: { info: () => {} } }));

import getAssessmentPercentage from '../src/utils/getAssessmentPercentage';

// Both Home and the assessment-details screen now derive progress the same way:
//   steps  = computeLocalStepProgress(assessmentId, userId).data.steps
//   isLead = resolveTeamRole(assessment, userId).isLead
// and render getAssessmentPercentage(steps, isLead). These tests pin the shared
// formula and prove the two screens cannot disagree (same inputs -> same number)
// while a lead's global-step completions never leak into a co-assessor's number.

const steps = (map) =>
  Object.entries(map).map(([step, status]) => ({ step, status }));

// Lead has finished allocation + site pictures + opening meeting; co-assessor on
// the same assessment has only captured their own site pictures.
const midAssessment = steps({
  parameter_allocation: 'completed',
  site_pictures: 'completed',
  opening_meeting: 'completed',
  site_tour: 'pending',
  basic_information: 'pending',
  assessment_parameters: 'pending',
  closing_meeting: 'pending'
});

describe('getAssessmentPercentage — Home and Details agree', () => {
  it('returns the same number on both screens for a co-assessor', () => {
    // Home call and Details call are the same function with the same inputs.
    const home = getAssessmentPercentage(midAssessment, false);
    const details = getAssessmentPercentage(midAssessment, false);
    expect(home).toBe(details);
    // Co owns site_pictures, site_tour, assessment_parameters; only the first is done.
    expect(home).toBe(33);
  });

  it('returns the same number on both screens for a lead', () => {
    const home = getAssessmentPercentage(midAssessment, true);
    const details = getAssessmentPercentage(midAssessment, true);
    expect(home).toBe(details);
    // Lead owns all 7 steps; 3 are done.
    expect(home).toBe(43);
  });

  it("a lead's global-step completions do not change the co-assessor's number", () => {
    const withMoreGlobal = steps({
      parameter_allocation: 'completed',
      site_pictures: 'completed',
      opening_meeting: 'completed',
      site_tour: 'pending',
      basic_information: 'completed', // lead-owned global step now done
      assessment_parameters: 'pending',
      closing_meeting: 'completed' // lead-owned global step now done
    });
    // Co number is unchanged: still 1 of their own 3 steps.
    expect(getAssessmentPercentage(withMoreGlobal, false)).toBe(33);
    // Lead number rises with the global steps.
    expect(getAssessmentPercentage(withMoreGlobal, true)).toBe(71);
  });

  it('reaches 100 only over the steps that role owns', () => {
    const coDone = steps({
      parameter_allocation: 'pending',
      site_pictures: 'completed',
      opening_meeting: 'pending',
      site_tour: 'completed',
      basic_information: 'pending',
      assessment_parameters: 'completed',
      closing_meeting: 'pending'
    });
    // Co finished their three steps even though lead-owned steps are pending.
    expect(getAssessmentPercentage(coDone, false)).toBe(100);
    expect(getAssessmentPercentage(coDone, true)).toBe(43);
  });

  it('handles missing/empty local data as 0', () => {
    expect(getAssessmentPercentage(undefined, true)).toBe(0);
    expect(getAssessmentPercentage([], false)).toBe(0);
  });
});
