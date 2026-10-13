import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../services/api';
import { idFromServer } from '../../services/database/ids';
import { getBasicInformation as getLocalBasicInformation } from '../../services/database/repositories/basicInformationRepo';
import {
  cacheMasterData,
  getCachedMasterData
} from '../../services/database/repositories/masterDataRepo';
import { isAnyAssessmentPunchedIn, isPunchedInLocally } from '../../services/offline/readGate';
import { recordBasicInformation } from '../../services/offline/recordBasicInformation';
import { Logger } from '../../utils/logger';

// Master-data dropdowns aren't assessment-scoped, so the punch gate checks
// whether ANY assessment is inside its punch-in window. While punched in the
// cached list (warmed at download) is served without a server attempt; only
// when the cache is missing entirely does the call fall through to the API —
// a dead dropdown helps nobody.
const cachedMasterDataIfPunchedIn = async (key, query) => {
  if (!(await isAnyAssessmentPunchedIn())) {
    return null;
  }
  const cached = await getCachedMasterData(key);
  if (!cached) {
    return null;
  }
  return filterCachedMasterData(cached, query);
};

// Offline, the master-data search actions fall back to the full cached list
// (warmed at download with an empty query). The server would have filtered by
// the typed query, so filter the cached list the same way client-side —
// otherwise the dropdown dumps every option regardless of what was typed. The
// cert list is nested under `.data`; everything else is a bare array.
const matchesQuery = (item, query) => {
  const display =
    item?.processName ||
    item?.materialName ||
    item?.partName ||
    item?.resourceName ||
    item?.labName ||
    item?.certificationName ||
    item?.name ||
    '';
  return display.toLowerCase().includes(query.toLowerCase());
};

const filterCachedMasterData = (cached, query) => {
  if (!query) {
    return cached;
  }
  if (Array.isArray(cached)) {
    return cached.filter((item) => matchesQuery(item, query));
  }
  if (Array.isArray(cached?.data)) {
    return { ...cached, data: cached.data.filter((item) => matchesQuery(item, query)) };
  }
  return cached;
};

// Re-shape a locally-saved Basic Information payload (the POST body) into the
// GET response shape the screen reads back. Only the certifications key
// differs between save and load (thirdPartyCertifications -> ...Names).
const toBasicInformationGetShape = (data) => ({
  basicInformation: {
    ...data,
    thirdPartyCertificationNames: data?.thirdPartyCertifications || []
  }
});

const getBasicInformationAction = createAsyncThunk(
  'BasicInformation/GetBasicInformation',
  async (assessmentId, { rejectWithValue }) => {
    // SQLite-only inside the punch-in window — no server attempt at all.
    if (await isPunchedInLocally(assessmentId)) {
      try {
        const local = await getLocalBasicInformation(idFromServer(assessmentId));
        if (local?.payload) {
          return toBasicInformationGetShape(local.payload);
        }
      } catch (dbError) {
        Logger.warn('Punched-in local basic information read failed:', dbError?.message);
      }
      // Nothing saved locally yet — fall through so the form still loads
      // (offline it resolves empty exactly like the old fallback).
    }
    try {
      Logger.info('Fetching basic information for assessment ID:', assessmentId);
      const response = await Api.BasicInformationApi.getBasicInformation(assessmentId);
      Logger.info('Basic information retrieved successfully');
      return response.data;
    } catch (error) {
      Logger.warn('Remote fetch failed, falling back to local basic information');
      try {
        const local = await getLocalBasicInformation(idFromServer(assessmentId));
        if (local?.payload) {
          return toBasicInformationGetShape(local.payload);
        }
      } catch (dbError) {
        Logger.error('Local basic information lookup failed:', dbError?.message);
      }
      return rejectWithValue(error.response?.data || 'Failed to get basic information');
    }
  }
);

const getCategory = createAsyncThunk(
  'BasicInformation/getCategory',
  async (_, { rejectWithValue }) => {
    const gated = await cachedMasterDataIfPunchedIn('vendor_categories');
    if (gated) {
      return gated;
    }
    try {
      const response = await Api.BasicInformationApi.getCategory();
      Logger.info('Basic getCategory retrieved successfully');
      cacheMasterData('vendor_categories', response.data).catch(() => undefined);
      return response.data;
    } catch (error) {
      Logger.warn('Remote fetch failed, falling back to cached categories');
      const cached = await getCachedMasterData('vendor_categories');
      if (cached) {
        return cached;
      }
      return rejectWithValue(error.response?.data || 'Failed to get basic information');
    }
  }
);

