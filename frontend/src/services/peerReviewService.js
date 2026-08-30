/**
 * Peer Reviews Service - Phase 4
 * Copy file này vào: frontend/src/services/peerReviewService.js
 * 
 * Quản lý các API calls cho Peer Reviews
 */

import api from './api';

// ============ PEER REVIEWS ============

/**
 * Tạo peer review mới
 * @param {object} reviewData - { team_id, reviewee_id, score, feedback?, criteria? }
 */
export const createPeerReview = async (reviewData) => {
  const response = await api.post('/peer-reviews/', reviewData);
  return response.data;
};

/**
 * Lấy danh sách peer reviews của team
 * @param {number} teamId - ID của team
 * @param {string} revieweeId - (Optional) Filter theo người được review
 */
export const getTeamPeerReviews = async (teamId, revieweeId = null) => {
  const params = { team_id: teamId };
  if (revieweeId) params.reviewee_id = revieweeId;

  const response = await api.get('/peer-reviews/', { params });
  return response.data;
};

/**
 * Xem các reviews về mình (ẩn danh)
 * @param {number} teamId - ID của team
 */
export const getMyReviews = async (teamId) => {
  const response = await api.get('/peer-reviews/my-reviews', {
    params: { team_id: teamId }
  });
  return response.data;
};

/**
 * Lấy reviews mà mình đã được người khác review (About Me)
 * @param {number} teamId - ID của team
 */
export const getReviewsAboutMe = async (teamId) => {
  const response = await api.get('/peer-reviews/about-me', {
    params: { team_id: teamId }
  });
  return response.data;
};

/**
 * Lấy chi tiết review
 * @param {number} reviewId 
 */
export const getReviewDetail = async (reviewId) => {
  const response = await api.get(`/peer-reviews/${reviewId}`);
  return response.data;
};

/**
 * Lấy summary peer reviews của cả team (chỉ Lecturer)
 * @param {number} teamId - ID của team
 */
export const getTeamReviewSummary = async (teamId) => {
  const response = await api.get(`/peer-reviews/summary/${teamId}`);
  return response.data;
};

/**
 * Cập nhật peer review
 * @param {number} reviewId - ID của review
 * @param {object} updateData - { score?, feedback? }
 */
export const updatePeerReview = async (reviewId, updateData) => {
  const response = await api.put(`/peer-reviews/${reviewId}`, updateData);
  return response.data;
};

/**
 * Xóa peer review
 * @param {number} reviewId - ID của review
 */
export const deletePeerReview = async (reviewId) => {
  await api.delete(`/peer-reviews/${reviewId}`);
};


// ============ UTILITY FUNCTIONS ============

/**
 * Tính average score từ danh sách reviews
 * @param {array} reviews - Danh sách reviews
 */
export const calculateAverageScore = (reviews) => {
  if (!reviews || reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, r) => acc + r.score, 0);
  return (sum / reviews.length).toFixed(2);
};

/**
 * Kiểm tra đã review hết team chưa
 * @param {array} myReviews - Reviews mình đã tạo
 * @param {array} teamMembers - Danh sách team members
 * @param {string} myUserId - User ID của mình
 */
export const checkReviewProgress = (myReviews, teamMembers, myUserId) => {
  const reviewedIds = new Set(myReviews.map(r => r.reviewee_id));
  const toReview = teamMembers.filter(m =>
    m.user_id !== myUserId && !reviewedIds.has(m.user_id)
  );

  return {
    reviewed: myReviews.length,
    remaining: toReview.length,
    total: teamMembers.length - 1, // Trừ bản thân
    completed: toReview.length === 0
  };
};


export default {
  createPeerReview,
  getTeamPeerReviews,
  getMyReviews,
  getReviewsAboutMe,
  getReviewDetail,
  getTeamReviewSummary,
  updatePeerReview,
  deletePeerReview,
  calculateAverageScore,
  checkReviewProgress
};
