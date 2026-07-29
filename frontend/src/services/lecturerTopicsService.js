import apiClient from './apiClient';

export const lecturerTopicsService = {
    listTopics: () => apiClient.get('/topics'),
    createTopic: (payload) => apiClient.post('/topics', payload),
    deleteTopic: (topicId) => apiClient.delete(`/topics/${topicId}`),
    approveTopic: (topicId) => apiClient.patch(`/topics/${topicId}/approve`),
    rejectTopic: (topicId) => apiClient.patch(`/topics/${topicId}/reject`),
    createEvaluation: (topicId, payload) => apiClient.post(`/topics/evaluations/${topicId}`, payload),
};