const getStore = createAsyncThunk('BasicInformation/getStore', async (_, { rejectWithValue }) => {
  const gated = await cachedMasterDataIfPunchedIn('stores');
  if (gated) {
    return gated;
  }
  try {
    const response = await Api.BasicInformationApi.getStore();
    Logger.info('Basic getStore retrieved successfully');
    cacheMasterData('stores', response.data).catch(() => undefined);
    return response.data;
  } catch (error) {
    Logger.warn('Remote fetch failed, falling back to cached stores');
    const cached = await getCachedMasterData('stores');
    if (cached) {
      return cached;
    }
    return rejectWithValue(error.response?.data || 'Failed to get basic information');
  }
});

const addBasicInformationAction = createAsyncThunk(
  'BasicInformation/AddBasicInformation',
  async (val, { rejectWithValue }) => {
    // Offline-first: persists the form to SQLite + outbox and hands it to the
    // drain, resolving either way so the step completes without a network.
    try {
      Logger.info('Adding basic information for assessment ID:', val.assessmentId);
      const result = await recordBasicInformation({
        serverAssessmentId: val.assessmentId,
        data: val.data
      });
      Logger.info(`Basic information saved (synced=${result.synced})`);
      return result;
    } catch (error) {
      Logger.error('Failed to save basic information locally:', error);
      return rejectWithValue(error?.message || 'Failed to add basic information');
    }
  }
);

const getKeyProcessesAction = createAsyncThunk(
  'BasicInformation/GetKeyProcesses',
  async (val, { rejectWithValue }) => {
    const gated = await cachedMasterDataIfPunchedIn('key_processes', val);
    if (gated) {
      return gated;
    }
    try {
      const response = await Api.BasicInformationApi.getKeyProcesses(val);
      Logger.info('Key processes retrieved successfully');
      // Cache only the full list (empty search) so offline keeps every option,
      // not just the last typed query.
      if (!val) {
        cacheMasterData('key_processes', response.data).catch(() => undefined);
      }
      return response.data;
    } catch (error) {
      Logger.warn('Remote fetch failed, falling back to cached key processes');
      const cached = await getCachedMasterData('key_processes');
      if (cached) {
        return filterCachedMasterData(cached, val);
      }
      return rejectWithValue(error.response?.data || 'Failed to get key processes');
    }
  }
);

const getKeyResourcesAction = createAsyncThunk(
  'BasicInformation/GetKeyResources',
  async (val, { rejectWithValue }) => {
    const gated = await cachedMasterDataIfPunchedIn('raw_materials', val);
    if (gated) {
      return gated;
    }
    try {
      const response = await Api.BasicInformationApi.getKeyResources(val);
      Logger.info('Key resources retrieved successfully');
      if (!val) {
        cacheMasterData('raw_materials', response.data).catch(() => undefined);
      }
      return response.data;
    } catch (error) {
      Logger.warn('Remote fetch failed, falling back to cached raw materials');
      const cached = await getCachedMasterData('raw_materials');
      if (cached) {
        return filterCachedMasterData(cached, val);
      }
      return rejectWithValue(error.response?.data || 'Failed to get key resources');
    }
  }
);

const getBoughtOutPart = createAsyncThunk(
  'BasicInformation/GetBoughtOutPart',
  async (val, { rejectWithValue }) => {
    const gated = await cachedMasterDataIfPunchedIn('bought_out_parts', val);
    if (gated) {
      return gated;
    }
    try {
      const response = await Api.BasicInformationApi.getBoughtOutPart(val);
      Logger.info('Bought out parts retrieved successfully');
      if (!val) {
        cacheMasterData('bought_out_parts', response.data).catch(() => undefined);
      }
      return response.data;
    } catch (error) {
      Logger.warn('Remote fetch failed, falling back to cached bought out parts');
      const cached = await getCachedMasterData('bought_out_parts');
      if (cached) {
        return filterCachedMasterData(cached, val);
      }
      return rejectWithValue(error.response?.data || 'Failed to get bought out parts');
    }
  }
);

const thirdPartyCertificationsAction = createAsyncThunk(
  'BasicInformation/GetThirdPartyCertifications',
  async (val, { rejectWithValue }) => {
    const gated = await cachedMasterDataIfPunchedIn('third_party_certs', val);
    if (gated) {
      return gated;
    }
    try {
      const response = await Api.BasicInformationApi.thirdPartyCertifications(val);
      Logger.info('Third party certifications retrieved successfully');
      if (!val) {
        cacheMasterData('third_party_certs', response.data).catch(() => undefined);
      }
      return response.data;
    } catch (error) {
      Logger.warn('Remote fetch failed, falling back to cached third party certifications');
      const cached = await getCachedMasterData('third_party_certs');
      if (cached) {
        return filterCachedMasterData(cached, val);
      }
      return rejectWithValue(error.response?.data || 'Failed to get third party certifications');
    }
  }
);

