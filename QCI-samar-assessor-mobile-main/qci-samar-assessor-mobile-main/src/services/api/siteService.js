import { Logger } from '../../utils';
import { logApiError } from '../../utils/apiErrorLog';
import { UPLOAD_TIMEOUT } from './clients/userClient';

const SiteService = (userClient) => {
  const getSitePicture = async (assessmentId) => {
    try {
      const response = await userClient.get(
        `application-assessments/${assessmentId}/site-pictures`
      );
      Logger.info('Site pictures retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('SiteService.getSitePicture', error);
      throw error;
    }
  };

  const addSitePicture = async (val) => {
    try {
      const response = await userClient.post(
        `application-assessments/${val.assessmentId}/site-pictures`,
        val.formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          timeout: UPLOAD_TIMEOUT
        }
      );
      Logger.info('Site picture added successfully');
      return response.data;
    } catch (error) {
      logApiError('SiteService.addSitePicture', error);
      throw error;
    }
  };

  const getMySitePictures = async (assessmentId) => {
    try {
      const response = await userClient.get(
        `application-assessments/${assessmentId}/site-pictures/mine`
      );
      Logger.info('My site pictures retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('SiteService.getMySitePictures', error);
      throw error;
    }
  };

  const deleteSitePicture = async (val) => {
    try {
      const response = await userClient.delete(
        `application-assessments/${val.assessmentId}/site-pictures/${val.pictureId}`
      );
      Logger.info('Site picture deleted successfully');
      return response.data;
    } catch (error) {
      logApiError('SiteService.deleteSitePicture', error);
      throw error;
    }
  };

  const getSiteTourPictures = async (assessmentId) => {
    try {
      const response = await userClient.get(
        `application-assessments/${assessmentId}/site-tour-pictures/mine`
      );
      Logger.info('Site tour pictures retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('SiteService.getSiteTourPictures', error);
      throw error;
    }
  };

  // Full pool (all uploaders), not just /mine. Service sector uses this to show
  // the applicant's uploaded site-tour photos to the assessor read-only.
  const getSiteTourPicturesPool = async (assessmentId) => {
    try {
      const response = await userClient.get(
        `application-assessments/${assessmentId}/site-tour-pictures`
      );
      Logger.info('Site tour pictures pool retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('SiteService.getSiteTourPicturesPool', error);
      throw error;
    }
  };

  const addSiteTourPicture = async (val) => {
    try {
      const response = await userClient.post(
        `application-assessments/${val.assessmentId}/site-tour-pictures`,
        val.formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          timeout: UPLOAD_TIMEOUT
        }
      );
      Logger.info('Site tour picture added successfully');
      return response.data;
    } catch (error) {
      logApiError('SiteService.addSiteTourPicture', error);
      throw error;
    }
  };

  const deleteSiteTourPicture = async (val) => {
    try {
      const response = await userClient.delete(
        `application-assessments/${val.assessmentId}/site-tour-pictures/${val.pictureId}`
      );
      Logger.info('Site tour picture deleted successfully');
      return response.data;
    } catch (error) {
      logApiError('SiteService.deleteSiteTourPicture', error);
      throw error;
    }
  };
  return {
    getSitePicture,
    addSitePicture,
    getMySitePictures,
    deleteSitePicture,
    getSiteTourPictures,
    getSiteTourPicturesPool,
    addSiteTourPicture,
    deleteSiteTourPicture
  };
};

export default SiteService;
