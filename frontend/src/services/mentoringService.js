/**
 * Mentoring Service - Phase 4
 * Copy file này vào: frontend/src/services/mentoringService.js
 * 
 * Quản lý các API calls cho AI Mentoring
 */

import api from './api';

// ============ MENTORING LOGS ============

/**
 * Tạo mentoring log mới
 * @param {object} logData - { team_id, session_notes?, discussion_points?, meeting_date? }
 */
export const createMentoringLog = async (logData) => {
  const response = await api.post('/mentoring/logs', logData);
  return response.data;
};

/**
 * Lấy danh sách mentoring logs của team
 * @param {number} teamId - ID của team
 */
export const getTeamMentoringLogs = async (teamId) => {
  const response = await api.get('/mentoring/logs', {
    params: { team_id: teamId }
  });
  return response.data;
};

/**
 * Lấy chi tiết mentoring log
 * @param {number} logId - ID của log
 */
export const getMentoringLog = async (logId) => {
  const response = await api.get(`/mentoring/logs/${logId}`);
  return response.data;
};

/**
 * Cập nhật mentoring log
 * @param {number} logId - ID của log
 * @param {object} updateData - { session_notes?, discussion_points?, feedback? }
 */
export const updateMentoringLog = async (logId, updateData) => {
  const response = await api.put(`/mentoring/logs/${logId}`, updateData);
  return response.data;
};

/**
 * Xóa mentoring log
 * @param {number} logId - ID của log
 */
export const deleteMentoringLog = async (logId) => {
  await api.delete(`/mentoring/logs/${logId}`);
};


// ============ AI SUGGESTIONS ============

/**
 * Tạo AI suggestions cho mentoring log
 * @param {number} logId - ID của log
 * @param {object} requestData - { team_id, context? }
 */
export const generateAISuggestions = async (teamId, requestData) => {
  const response = await api.post('/mentoring/suggestions', requestData, {
    params: { team_id: teamId }
  });
  return response.data;
};

export const getTeamProgress = async (teamId) => {
  const response = await api.get(`/mentoring/team-progress/${teamId}`);
  return response.data;
};

export const analyzePeerReviews = async (teamId, requestData = {}) => {
  const response = await api.post(`/mentoring/analyze-reviews/${teamId}`, requestData);
  return response.data;
};


export default {
  createMentoringLog,
  getTeamMentoringLogs,
  getMentoringLog,
  updateMentoringLog,
  deleteMentoringLog,
  generateAISuggestions,
  getTeamProgress,
  analyzePeerReviews
};
