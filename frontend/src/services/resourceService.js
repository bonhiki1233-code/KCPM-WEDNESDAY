/**
 * Resources Service - Phase 4
 * Copy file này vào: frontend/src/services/resourceService.js
 * 
 * Quản lý các API calls cho Resources
 */

import api from './api';

// ============ RESOURCES ============

/**
 * Tạo resource mới
 * @param {object} resourceData - { project_id?, team_id?, title, description?, resource_type, url }
 */
export const createResource = async (resourceData) => {
  const response = await api.post('/resources/', resourceData);
  return response.data;
};

/**
 * Lấy danh sách resources
 * @param {object} options - { project_id?, team_id?, resource_type? }
 */
export const getResources = async (options = {}) => {
  const response = await api.get('/resources/', { params: options });
  return response.data;
};

/**
 * Lấy chi tiết resource
 * @param {number} resourceId - ID của resource
 */
export const getResource = async (resourceId) => {
  const response = await api.get(`/resources/${resourceId}`);
  return response.data;
};

/**
 * Cập nhật resource
 * @param {number} resourceId - ID của resource
 * @param {object} updateData - { title?, description?, resource_type?, url? }
 */
export const updateResource = async (resourceId, updateData) => {
  const response = await api.put(`/resources/${resourceId}`, updateData);
  return response.data;
};

/**
 * Xóa resource
 * @param {number} resourceId - ID của resource
 */
export const deleteResource = async (resourceId) => {
  await api.delete(`/resources/${resourceId}`);
};

/**
 * Upload file lên server
 * @param {File} file - File object từ input
 */
export const uploadResourceFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post('/resources/upload-file', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};


// ============ RESOURCE TYPES ============

export const RESOURCE_TYPES = {
  DOCUMENT: 'document',
  PDF: 'pdf',
  LINK: 'link',
  VIDEO: 'video',
  IMAGE: 'image',
  PRESENTATION: 'presentation',
  SPREADSHEET: 'spreadsheet',
  CODE: 'code',
  OTHER: 'other'
};

export const RESOURCE_TYPE_LABELS = {
  document: { label: 'Tài liệu', icon: '📄', color: 'blue' },
  pdf: { label: 'PDF', icon: '📕', color: 'red' },
  link: { label: 'Liên kết', icon: '🔗', color: 'cyan' },
  video: { label: 'Video', icon: '🎬', color: 'red' },
  image: { label: 'Hình ảnh', icon: '🖼️', color: 'green' },
  presentation: { label: 'Trình chiếu', icon: '📊', color: 'orange' },
  spreadsheet: { label: 'Bảng tính', icon: '📈', color: 'lime' },
  code: { label: 'Code', icon: '💻', color: 'purple' },
  other: { label: 'Khác', icon: '📁', color: 'default' }
};


// ============ UTILITY FUNCTIONS ============

/**
 * Lấy label và icon cho resource type
 * @param {string} type - Resource type
 */
export const getResourceTypeInfo = (type) => {
  return RESOURCE_TYPE_LABELS[type] || RESOURCE_TYPE_LABELS.other;
};

/**
 * Nhóm resources theo type
 * @param {array} resources - Danh sách resources
 */
export const groupResourcesByType = (resources) => {
  const groups = {};
  
  resources.forEach(resource => {
    const type = resource.resource_type || 'other';
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(resource);
  });
  
  return groups;
};

/**
 * Kiểm tra URL có hợp lệ không
 * @param {string} url - URL cần kiểm tra
 */
export const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Trích xuất tên file từ URL
 * @param {string} url - URL của file
 */
export const extractFilename = (url) => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    return pathname.split('/').pop() || url;
  } catch {
    return url;
  }
};

/**
 * Detect resource type từ URL hoặc filename
 * @param {string} url - URL hoặc filename của resource
 */
export const detectResourceType = (url) => {
  const urlLower = url.toLowerCase();
  
  // PDF
  if (urlLower.match(/\.(pdf)$/)) {
    return 'pdf';
  }
  
  // Documents
  if (urlLower.match(/\.(doc|docx|txt|odt)$/)) {
    return 'document';
  }
  
  // Spreadsheets
  if (urlLower.match(/\.(xls|xlsx|csv|ods)$/) || urlLower.includes('sheets.google.com')) {
    return 'spreadsheet';
  }
  
  // Presentations
  if (urlLower.match(/\.(ppt|pptx|odp)$/) || urlLower.includes('slides.google.com')) {
    return 'presentation';
  }
  
  // Images
  if (urlLower.match(/\.(jpg|jpeg|png|gif|svg|webp|bmp)$/)) {
    return 'image';
  }
  
  // Videos
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be') || 
      urlLower.includes('vimeo.com') || urlLower.match(/\.(mp4|webm|avi|mov|mkv)$/)) {
    return 'video';
  }
  
  // Code repositories
  if (urlLower.includes('github.com') || urlLower.includes('gitlab.com') ||
      urlLower.includes('bitbucket.org') || urlLower.match(/\.(js|ts|py|java|cpp|c|html|css)$/)) {
    return 'code';
  }
  
  // Web links
  if (urlLower.startsWith('http://') || urlLower.startsWith('https://')) {
    return 'link';
  }
  
  // Default to other
  return 'other';
};


export default {
  createResource,
  getResources,
  getResource,
  updateResource,
  deleteResource,
  RESOURCE_TYPES,
  RESOURCE_TYPE_LABELS,
  getResourceTypeInfo,
  groupResourcesByType,
  isValidUrl,
  extractFilename,
  detectResourceType
};
