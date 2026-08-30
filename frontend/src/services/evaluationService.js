/**
 * Evaluation Service - Phase 4 (FE1)
 */

import api from './api';

export const listCriteriaScores = async (evaluationId) => {
    const response = await api.get(`/evaluations/${evaluationId}/details`);
    return response.data;
};

export const addCriteriaScore = async (evaluationId, payload) => {
    const response = await api.post(`/evaluations/${evaluationId}/details`, payload);
    return response.data;
};

export const updateCriteriaScore = async (evaluationId, criteriaId, payload) => {
    const response = await api.put(`/evaluations/${evaluationId}/details/${criteriaId}`, payload);
    return response.data;
};

export const getEvaluationSummary = async (evaluationId) => {
    const response = await api.get(`/evaluations/${evaluationId}/summary`);
    return response.data;
};

export const getIndividualScores = async (evaluationId) => {
    const response = await api.get(`/evaluations/${evaluationId}/individual-scores`);
    return response.data;
};

export default {
    listCriteriaScores,
    addCriteriaScore,
    updateCriteriaScore,
    getEvaluationSummary,
    getIndividualScores
};
