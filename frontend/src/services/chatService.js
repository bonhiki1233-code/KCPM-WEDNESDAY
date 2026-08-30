/**
 * Chat Service - Phase 3 (FE1)
 * API calls for Channels & Messages
 */

import api from './api';

// ============ CHANNELS ============

export const createChannel = async (data) => {
    const response = await api.post('/channels', data);
    return response.data;
};

export const getChannels = async (teamId) => {
    const response = await api.get('/channels', {
        params: { team_id: teamId }
    });
    return response.data;
};

export const getChannel = async (channelId) => {
    const response = await api.get(`/channels/${channelId}`);
    return response.data;
};

export const deleteChannel = async (channelId) => {
    await api.delete(`/channels/${channelId}`);
};

// ============ MESSAGES ============

export const sendMessage = async (data) => {
    const response = await api.post('/messages', data);
    return response.data;
};

export const getMessages = async (channelId, { skip = 0, limit = 50 } = {}) => {
    const response = await api.get('/messages', {
        params: {
            channel_id: channelId,
            skip,
            limit
        }
    });
    if (Array.isArray(response.data?.messages)) return response.data.messages;
    if (Array.isArray(response.data?.items)) return response.data.items;
    return response.data;
};

export const getMessage = async (messageId) => {
    const response = await api.get(`/messages/${messageId}`);
    return response.data;
};

export const updateMessage = async (messageId, data) => {
    const response = await api.patch(`/messages/${messageId}`, data);
    return response.data;
};

export const deleteMessage = async (messageId) => {
    await api.delete(`/messages/${messageId}`);
};
