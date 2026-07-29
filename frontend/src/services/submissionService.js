/**
 * Submissions Service - Phase 4
 * Copy file này vào: frontend/src/services/submissionService.js
 * 
 * Quản lý các API calls cho Submissions
 */

import api from './api';

// ============ SUBMISSIONS ============

/**
 * Nộp bài cho checkpoint
 * @param {object} submissionData - { checkpoint_id, team_id, content, file_url? }
 */
export const createSubmission = async (submissionData) => {
  const response = await api.post('/submissions/', submissionData);
  return response.data;
};

/**
 * Upload submission file
 * @param {File} file - File object
 */
export const uploadSubmissionFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/submissions/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

/**
 * Lấy danh sách submissions
 * @param {object} options - { milestone_id?, team_id?, graded_only?, page?, limit? }
 */
export const getSubmissions = async (options = {}) => {
  const response = await api.get('/submissions/', { params: options });
  return response.data;
};

/**
 * Lấy chi tiết submission
 * @param {number} submissionId - ID của submission
 */
export const getSubmission = async (submissionId) => {
  const response = await api.get(`/submissions/${submissionId}`);
  return response.data;
};

/**
 * Cập nhật submission (trước khi chấm điểm)
 * @param {number} submissionId - ID của submission
 * @param {object} updateData - { title?, content?, file_url? }
 */
export const updateSubmission = async (submissionId, updateData) => {
  const response = await api.put(`/submissions/${submissionId}`, updateData);
  return response.data;
};

/**
 * Chấm điểm submission (chỉ Lecturer)
 * @param {number} submissionId - ID của submission
 * @param {object} gradeData - { score, feedback? }
 */
export const gradeSubmission = async (submissionId, gradeData) => {
  const response = await api.patch(`/submissions/${submissionId}/grade`, gradeData);
  return response.data;
};

/**
 * Xóa submission
 * @param {number} submissionId - ID của submission
 */
export const deleteSubmission = async (submissionId) => {
  await api.delete(`/submissions/${submissionId}`);
};


// ============ UTILITY FUNCTIONS ============

/**
 * Format điểm số với màu sắc
 * @param {number} score - Điểm từ 0-10
 */
export const formatScore = (score) => {
  if (score === null || score === undefined) {
    return { text: 'Chưa chấm', color: 'default' };
  }

  if (score >= 8) {
    return { text: score.toFixed(1), color: 'green' };
  } else if (score >= 6) {
    return { text: score.toFixed(1), color: 'blue' };
  } else if (score >= 5) {
    return { text: score.toFixed(1), color: 'orange' };
  } else {
    return { text: score.toFixed(1), color: 'red' };
  }
};

/**
 * Kiểm tra submission có thể edit không
 * @param {object} submission - Submission object
 */
export const canEditSubmission = (submission) => {
  return submission.score === null || submission.score === undefined;
};

/**
 * Format thời gian nộp
 * @param {string} submittedAt - ISO date string
 */
export const formatSubmissionTime = (submittedAt) => {
  const date = new Date(submittedAt);
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};


export default {
  createSubmission,
  uploadSubmissionFile,
  getSubmissions,
  getSubmission,
  updateSubmission,
  gradeSubmission,
  deleteSubmission,
  formatScore,
  canEditSubmission,
  formatSubmissionTime
};