const getCountriesAction = createAsyncThunk(
  'BasicInformation/GetCountries',
  async (_, { rejectWithValue }) => {
    const gated = await cachedMasterDataIfPunchedIn('countries');
    if (gated) {
      return gated;
    }
    try {
      const response = await Api.BasicInformationApi.getCountries();
      Logger.info('Countries retrieved successfully');
      cacheMasterData('countries', response.data).catch(() => undefined);
      return response.data;
    } catch (error) {
      Logger.warn('Remote fetch failed, falling back to cached countries');
      const cached = await getCachedMasterData('countries');
      if (cached) {
        return cached;
      }
      return rejectWithValue(error.response?.data || 'Failed to get countries');
    }
  }
);

// --- Service-sector master data ---
// Mirror the manufacturing lookups (offline-cache-then-API, with a cached
// fallback on network failure). Cache keys are warmed at assessment download
// in downloadAssessment.js so the Service Basic Information form is fillable
// offline. The category/labs lists are small (fetched whole); the
// key-process/resource lists are search-as-you-type but only the full list
// (empty search) is cached so offline keeps every option.
const getServiceCategoryAction = createAsyncThunk(
  'BasicInformation/getServiceCategory',
  async (_, { rejectWithValue }) => {
    const gated = await cachedMasterDataIfPunchedIn('service_vendor_categories');
    if (gated) {
      return gated;
    }
    try {
      const response = await Api.BasicInformationApi.getServiceCategory();
      Logger.info('Service getCategory retrieved successfully');
      cacheMasterData('service_vendor_categories', response.data).catch(() => undefined);
      return response.data;
    } catch (error) {
      Logger.warn('Remote fetch failed, falling back to cached service categories');
      const cached = await getCachedMasterData('service_vendor_categories');
      if (cached) {
        return cached;
      }
      return rejectWithValue(error.response?.data || 'Failed to get service categories');
    }
  }
);

const getVendorLabsAction = createAsyncThunk(
  'BasicInformation/getVendorLabs',
  async (_, { rejectWithValue }) => {
    const gated = await cachedMasterDataIfPunchedIn('service_vendor_labs');
    if (gated) {
      return gated;
    }
    try {
      const response = await Api.BasicInformationApi.getVendorLabs();
      Logger.info('Service getVendorLabs retrieved successfully');
      cacheMasterData('service_vendor_labs', response.data).catch(() => undefined);
      return response.data;
    } catch (error) {
      Logger.warn('Remote fetch failed, falling back to cached vendor labs');
      const cached = await getCachedMasterData('service_vendor_labs');
      if (cached) {
        return cached;
      }
      return rejectWithValue(error.response?.data || 'Failed to get vendor labs');
    }
  }
);

const getServiceKeyProcessesAction = createAsyncThunk(
  'BasicInformation/GetServiceKeyProcesses',
  async (val, { rejectWithValue }) => {
    const gated = await cachedMasterDataIfPunchedIn('service_key_processes', val);
    if (gated) {
      return gated;
    }
    try {
      const response = await Api.BasicInformationApi.getServiceKeyProcesses(val);
      Logger.info('Service key processes retrieved successfully');
      if (!val) {
        cacheMasterData('service_key_processes', response.data).catch(() => undefined);
      }
      return response.data;
    } catch (error) {
      Logger.warn('Remote fetch failed, falling back to cached service key processes');
      const cached = await getCachedMasterData('service_key_processes');
      if (cached) {
        return filterCachedMasterData(cached, val);
      }
      return rejectWithValue(error.response?.data || 'Failed to get service key processes');
    }
  }
);

const getServiceKeyResourcesAction = createAsyncThunk(
  'BasicInformation/GetServiceKeyResources',
  async (val, { rejectWithValue }) => {
    const gated = await cachedMasterDataIfPunchedIn('service_key_resources', val);
    if (gated) {
      return gated;
    }
    try {
      const response = await Api.BasicInformationApi.getServiceKeyResources(val);
      Logger.info('Service key resources retrieved successfully');
      if (!val) {
        cacheMasterData('service_key_resources', response.data).catch(() => undefined);
      }
      return response.data;
    } catch (error) {
      Logger.warn('Remote fetch failed, falling back to cached service key resources');
      const cached = await getCachedMasterData('service_key_resources');
      if (cached) {
        return filterCachedMasterData(cached, val);
      }
      return rejectWithValue(error.response?.data || 'Failed to get service key resources');
    }
  }
);

export {
  addBasicInformationAction,
  getBasicInformationAction,
  getBoughtOutPart,
  getCategory,
  getCountriesAction,
  getKeyProcessesAction,
  getKeyResourcesAction,
  getServiceCategoryAction,
  getServiceKeyProcessesAction,
  getServiceKeyResourcesAction,
  getStore,
  getVendorLabsAction,
  thirdPartyCertificationsAction
};
