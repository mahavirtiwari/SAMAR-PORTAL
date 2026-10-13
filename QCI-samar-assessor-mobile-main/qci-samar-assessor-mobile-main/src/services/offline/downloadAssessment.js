import RNFS from 'react-native-fs';
import { Logger } from '../../utils/logger';
import Api from '../api';
import { idFromServer } from '../database/ids';
import {
  setSyncedServerSteps,
  upsertAssessmentFromServer
} from '../database/repositories/assessmentsRepo';
import {
  markBasicInformationSynced,
  upsertBasicInformation
} from '../database/repositories/basicInformationRepo';
import { cacheMasterData } from '../database/repositories/masterDataRepo';
import { replaceParametersForAssessment } from '../database/repositories/parametersRepo';
import {
  ensureQuestionRow,
  replaceQuestionsForAssessment
} from '../database/repositories/questionsRepo';
import { upsertSyncedResponseFromServer } from '../database/repositories/responsesRepo';
import {
  deleteSyncedOrphanSitePictures,
  deleteSyncedOrphanSiteTourPictures,
  upsertSyncedSitePicture,
  upsertSyncedSiteTourPicture
} from '../database/repositories/sitePicturesRepo';
import { getToken } from '../storage/authStore';

/**
 * Pull the global dropdown lists and any already-saved Basic Information into
 * local storage so the Basic Information form is fillable — and prior entries
 * visible — offline, even on a device that never opened those screens online
 * (e.g. a co-assessor). All best-effort: a failure here must not fail the
 * assessment download. Cache keys mirror what the basicInformation actions
 * read back on their offline fallback.
 */
const warmOfflineExtras = async (serverAssessmentId, localId) => {
  const cacheList = async (key, apiCall) => {
    try {
      const resp = await apiCall();
      await cacheMasterData(key, resp?.data);
    } catch (error) {
      Logger.warn(`[offline] master-data warm failed for ${key}:`, error?.message);
    }
  };

  await cacheList('vendor_categories', () => Api.BasicInformationApi.getCategory());
  await cacheList('stores', () => Api.BasicInformationApi.getStore());
  await cacheList('countries', () => Api.BasicInformationApi.getCountries());
  // Search-as-you-type master lists: warm the FULL list (empty search) so the
  // Basic Information sub-forms are fillable offline, not just the cached three
  // above. Mirrors the cache keys the basicInformation actions read back.
  await cacheList('key_processes', () => Api.BasicInformationApi.getKeyProcesses(''));
  await cacheList('raw_materials', () => Api.BasicInformationApi.getKeyResources(''));
  await cacheList('bought_out_parts', () => Api.BasicInformationApi.getBoughtOutPart(''));
  await cacheList('third_party_certs', () => Api.BasicInformationApi.thirdPartyCertifications(''));
  // Service-sector master lists — warm so the Service Basic Information form is
  // fillable offline. Cache keys mirror the service basicInformation actions.
  await cacheList('service_vendor_categories', () => Api.BasicInformationApi.getServiceCategory());
  await cacheList('service_vendor_labs', () => Api.BasicInformationApi.getVendorLabs());
  await cacheList('service_key_processes', () =>
    Api.BasicInformationApi.getServiceKeyProcesses('')
  );
  await cacheList('service_key_resources', () =>
    Api.BasicInformationApi.getServiceKeyResources('')
  );

  try {
    const biResp = await Api.BasicInformationApi.getBasicInformation(serverAssessmentId);
    const basicInfo = biResp?.data?.basicInformation;
    if (basicInfo) {
      await upsertBasicInformation({ assessmentLocalId: localId, payload: basicInfo });
      await markBasicInformationSynced(localId, basicInfo.id);
    }
  } catch (error) {
    Logger.warn('[offline] basic information warm failed:', error?.message);
  }
};

