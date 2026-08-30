/**
 * Milestones Service - Phase 4
 * Copy file này vào: frontend/src/services/milestoneService.js
 * 
 * Quản lý các API calls cho Milestones và Checkpoints
 */

import api from './api';

// ============ MILESTONES ============

/**
 * Tạo milestone mới
 * @param {object} milestoneData - { project_id, title, description?, due_date? }
 */
export const createMilestone = async (milestoneData) => {
  const response = await api.post('/milestones/', milestoneData);
  return response.data;
};

/**
 * Lấy danh sách milestones của lớp
 * @param {number} classId - ID của class
 */
export const getClassMilestones = async (classId) => {
  const response = await api.get('/milestones/', {
    params: { class_id: classId }
  });
  return response.data;
};

/**
 * Lấy chi tiết milestone (bao gồm checkpoints)
 * @param {number} milestoneId - ID của milestone
 */
export const getMilestone = async (milestoneId) => {
  const response = await api.get(`/milestones/${milestoneId}`);
  return response.data;
};

/**
 * Cập nhật milestone
 * @param {number} milestoneId - ID của milestone
 * @param {object} updateData - { title?, description?, due_date?, completed? }
 */
export const updateMilestone = async (milestoneId, updateData) => {
  const response = await api.put(`/milestones/${milestoneId}`, updateData);
  return response.data;
};

/**
 * Xóa milestone
 * @param {number} milestoneId - ID của milestone
 */
export const deleteMilestone = async (milestoneId) => {
  await api.delete(`/milestones/${milestoneId}`);
};


// ============ CHECKPOINTS ============

/**
 * Tạo checkpoint mới
 * @param {number} milestoneId - ID của milestone
 * @param {object} checkpointData - { milestone_id, team_id, title, status? }
 */
export const createCheckpoint = async (milestoneId, checkpointData) => {
  const response = await api.post(`/milestones/${milestoneId}/checkpoints`, checkpointData);
  return response.data;
};

/**
 * Lấy danh sách checkpoints của milestone
 * @param {number} milestoneId - ID của milestone
 * @param {number} teamId - ID của team (optional)
 */
export const listCheckpoints = async (milestoneId, teamId) => {
  const response = await api.get(`/milestones/${milestoneId}/checkpoints`, {
    params: teamId ? { team_id: teamId } : undefined
  });
  return response.data;
};

/**
 * Cập nhật checkpoint
 * @param {number} checkpointId - ID của checkpoint
 * @param {object} updateData - { title?, description?, completed?, order? }
 */
export const updateCheckpoint = async (checkpointId, updateData) => {
  const response = await api.put(`/milestones/checkpoints/${checkpointId}`, updateData);
  return response.data;
};

/**
 * Xóa checkpoint
 * @param {number} checkpointId - ID của checkpoint
 */
export const deleteCheckpoint = async (checkpointId) => {
  await api.delete(`/milestones/checkpoints/${checkpointId}`);
};


// ============ UTILITY FUNCTIONS ============

/**
 * Tính progress của milestone dựa trên checkpoints
 * @param {object} milestone - Milestone với checkpoints
 */
export const calculateMilestoneProgress = (milestone) => {
  if (!milestone.checkpoints || milestone.checkpoints.length === 0) {
    return milestone.completed ? 100 : 0;
  }

  const completed = milestone.checkpoints.filter(cp => cp.completed).length;
  return Math.round((completed / milestone.checkpoints.length) * 100);
};

/**
 * Kiểm tra milestone có quá hạn không
 * @param {object} milestone - Milestone object
 */
export const isMilestoneOverdue = (milestone) => {
  if (!milestone.due_date) return false;
  if (milestone.completed) return false;

  return new Date(milestone.due_date) < new Date();
};

/**
 * Format due date cho hiển thị
 * @param {string} dueDate - ISO date string
 */
export const formatDueDate = (dueDate) => {
  if (!dueDate) return 'Không có deadline';

  const date = new Date(dueDate);
  const now = new Date();
  const diff = date - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return `Quá hạn ${Math.abs(days)} ngày`;
  } else if (days === 0) {
    return 'Hôm nay';
  } else if (days === 1) {
    return 'Ngày mai';
  } else if (days <= 7) {
    return `Còn ${days} ngày`;
  } else {
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
};


export default {
  createMilestone,
  getClassMilestones,
  getMilestone,
  updateMilestone,
  deleteMilestone,
  createCheckpoint,
  listCheckpoints,
  updateCheckpoint,
  deleteCheckpoint,
  calculateMilestoneProgress,
  isMilestoneOverdue,
  formatDueDate
};
