import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../services/api';
import { idFromServer } from '../../services/database/ids';
import {
  listSitePictures,
  listSiteTourPictures
} from '../../services/database/repositories/sitePicturesRepo';
import { isPunchedInLocally } from '../../services/offline/readGate';
import { recordSitePicture } from '../../services/offline/recordSitePicture';
import { recordSitePictureDelete } from '../../services/offline/recordSitePictureDelete';
import { recordSiteTourPicture } from '../../services/offline/recordSiteTourPicture';
import { recordSiteTourPictureDelete } from '../../services/offline/recordSiteTourPictureDelete';
import { attachSyncStateByOpKey } from '../../services/offline/syncStateBadge';
import { Logger } from '../../utils/logger';

// Local rows are mapped into the SAME shape the screens consume from the
// online API (a { pictures: [...] } wrapper whose items expose `downloadUrl`),
// not an ad-hoc local shape — otherwise `siteTourPictures?.pictures` /
// `mySitePictures?.pictures` are undefined offline and nothing renders.
// `downloadUrl` carries the persistPhoto `file://` path, which renders the
// same as a remote URL in <Image source={{ uri }} />.
const mapLocalSitePicture = (row) => ({
  id: row.server_id || row.id,
  localId: row.id,
  // site_pictures stores `type`, not the title the screen keys on. The online
  // payload titles them exactly like the backend validator does on upload.
  title: row.type === 'interior' ? 'Site Interior Picture' : 'Site Exterior Picture',
  downloadUrl: row.file_path,
  latitude: row.latitude,
  longitude: row.longitude,
  capturedAt: row.captured_at,
  isSynced: row.local_status === 'synced'
});

// Tag each locally-sourced picture with its per-image sync state for the badge:
// 'synced' once the mirror row is uploaded, else 'failed'/'pending' from its
// outbox row. Server-fetched pictures carry no localId and are treated as
// 'synced'. `opType` is the outbox op_type ('sitePicture' | 'siteTourPicture')
// its op_key is built from.
const attachSyncState = (pictures, opType) =>
  attachSyncStateByOpKey(pictures, (p) => (p.localId != null ? `${opType}:${p.localId}` : null));

const mapLocalTourPicture = (row, currentUser) => ({
  id: row.server_id || row.id,
  localId: row.id,
  title: row.title,
  downloadUrl: row.file_path,
  fileName: 'site_tour_image.jpg',
  latitude: row.latitude,
  longitude: row.longitude,
  capturedAt: row.captured_at,
  // The server fills teamMember from auth on the real response; a local
  // capture was taken by the signed-in user. Wrap in a teamMember object so
  // the screen's `picture.teamMember.user` access can't throw offline.
  teamMember: { user: currentUser || null },
  isSynced: row.local_status === 'synced'
});

const getSitePictureAction = createAsyncThunk(
  'Site/GetSitePicture',
  async (assessmentId, { rejectWithValue }) => {
    // SQLite-only inside the punch-in window — no server attempt at all.
    if (await isPunchedInLocally(assessmentId)) {
      const rows = await listSitePictures(idFromServer(assessmentId));
      return {
        pictures: await attachSyncState(rows.map(mapLocalSitePicture), 'sitePicture'),
        source: 'local'
      };
    }
    try {
      Logger.info('Fetching site pictures for assessment ID:', assessmentId);
      const response = await Api.SiteApi.getSitePicture(assessmentId);
      Logger.info('Site pictures retrieved successfully');
      return response;
    } catch (error) {
      Logger.warn('Remote fetch failed, falling back to local site pictures');
      try {
        const rows = await listSitePictures(idFromServer(assessmentId));
        return {
          pictures: await attachSyncState(rows.map(mapLocalSitePicture), 'sitePicture'),
          source: 'local'
        };
      } catch (_dbError) {
        return rejectWithValue(error.response?.data || 'Failed to get site pictures');
      }
    }
  }
);

const addSitePictureAction = createAsyncThunk(
  'Site/AddSitePicture',
  async (val, { rejectWithValue }) => {
    // Offline-first: persists locally + outbox and hands it to the drain.
    try {
      const result = await recordSitePicture({
        serverAssessmentId: val.assessmentId,
        type: val.type,
        uri: val.uri,
        latitude: val.latitude,
        longitude: val.longitude
      });
      return result;
    } catch (error) {
      Logger.error('Failed to record site picture:', error);
      return rejectWithValue(error?.message || 'Failed to add site picture');
    }
  }
);

const getMySitePicturesAction = createAsyncThunk(
  'Site/GetMySitePictures',
  async (assessmentId, { rejectWithValue, getState }) => {
    // SQLite-only inside the punch-in window — no server attempt at all. Scope
    // the local read to the current user so it mirrors the server's /mine: the
    // seeded table holds the whole team's pictures, and an unscoped read would
    // show a co-assessor the lead's pictures too. [BUG-08929]
    if (await isPunchedInLocally(assessmentId)) {
      const currentUser = getState()?.account?.userData?.user;
      const rows = await listSitePictures(idFromServer(assessmentId), currentUser?.id);
      return {
        pictures: await attachSyncState(rows.map(mapLocalSitePicture), 'sitePicture'),
        source: 'local'
      };
    }
    // Online: fresh from server. Offline: read from local SQLite so the
    // user still sees the photos they captured earlier in the session.
    try {
      const response = await Api.SiteApi.getMySitePictures(assessmentId);
      return response.data;
    } catch (error) {
      Logger.warn('Remote fetch failed, falling back to local site pictures');
      try {
        const currentUser = getState()?.account?.userData?.user;
        const rows = await listSitePictures(idFromServer(assessmentId), currentUser?.id);
        return {
          pictures: await attachSyncState(rows.map(mapLocalSitePicture), 'sitePicture'),
          source: 'local'
        };
      } catch (_dbError) {
        return rejectWithValue(error.response?.data || 'Failed to get my site pictures');
      }
    }
  }
);

