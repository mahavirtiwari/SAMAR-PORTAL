import { Logger } from '../../../utils/logger';
import { deleteRecord, executeSql, insert, select, update } from '../sqlUtils';

/**
 * Create a calendar event
 */
export const createCalendarEvent = async (val) => {
  if (!val || !val.calendarId) {
    Logger.error('Invalid input: calendarId is required.');
    return Promise.reject(new Error('Invalid input: calendarId is required.'));
  }

  Logger.info('Attempting to insert event with values:', val);

  try {
    const result = await executeSql(
      `INSERT INTO calendar_events 
      (calendar_id, site_number, city, state, scope_of_work, scheduled_start_date, scheduled_finish_date, comments) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        val.calendarId,
        val.siteNumber || '',
        val.city || '',
        val.state || '',
        JSON.stringify(val.scopeOfWork || []),
        val.scheduledStartDate || '',
        val.scheduledFinishDate || '',
        val.comments || ''
      ]
    );
    Logger.info('✅ Calendar event inserted successfully.', result);
    return result;
  } catch (error) {
    Logger.error('❌ SQL Error inserting calendar event:', error);
    throw error;
  }
};

/**
 * Get calendar event by ID
 */
export const getCalendarEventById = async (calendarId) => {
  try {
    Logger.info('Fetching calendar event with ID:', calendarId);
    const result = await select('calendar_events', 'calendar_id = ?', [calendarId]);

    if (result && result.length > 0) {
      const event = result[0];
      if (event.scope_of_work) {
        event.scopeOfWork = JSON.parse(event.scope_of_work);
      }
      Logger.info('✅ Calendar event fetched successfully.');
      return event;
    }

    Logger.warn('Calendar event not found.');
    return null;
  } catch (error) {
    Logger.error('❌ Error fetching calendar event:', error);
    throw error;
  }
};

/**
 * Get all calendar events
 */
export const getAllCalendarEvents = async () => {
  try {
    Logger.info('Fetching all calendar events...');
    const result = await select('calendar_events');

    const events = result.map((event) => {
      if (event.scope_of_work) {
        event.scopeOfWork = JSON.parse(event.scope_of_work);
      }
      return event;
    });

    Logger.info(`✅ Fetched ${events.length} calendar events.`);
    return events;
  } catch (error) {
    Logger.error('❌ Error fetching calendar events:', error);
    throw error;
  }
};

/**
 * Update calendar event
 */
export const updateCalendarEvent = async (calendarId, updates) => {
  if (!calendarId) {
    Logger.error('Invalid input: calendarId is required.');
    return Promise.reject(new Error('Invalid input: calendarId is required.'));
  }

  try {
    Logger.info('Updating calendar event with ID:', calendarId);

    const updateData = { ...updates };
    if (updateData.scopeOfWork) {
      updateData.scopeOfWork = JSON.stringify(updateData.scopeOfWork);
    }

    const result = await update('calendar_events', updateData, 'calendar_id = ?', [calendarId]);
    Logger.info('✅ Calendar event updated successfully.');
    return result;
  } catch (error) {
    Logger.error('❌ Error updating calendar event:', error);
    throw error;
  }
};

/**
 * Delete calendar event
 */
export const deleteCalendarEvent = async (calendarId) => {
  if (!calendarId) {
    Logger.error('Invalid input: calendarId is required.');
    return Promise.reject(new Error('Invalid input: calendarId is required.'));
  }

  try {
    Logger.info('Deleting calendar event with ID:', calendarId);
    const result = await deleteRecord('calendar_events', 'calendar_id = ?', [calendarId]);
    Logger.info('✅ Calendar event deleted successfully.');
    return result;
  } catch (error) {
    Logger.error('❌ Error deleting calendar event:', error);
    throw error;
  }
};

/**
 * Create assessment
 */
export const createAssessment = async (val) => {
  if (!val || !val.assessment_id) {
    Logger.error('Invalid input: assessment_id is required.');
    return Promise.reject(new Error('Invalid input: assessment_id is required.'));
  }

  Logger.info('Attempting to insert assessment with values:', val);

  try {
    const result = await insert('assessments', {
      assessment_id: val.assessment_id,
      company_name: val.company_name || '',
      location: val.location || '',
      start_date: val.start_date || '',
      end_date: val.end_date || '',
      progress: val.progress || 0,
      status: val.status || 'pending'
    });
    Logger.info('✅ Assessment inserted successfully.', result);
    return result;
  } catch (error) {
    Logger.error('❌ Error inserting assessment:', error);
    throw error;
  }
};

/**
 * Get assessment by ID
 */
export const getAssessmentById = async (assessmentId) => {
  try {
    Logger.info('Fetching assessment with ID:', assessmentId);
    const result = await select('assessments', 'assessment_id = ?', [assessmentId]);

    if (result && result.length > 0) {
      Logger.info('✅ Assessment fetched successfully.');
      return result[0];
    }

    Logger.warn('Assessment not found.');
    return null;
  } catch (error) {
    Logger.error('❌ Error fetching assessment:', error);
    throw error;
  }
};

/**
 * Get all assessments
 */
export const getAllAssessments = async () => {
  try {
    Logger.info('Fetching all assessments...');
    const result = await select('assessments');
    Logger.info(`✅ Fetched ${result.length} assessments.`);
    return result;
  } catch (error) {
    Logger.error('❌ Error fetching assessments:', error);
    throw error;
  }
};

/**
 * Update assessment
 */
export const updateAssessment = async (assessmentId, updates) => {
  if (!assessmentId) {
    Logger.error('Invalid input: assessment_id is required.');
    return Promise.reject(new Error('Invalid input: assessment_id is required.'));
  }

  try {
    Logger.info('Updating assessment with ID:', assessmentId);
    const result = await update('assessments', updates, 'assessment_id = ?', [assessmentId]);
    Logger.info('✅ Assessment updated successfully.');
    return result;
  } catch (error) {
    Logger.error('❌ Error updating assessment:', error);
    throw error;
  }
};

/**
 * Delete assessment
 */
export const deleteAssessment = async (assessmentId) => {
  if (!assessmentId) {
    Logger.error('Invalid input: assessment_id is required.');
    return Promise.reject(new Error('Invalid input: assessment_id is required.'));
  }

  try {
    Logger.info('Deleting assessment with ID:', assessmentId);
    const result = await deleteRecord('assessments', 'assessment_id = ?', [assessmentId]);
    Logger.info('✅ Assessment deleted successfully.');
    return result;
  } catch (error) {
    Logger.error('❌ Error deleting assessment:', error);
    throw error;
  }
};

/**
 * Create site picture
 */
export const createSitePicture = async (val) => {
  if (!val || !val.assessment_id || !val.image_uri) {
    Logger.error('Invalid input: assessment_id and image_uri are required.');
    return Promise.reject(new Error('Invalid input: assessment_id and image_uri are required.'));
  }

  Logger.info('Attempting to insert site picture with values:', val);

  try {
    const result = await insert('site_pictures', {
      assessment_id: val.assessment_id,
      image_uri: val.image_uri,
      image_type: val.image_type || '',
      description: val.description || '',
      latitude: val.latitude || null,
      longitude: val.longitude || null
    });
    Logger.info('✅ Site picture inserted successfully.', result);
    return result;
  } catch (error) {
    Logger.error('❌ Error inserting site picture:', error);
    throw error;
  }
};

/**
 * Get site pictures by assessment ID
 */
export const getSitePicturesByAssessmentId = async (assessmentId) => {
  try {
    Logger.info('Fetching site pictures for assessment ID:', assessmentId);
    const result = await select('site_pictures', 'assessment_id = ?', [assessmentId]);
    Logger.info(`✅ Fetched ${result.length} site pictures.`);
    return result;
  } catch (error) {
    Logger.error('❌ Error fetching site pictures:', error);
    throw error;
  }
};

/**
 * Create basic information
 */
export const createBasicInformation = async (val) => {
  if (!val || !val.assessment_id) {
    Logger.error('Invalid input: assessment_id is required.');
    return Promise.reject(new Error('Invalid input: assessment_id is required.'));
  }

  Logger.info('Attempting to insert basic information with values:', val);

  try {
    const result = await insert('basic_information', {
      assessment_id: val.assessment_id,
      category: val.category || '',
      store: val.store || '',
      products: JSON.stringify(val.products || []),
      customers: JSON.stringify(val.customers || []),
      processes: JSON.stringify(val.processes || []),
      raw_materials: JSON.stringify(val.raw_materials || []),
      certifications: JSON.stringify(val.certifications || [])
    });
    Logger.info('✅ Basic information inserted successfully.', result);
    return result;
  } catch (error) {
    Logger.error('❌ Error inserting basic information:', error);
    throw error;
  }
};

/**
 * Get basic information by assessment ID
 */
export const getBasicInformationByAssessmentId = async (assessmentId) => {
  try {
    Logger.info('Fetching basic information for assessment ID:', assessmentId);
    const result = await select('basic_information', 'assessment_id = ?', [assessmentId]);

    if (result && result.length > 0) {
      const info = result[0];
      info.products = JSON.parse(info.products || '[]');
      info.customers = JSON.parse(info.customers || '[]');
      info.processes = JSON.parse(info.processes || '[]');
      info.raw_materials = JSON.parse(info.raw_materials || '[]');
      info.certifications = JSON.parse(info.certifications || '[]');
      Logger.info('✅ Basic information fetched successfully.');
      return info;
    }

    Logger.warn('Basic information not found.');
    return null;
  } catch (error) {
    Logger.error('❌ Error fetching basic information:', error);
    throw error;
  }
};

export default {
  createCalendarEvent,
  getCalendarEventById,
  getAllCalendarEvents,
  updateCalendarEvent,
  deleteCalendarEvent,
  createAssessment,
  getAssessmentById,
  getAllAssessments,
  updateAssessment,
  deleteAssessment,
  createSitePicture,
  getSitePicturesByAssessmentId,
  createBasicInformation,
  getBasicInformationByAssessmentId
};
