// Endpoint: POST /application-assessments/{assessmentId}/questions/{questionId}/clarification/{feedbackId}
const updateQuestionClarification = async (assessmentId, questionId, feedbackId, formData) => {
  try {
    const response = await userClient.post(`/application-assessments/${assessmentId}/questions/${questionId}/clarification/${feedbackId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    Logger.info('Response in AssessmentService.updateQuestionClarification:', response);
    return response.data;
  } catch (error) {
    Logger.error('Error in AssessmentService.updateQuestionClarification:', error.message);
    throw error;
  }
};

import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';
import { buildPaginationParams } from '../utils/pagination';

// Filter params shared by the assessment list and its CSV export, so an exported file
// always covers exactly the rows the list is showing. Pagination is added by the caller.
const buildAssessmentFilterParams = (params = {}) => {
  const queryParams = {};

  if (params.status) {
    queryParams.status = params.status;
  }
  if (params.applicationId) {
    queryParams.applicationId = params.applicationId;
  }
  if (params.assessmentType) {
    queryParams.assessmentType = params.assessmentType;
  }

  if (params.search) {
    queryParams.search = params.search;
  }
  if (params.enterpriseSize) {
    queryParams.enterpriseSize = params.enterpriseSize;
  }
  if (params.vendorCategory) {
    queryParams.vendorCategory = params.vendorCategory;
  }
  if (params.rating) {
    queryParams.certificationLevel = params.rating;
  }
  if (params.sector) {
    queryParams.sector = params.sector;
  }
  if (params.assessmentStartDate) {
    queryParams.startDate = params.assessmentStartDate;
  }
  // Each bound is applied independently server-side, so a start date on its own means
  // "from that date onwards". Defaulting the end to the start turned it into a
  // single-day filter, which is not what a Start Date picker promises.
  if (params.assessmentEndDate) {
    queryParams.endDate = params.assessmentEndDate;
  }
  // Separate keys: both filters used to write assessorId, so narrowing by lead and
  // co-assessor together silently dropped the lead.
  if (params.leadAssessor) {
    queryParams.leadAssessorId = params.leadAssessor;
  }
  if (params.coAssessor) {
    queryParams.coAssessorId = params.coAssessor;
  }

  return queryParams;
};

const SystemAdminAssessmentService = () => {
  // Get all assessments with optional filters
  const getAssessments = async (params = {}) => {
    try {
      const queryParams = buildAssessmentFilterParams(params);

      // Pagination
      if (params.page) {
        queryParams.page = params.page;
      }
      if (params.perPage) {
        queryParams.perPage = params.perPage;
      }

      const response = await userClient.get('/assessments', { params: queryParams });
      Logger.info('Response in AssessmentService.getAssessments:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.getAssessments:', error.message);
      throw error;
    }
  };

  // Get assessment by ID
  const getAssessmentById = async id => {
    try {
      const response = await userClient.get(`/assessments/${id}`);
      Logger.info('Response in AssessmentService.getAssessmentById:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.getAssessmentById:', error.message);
      throw error;
    }
  };

  // Schedule assessment (allocate assessors) - Operations Manager
  const scheduleAssessment = async (assessmentId, data) => {
    try {
      const response = await userClient.post(`/assessments/${assessmentId}/schedule`, data);
      Logger.info('Response in AssessmentService.scheduleAssessment:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.scheduleAssessment:', error.message);
      throw error;
    }
  };

  // Start an assessment (Assessor) — moves scheduled → in_progress so field
  // execution (opening meeting onward) can begin on web.
  const startAssessment = async assessmentId => {
    try {
      const response = await userClient.post(`/assessments/${assessmentId}/start`);
      Logger.info('Response in AssessmentService.startAssessment:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.startAssessment:', error.message);
      throw error;
    }
  };

  // Submit assessment for QC (Lead Assessor)
  const submitAssessmentForQc = async assessmentId => {
    try {
      const response = await userClient.post(`/assessments/${assessmentId}/submit-for-qc`);
      Logger.info('Response in AssessmentService.submitAssessmentForQc:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.submitAssessmentForQc:', error.message);
      throw error;
    }
  };

  // Co-assessor web submit — signs off the co-assessor's portion so the lead can submit for QC
  const coAssessorSubmit = async assessmentId => {
    try {
      const response = await userClient.post(`/assessments/${assessmentId}/co-assessor-submit`);
      Logger.info('Response in AssessmentService.coAssessorSubmit:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.coAssessorSubmit:', error.message);
      throw error;
    }
  };

  // QC Decision (Operations Manager) - approve for committee or provide feedback
  const qcDecision = async (assessmentId, data) => {
    try {
      const response = await userClient.post(`/assessments/${assessmentId}/qc-decision`, data);
      Logger.info('Response in AssessmentService.qcDecision:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.qcDecision:', error.message);
      throw error;
    }
  };

  // Resubmit assessment for QC after addressing feedback (Assessor)
  const resubmitForQc = async (assessmentId, data) => {
    try {
      const response = await userClient.post(`/assessments/${assessmentId}/address-qc-feedback`, data);
      Logger.info('Response in AssessmentService.resubmitForQc:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.resubmitForQc:', error.message);
      throw error;
    }
  };

  // Schedule committee review (Operations Manager/Admin)
  const scheduleCommittee = async (assessmentId, data) => {
    try {
      const response = await userClient.post(`/assessments/${assessmentId}/schedule-committee`, data);
      Logger.info('Response in AssessmentService.scheduleCommittee:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.scheduleCommittee:', error.message);
      throw error;
    }
  };

  // Resubmit assessment to committee after addressing feedback (Assessor)
  const resubmitToCommittee = async (assessmentId, data) => {
    try {
      const response = await userClient.post(`/assessments/${assessmentId}/address-committee-feedback`, data);
      Logger.info('Response in AssessmentService.resubmitToCommittee:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.resubmitToCommittee:', error.message);
      throw error;
    }
  };

  // Get available workflow transitions for assessment
  const getAvailableTransitions = async assessmentId => {
    try {
      const response = await userClient.get(`/assessments/${assessmentId}/available-transitions`);
      Logger.info('Response in AssessmentService.getAvailableTransitions:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.getAvailableTransitions:', error.message);
      throw error;
    }
  };

  // Committee decision (certify / provide feedback)
  const committeeDecision = async (assessmentId, data) => {
    try {
      const response = await userClient.post(`/assessments/${assessmentId}/committee-decision`, data);
      Logger.info('Response in AssessmentService.committeeDecision:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.committeeDecision:', error.message);
      throw error;
    }
  };
  const downloadCertificate = async id => {
    try {
      const response = await userClient.get(`/certificates/${id}/download?download=true`, {
        responseType: 'blob',
      });
      Logger.info('Response in DocumentService.downloadDocument:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in DocumentService.downloadDocument:', error.message);
      throw error;
    }
  };
  const downloadAssessmentReportCertificate = async id => {
    try {
      const response = await userClient.get(`/assessments/${id}/assessment-report/download`, {
        responseType: 'blob',
      });
      Logger.info('Response in DocumentService.downloadDocument:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in DocumentService.downloadDocument:', error.message);
      throw error;
    }
  };
  // Bulk update RC scores for assessment responses
  const updateRcScores = async (assessmentId, data) => {
    try {
      const response = await userClient.put(`/assessments/${assessmentId}/rc-scores`, data);
      Logger.info('Response in AssessmentService.updateRcScores:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.updateRcScores:', error.message);
      throw error;
    }
  };

  // Assessment Question APIs

  // Get all assessment questions
  const getAssessmentQuestions = async () => {
    try {
      const response = await userClient.get('/assessment-questions');
      Logger.info('Response in AssessmentService.getAssessmentQuestions:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.getAssessmentQuestions:', error.message);
      throw error;
    }
  };

  // Get assessment question by ID
  const getAssessmentQuestionById = async id => {
    try {
      const response = await userClient.get(`/assessment-questions/${id}`);
      Logger.info('Response in AssessmentService.getAssessmentQuestionById:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.getAssessmentQuestionById:', error.message);
      throw error;
    }
  };

  // Post clarification for a question (Assessor) - multipart/form-data
  // Endpoint: POST /application-assessments/{assessmentId}/questions/{questionId}/clarification
  const postQuestionClarification = async (assessmentId, questionId, formData) => {
    try {
      const response = await userClient.post(`/application-assessments/${assessmentId}/questions/${questionId}/clarification`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      Logger.info('Response in AssessmentService.postQuestionClarification:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.postQuestionClarification:', error.message);
      throw error;
    }
  };

  // Get assessors list (users with assessor role)
  const getAssessors = async (params = {}) => {
    try {
      const queryString = buildPaginationParams(params);
      const url = `/users${queryString}`;
      const response = await userClient.get(url);
      Logger.info('Response in AssessmentService.getAssessors:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.getAssessors:', error.message);
      throw error;
    }
  };

  // Export the assessment list as CSV. Same filters as getAssessments, no pagination —
  // responseType 'text' is required so the caller can build a Blob from the body.
  const exportAssessments = async (params = {}) => {
    try {
      const response = await userClient.get('/assessments/export', {
        params: buildAssessmentFilterParams(params),
        responseType: 'text',
      });
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.exportAssessments:', error.message);
      throw error;
    }
  };

  return {
    getAssessments,
    exportAssessments,
    getAssessmentById,
    scheduleAssessment,
    startAssessment,
    submitAssessmentForQc,
    coAssessorSubmit,
    qcDecision,
    resubmitForQc,
    scheduleCommittee,
    committeeDecision,
    updateRcScores,
    resubmitToCommittee,
    getAvailableTransitions,
    getAssessmentQuestions,
    getAssessmentQuestionById,
    postQuestionClarification,
    updateQuestionClarification,
    getAssessors,
    downloadCertificate,
    downloadAssessmentReportCertificate,
  };
};

export default SystemAdminAssessmentService;
