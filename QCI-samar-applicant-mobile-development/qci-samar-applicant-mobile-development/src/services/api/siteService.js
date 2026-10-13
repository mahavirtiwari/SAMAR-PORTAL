import { Logger } from '../../utils/logger';
import { generateUuid } from '../../utils/stringUtils';
import userClient, { UPLOAD_TIMEOUT } from './clients/userClient';

/**
 * Site Pictures / Site Tour service.
 *
 * Endpoints (keyed on the numeric assessmentId from the application detail):
 *   GET    application-assessments/{assessmentId}/site-pictures
 *   POST   application-assessments/{assessmentId}/site-pictures            (multipart)
 *   DELETE application-assessments/{assessmentId}/site-pictures/{pictureId}
 *   GET    application-assessments/{assessmentId}/site-tour-pictures
 *   POST   application-assessments/{assessmentId}/site-tour-pictures       (multipart)
 *   DELETE application-assessments/{assessmentId}/site-tour-pictures/{pictureId}
 *
 * The GET list returns every applicant upload for the assessment (not just the
 * caller's), so an enterprise admin sees the site pictures/tour the unit admin
 * captured. Both are applicant-owners of the application, which the API enforces.
 */

const buildPictureFormData = ({
  title,
  uri,
  latitude,
  longitude,
  capturedAt,
  fileName,
  type,
  clientUuid,
}) => {
  const formData = new FormData();
  formData.append('title', title);
  if (latitude != null && Number.isFinite(latitude)) {
    formData.append('latitude', String(latitude));
  }
  if (longitude != null && Number.isFinite(longitude)) {
    formData.append('longitude', String(longitude));
  }
  formData.append('capturedAt', (capturedAt ? new Date(capturedAt) : new Date()).toISOString());
  // Idempotency key the backend dedupes on. The offline outbox supplies a
  // stable clientUuid so every replay of a queued upload reuses it; when absent
  // (a plain online call) one is minted so an axios-retry replay still dedupes.
  formData.append('clientUuid', clientUuid || generateUuid());
  formData.append('image', {
    uri,
    type: type || 'image/jpeg',
    name: fileName || `image_${Date.now()}.jpg`,
  });
  return formData;
};

const SiteService = () => {
  const getSitePictures = async assessmentId => {
    try {
      const response = await userClient.get(
        `application-assessments/${assessmentId}/site-pictures`,
      );
      return response.data;
    } catch (error) {
      Logger.error('Error in SiteService.getSitePictures: ', error);
      throw error;
    }
  };

  const getSiteTourPictures = async assessmentId => {
    try {
      const response = await userClient.get(
        `application-assessments/${assessmentId}/site-tour-pictures`,
      );
      return response.data;
    } catch (error) {
      Logger.error('Error in SiteService.getSiteTourPictures: ', error);
      throw error;
    }
  };

  const addSitePicture = async ({
    assessmentId,
    type,
    uri,
    latitude,
    longitude,
    capturedAt,
    clientUuid,
  }) => {
    try {
      const title = type === 'interior' ? 'Site Interior Picture' : 'Site Exterior Picture';
      const formData = buildPictureFormData({
        title,
        uri,
        latitude,
        longitude,
        capturedAt,
        clientUuid,
      });
      const response = await userClient.post(
        `application-assessments/${assessmentId}/site-pictures`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: UPLOAD_TIMEOUT,
        },
      );
      return response.data;
    } catch (error) {
      Logger.error('Error in SiteService.addSitePicture: ', error);
      throw error;
    }
  };

  const deleteSitePicture = async ({ assessmentId, pictureId }) => {
    try {
      const response = await userClient.delete(
        `application-assessments/${assessmentId}/site-pictures/${pictureId}`,
      );
      return response.data;
    } catch (error) {
      Logger.error('Error in SiteService.deleteSitePicture: ', error);
      throw error;
    }
  };

  const addSiteTourPicture = async ({
    assessmentId,
    title,
    uri,
    latitude,
    longitude,
    capturedAt,
    clientUuid,
  }) => {
    try {
      const formData = buildPictureFormData({
        title,
        uri,
        latitude,
        longitude,
        capturedAt,
        clientUuid,
      });
      const response = await userClient.post(
        `application-assessments/${assessmentId}/site-tour-pictures`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: UPLOAD_TIMEOUT,
        },
      );
      return response.data;
    } catch (error) {
      Logger.error('Error in SiteService.addSiteTourPicture: ', error);
      throw error;
    }
  };

  const deleteSiteTourPicture = async ({ assessmentId, pictureId }) => {
    try {
      const response = await userClient.delete(
        `application-assessments/${assessmentId}/site-tour-pictures/${pictureId}`,
      );
      return response.data;
    } catch (error) {
      Logger.error('Error in SiteService.deleteSiteTourPicture: ', error);
      throw error;
    }
  };

  return {
    getSitePictures,
    getSiteTourPictures,
    addSitePicture,
    deleteSitePicture,
    addSiteTourPicture,
    deleteSiteTourPicture,
  };
};

export default SiteService;
