/**
 * The Site Pictures and Site Tour steps must tick only on the assessor's OWN pictures,
 * because that is what the server requires before it lets them submit. Once an assessment
 * is seeded for offline viewing the local tables hold the whole team's pictures, so an
 * unscoped count ticked the step for a co-assessor who had captured none and submission
 * then refused them. [BUG-08929]
 */

jest.mock('../src/services/database/ids', () => ({
  idFromServer: (serverId) => `local-${serverId}`
}));

jest.mock('../src/services/database/repositories/assessmentsRepo', () => ({
  getSyncedServerSteps: jest.fn().mockResolvedValue({})
}));

const { executeSql } = require('../src/services/database/sqlUtils');

jest.mock('../src/services/database/sqlUtils', () => ({
  executeSql: jest.fn()
}));

const { computeLocalStepProgress } = require('../src/services/offline/computeStepProgress');

const CO_ASSESSOR_USER_ID = 269;
const LEAD_USER_ID = 266;

/**
 * Stands in for the local database. `pictures` is the site_pictures table as rows of
 * { owner_user_id }; every other query answers zero so only the step under test is
 * affected.
 */
const givenSitePictures = (pictures) => {
  executeSql.mockImplementation(async (sql, params) => {
    const rowsOf = (count) => ({ rows: { length: 1, item: () => ({ count }) } });

    if (!/FROM site_pictures/.test(sql)) {
      if (/FROM parameters/.test(sql)) {
        return { rows: { length: 0, item: () => null } };
      }
      return rowsOf(0);
    }

    // Mirror the predicate the query actually asks for: unscoped counts everything,
    // scoped counts rows with no owner or this user's own.
    if (/owner_user_id/.test(sql)) {
      const currentUserId = params[1];
      return rowsOf(
        pictures.filter((p) => p.owner_user_id == null || p.owner_user_id === currentUserId).length
      );
    }
    return rowsOf(pictures.length);
  });
};

const sitePicturesStep = async (currentUserId) => {
  const progress = await computeLocalStepProgress(1, currentUserId);
  return progress.data.steps.find((s) => s.step === 'site_pictures')?.status;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('site pictures step completeness', () => {
  it('does not tick for a co-assessor holding only the lead’s pictures', async () => {
    givenSitePictures([{ owner_user_id: LEAD_USER_ID }, { owner_user_id: LEAD_USER_ID }]);

    expect(await sitePicturesStep(CO_ASSESSOR_USER_ID)).not.toBe('completed');
  });

  it('ticks once the co-assessor has a picture of their own', async () => {
    givenSitePictures([{ owner_user_id: LEAD_USER_ID }, { owner_user_id: CO_ASSESSOR_USER_ID }]);

    expect(await sitePicturesStep(CO_ASSESSOR_USER_ID)).toBe('completed');
  });

  it('counts a picture with no recorded owner as this device’s own', async () => {
    // Captured locally, or written before the owner was recorded. Treating it as someone
    // else's would make an assessor's existing captures vanish from the tick on upgrade.
    givenSitePictures([{ owner_user_id: null }]);

    expect(await sitePicturesStep(CO_ASSESSOR_USER_ID)).toBe('completed');
  });

  it('falls back to counting everything when there is no current user', async () => {
    givenSitePictures([{ owner_user_id: LEAD_USER_ID }]);

    expect(await sitePicturesStep(null)).toBe('completed');
  });
});