// Service sector: the full applicant-uploaded site-pictures pool, shown to the
// assessor read-only. The applicant's upload completes the step (no assessor
// curation). Online-only — service assessments are conducted remotely, so
// there's no offline punch-in capture window for this pool.
const getSitePicturePoolAction = createAsyncThunk(
  'Site/GetSitePicturePool',
  async (assessmentId, { rejectWithValue }) => {
    try {
      const response = await Api.SiteApi.getSitePicture(assessmentId);
      return response.data;
    } catch (error) {
      Logger.error('Failed to get site picture pool:', error);
      return rejectWithValue(error.response?.data || 'Failed to get site pictures');
    }
  }
);

const deleteSitePictureAction = createAsyncThunk(
  'Site/DeleteSitePicture',
  async (val, { rejectWithValue }) => {
    // Offline-first: removes locally + queues the server delete (or cancels the
    // queued create for an unsynced capture) and hands it to the drain.
    try {
      const result = await recordSitePictureDelete({
        serverAssessmentId: val.assessmentId,
        pictureId: val.pictureId
      });
      return { ...result, pictureId: val.pictureId };
    } catch (error) {
      Logger.error('Failed to delete site picture:', error);
      return rejectWithValue(error?.message || 'Failed to delete site picture');
    }
  }
);

const getSiteTourPicturesAction = createAsyncThunk(
  'Site/GetSiteTourPictures',
  async (assessmentId, { rejectWithValue, getState }) => {
    // SQLite-only inside the punch-in window — no server attempt at all.
    if (await isPunchedInLocally(assessmentId)) {
      const currentUser = getState()?.account?.userData?.user;
      const rows = await listSiteTourPictures(idFromServer(assessmentId), currentUser?.id);
      Logger.info('[DIAG] siteTour read (punched-in local)', {
        queriedAssessmentId: idFromServer(assessmentId),
        rowCount: rows.length
      });
      return {
        pictures: await attachSyncState(
          rows.map((row) => mapLocalTourPicture(row, currentUser)),
          'siteTourPicture'
        ),
        source: 'local'
      };
    }
    try {
      const response = await Api.SiteApi.getSiteTourPictures(assessmentId);
      return response.data;
    } catch (error) {
      Logger.warn('Remote fetch failed, falling back to local site tour pictures');
      try {
        const currentUser = getState()?.account?.userData?.user;
        const rows = await listSiteTourPictures(idFromServer(assessmentId), currentUser?.id);
        return {
          pictures: rows.map((row) => mapLocalTourPicture(row, currentUser)),
          source: 'local'
        };
      } catch (_dbError) {
        return rejectWithValue(error.response?.data || 'Failed to get site tour pictures');
      }
    }
  }
);

const addSiteTourPictureAction = createAsyncThunk(
  'Site/AddSiteTourPicture',
  async (val, { rejectWithValue }) => {
    // Offline-first: persists locally + outbox and hands it to the drain.
    try {
      const result = await recordSiteTourPicture({
        serverAssessmentId: val.assessmentId,
        ownerUserId: val.ownerUserId,
        title: val.title,
        uri: val.uri,
        latitude: val.latitude,
        longitude: val.longitude,
        capturedAt: val.capturedAt
      });
      return result;
    } catch (error) {
      Logger.error('Failed to record site tour picture:', error);
      return rejectWithValue(error?.message || 'Failed to add site tour picture');
    }
  }
);

// Service sector: the full applicant-uploaded site-tour pool (all uploaders,
// not /mine), shown to the assessor read-only — the applicant's upload completes
// the step. Online-only, same rationale as the site-pictures pool.
const getSiteTourPicturePoolAction = createAsyncThunk(
  'Site/GetSiteTourPicturePool',
  async (assessmentId, { rejectWithValue }) => {
    try {
      const response = await Api.SiteApi.getSiteTourPicturesPool(assessmentId);
      return response.data;
    } catch (error) {
      Logger.error('Failed to get site tour picture pool:', error);
      return rejectWithValue(error.response?.data || 'Failed to get site tour pictures');
    }
  }
);

const deleteSiteTourPictureAction = createAsyncThunk(
  'Site/DeleteSiteTourPicture',
  async (val, { rejectWithValue }) => {
    // Offline-first: mirrors deleteSitePictureAction.
    try {
      const result = await recordSiteTourPictureDelete({
        serverAssessmentId: val.assessmentId,
        pictureId: val.pictureId
      });
      return { ...result, pictureId: val.pictureId };
    } catch (error) {
      Logger.error('Failed to delete site tour picture:', error);
      return rejectWithValue(error?.message || 'Failed to delete site tour picture');
    }
  }
);

export {
  addSitePictureAction,
  addSiteTourPictureAction,
  deleteSitePictureAction,
  deleteSiteTourPictureAction,
  getMySitePicturesAction,
  getSitePictureAction,
  getSitePicturePoolAction,
  getSiteTourPicturePoolAction,
  getSiteTourPicturesAction
};