// Download the assessment's site pictures and site-tour photos to the device so
// they render offline. Each server picture's image is fetched to local storage
// (with the auth header) and mirrored as a synced local row pointing at that
// file; without this the offline read returns an empty list — the images live
// only on the server. Best-effort: a failure here must never fail the download.
export const seedSiteMediaForOffline = async (serverAssessmentId, localId) => {
  const token = (await getToken('accessToken'))?.token;
  const downloadImage = async (url, destPath) => {
    // Already on disk from an earlier open — cheap to call this on every online
    // assessment open, so a previously-downloaded assessment still gets seeded.
    if (await RNFS.exists(destPath)) {
      return true;
    }
    const dir = destPath.slice(0, destPath.lastIndexOf('/'));
    if (!(await RNFS.exists(dir))) {
      await RNFS.mkdir(dir);
    }
    const { statusCode } = await RNFS.downloadFile({
      fromUrl: url,
      toFile: destPath,
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }).promise;
    return statusCode >= 200 && statusCode < 300;
  };

  try {
    const resp = await Api.SiteApi.getSitePicture(serverAssessmentId);
    const pics = resp?.data?.pictures || resp?.pictures || [];
    // Server truth is in hand — clear broken orphans so the upserts below don't
    // sit beside a duplicate. Done only after a successful fetch, so an offline
    // failure (caught below) never wipes rows without a reseed to restore them.
    await deleteSyncedOrphanSitePictures(localId);
    for (const pic of pics) {
      if (!pic?.id || !pic?.downloadUrl) {
        continue;
      }
      const dest = `${RNFS.DocumentDirectoryPath}/assessments/${localId}/site_pictures/srv-${pic.id}.jpg`;
      if (await downloadImage(pic.downloadUrl, dest)) {
        await upsertSyncedSitePicture({
          serverId: pic.id,
          assessmentId: localId,
          type: /interior/i.test(pic.title || '') ? 'interior' : 'exterior',
          filePath: `file://${dest}`,
          latitude: pic.latitude,
          longitude: pic.longitude,
          capturedAt: pic.capturedAt,
          // Whose picture this is, so the step tick can tell the team's pictures from
          // the assessor's own. Same shape the site tour seed below already reads.
          // [BUG-08929]
          ownerUserId: pic.teamMember?.user?.id ?? pic.uploadedByUser?.id ?? null
        });
      }
    }
  } catch (error) {
    Logger.warn('[offline] site pictures seed failed:', error?.message);
  }

  try {
    const resp = await Api.SiteApi.getSiteTourPictures(serverAssessmentId);
    const pics = resp?.data?.pictures || resp?.pictures || [];
    await deleteSyncedOrphanSiteTourPictures(localId);
    for (const pic of pics) {
      if (!pic?.id || !pic?.downloadUrl) {
        continue;
      }
      const dest = `${RNFS.DocumentDirectoryPath}/assessments/${localId}/site_tour/srv-${pic.id}.jpg`;
      if (await downloadImage(pic.downloadUrl, dest)) {
        await upsertSyncedSiteTourPicture({
          serverId: pic.id,
          assessmentId: localId,
          ownerUserId: pic.teamMember?.user?.id ?? null,
          title: pic.title ?? null,
          filePath: `file://${dest}`,
          latitude: pic.latitude,
          longitude: pic.longitude,
          capturedAt: pic.capturedAt
        });
      }
    }
  } catch (error) {
    Logger.warn('[offline] site tour seed failed:', error?.message);
  }
};

/**
 * Mirror a server `/responses` payload's answers into the local responses table
 * so the parameter screens prefill, the local step computation counts them, and
 * an offline read (e.g. team-wide comments) holds every assessor's latest
 * responses — not just this device's. Takes an in-hand `parameters` array so the
 * caller that just fetched `/responses` online can backfill without re-fetching.
 *
 * Unsynced local edits are never overwritten — upsertSyncedResponseFromServer
 * skips rows whose local_status isn't 'synced'. Returns the count mirrored.
 */
export const mirrorResponseParameters = async (serverAssessmentId, localId, parameters) => {
  let mirrored = 0;
  for (const param of parameters || []) {
    for (const question of param?.questions || []) {
      const saved = question?.response;
      if (!question?.id || !saved) {
        continue;
      }
      if (saved.selectedOption == null && !saved.assessorRemarks) {
        continue;
      }
      // The response row FKs to questions(id); the question may be missing
      // locally if the parameters fetch failed — stub it like recordResponse
      // does so the seed never violates the FK.
      await ensureQuestionRow(serverAssessmentId, question.id);
      await upsertSyncedResponseFromServer({
        id: idFromServer(`${serverAssessmentId}-r-${question.id}`),
        serverId: saved.id ?? null,
        assessmentId: localId,
        questionId: idFromServer(`${serverAssessmentId}-q-${question.id}`),
        optionId: saved.selectedOption ?? null,
        remarks: saved.assessorRemarks ?? null,
        capturedAt: saved.assessedAt ?? null,
        // Persist the authoring assessor so the offline hydrate attributes each
        // remark correctly — a co-assessor's remark must not show as the lead's.
        assessorUserId: saved.assessor?.id ?? null,
        assessorName: saved.assessor?.name ?? null,
        assessorRole: saved.assessor?.role ?? null
      });
      mirrored += 1;
    }
  }
  return mirrored;
};

/**
 * Fetch `/responses` and mirror it locally. Best-effort — callers that only want
 * to refresh the offline copy when online (without a full re-download) use this.
 */
export const refreshResponsesMirror = async (serverAssessmentId, localId) => {
  try {
    const responsesResp =
      await Api.AssessmentResponseApi.getAssessmentResponses(serverAssessmentId);
    const mirrored = await mirrorResponseParameters(
      serverAssessmentId,
      localId,
      responsesResp?.data?.parameters || []
    );
    if (mirrored > 0) {
      Logger.info(`[offline] mirrored ${mirrored} synced response(s) for ${serverAssessmentId}`);
    }
  } catch (error) {
    Logger.warn(`[offline] responses mirror failed for ${serverAssessmentId}:`, error?.message);
  }
};

/**
 * Pre-flight: pull a full assessment bundle from the API and mirror it
 * into SQLite so the on-site flow can proceed with zero connectivity.
 *
 * Called when the user is online and explicitly chooses to download an
 * upcoming assessment (or implicitly the first time they open one in a
 * connected state). Idempotent — re-running refreshes the local copy
 * and replaces nested parameter/question lists wholesale.
 *
 * Returns the local assessment id ("srv-<serverId>") on success.
 */
export const downloadAssessmentForOffline = async (serverAssessmentId) => {
  if (!serverAssessmentId) {
    throw new Error('downloadAssessmentForOffline: missing assessment id');
  }

  Logger.info(`[offline] downloading assessment ${serverAssessmentId}`);

  const assessmentResponse = await Api.AssessmentApi.getAssessmentById(serverAssessmentId);
  const assessment = assessmentResponse?.data?.assessment || assessmentResponse?.assessment;
  if (!assessment?.id) {
    throw new Error('downloadAssessmentForOffline: empty assessment payload');
  }

  const localId = await upsertAssessmentFromServer(assessment);

  // The detail payload carries the server's viewer-scoped step statuses as a
  // { step: status } map — with the step-name keys camelised by the API's
  // response middleware, unlike the snake_case step names used everywhere
  // locally. Normalise and seed the synced map so locally-computed progress
  // (Home cards, steps list) is correct straight after a download — e.g. on
  // first login, before the steps screen's own sync runs.
  try {
    if (
      assessment.steps &&
      typeof assessment.steps === 'object' &&
      !Array.isArray(assessment.steps)
    ) {
      const statusByStep = {};
      Object.entries(assessment.steps).forEach(([step, status]) => {
        statusByStep[step.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)] = status;
      });
      await setSyncedServerSteps(localId, statusByStep);
    }
  } catch (error) {
    Logger.warn('[offline] step status seed failed:', error?.message);
  }

  // Backend response shape (see
  // ApplicationAssessmentParameterAllocationController::index):
  //   data: { mandatoryParameters: [...], optionalParameters: [...], ... }
  // Each parameter eager-loads `questions` and `assignedTeamMember`.
  let mandatory = [];
  let optional = [];
  try {
    const paramsResponse =
      await Api.AssessmentParameterApi.getAssessmentParameters(serverAssessmentId);
    const data = paramsResponse?.data || paramsResponse || {};
    mandatory = data.mandatoryParameters || [];
    optional = data.optionalParameters || [];
  } catch (error) {
    Logger.warn(
      `[offline] parameters fetch failed for assessment ${serverAssessmentId}:`,
      error?.message
    );
  }
  const parameters = [...mandatory, ...optional].map((p) => ({
    ...p,
    isMandatory: p.isMandatory ?? mandatory.includes(p),
    allocatedToUserId: p.assignedTeamMember?.user?.id ?? p.assignedToTeamMemberId ?? null
  }));
  await replaceParametersForAssessment(localId, assessment.id, parameters);

  // Questions ride on each parameter; flatten them with parameterId so
  // the questions table can FK back to parameters.
  const flatQuestions = [];
  parameters.forEach((p) => {
    if (Array.isArray(p?.questions)) {
      p.questions.forEach((q) => flatQuestions.push({ ...q, parameterId: p.id }));
    }
  });
  await replaceQuestionsForAssessment(localId, assessment.id, flatQuestions);

  // Pull previously synced answers back into the local responses table so the
  // parameter screens prefill and the local step computation counts them — the
  // device may hold none (e.g. first download after the logout wipe).
  await refreshResponsesMirror(serverAssessmentId, localId);

  await seedSiteMediaForOffline(serverAssessmentId, localId);
  await warmOfflineExtras(serverAssessmentId, localId);

  Logger.info(
    `[offline] downloaded assessment ${serverAssessmentId}: ` +
      `${parameters.length} parameters, ${flatQuestions.length} questions`
  );

  return localId;
};
