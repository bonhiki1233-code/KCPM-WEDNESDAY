/**
 * Meeting Service - Phase 3
 * Copy file này vào: frontend/src/services/meetingService.js
 * 
 * Quản lý các API calls cho Meetings và Video Calls
 */

import api from './api';
import Peer from 'peerjs';

// ============ MEETING API ============

/**
 * Tạo meeting mới
 * @param {object} meetingData - { team_id, title, start_time, end_time?, link_url? }
 */
export const scheduleMeeting = async (meetingData) => {
    const response = await api.post('/meetings/', meetingData);
    return response.data;
};

/**
 * Lấy danh sách meetings của team
 * @param {number} teamId - ID của team
 * @param {boolean} upcomingOnly - Chỉ lấy meetings sắp diễn ra
 */
export const getTeamMeetings = async (teamId, upcomingOnly = false) => {
    const response = await api.get('/meetings/', {
        params: {
            team_id: teamId,
            upcoming_only: upcomingOnly
        }
    });
    return response.data;
};

/**
 * Lấy chi tiết meeting
 * @param {number} meetingId - ID của meeting
 */
export const getMeeting = async (meetingId) => {
    const response = await api.get(`/meetings/${meetingId}`);
    return response.data;
};

/**
 * Cập nhật meeting
 * @param {number} meetingId - ID của meeting
 * @param {object} updateData - { title?, start_time?, end_time?, link_url? }
 */
export const updateMeeting = async (meetingId, updateData) => {
    const response = await api.put(`/meetings/${meetingId}`, updateData);
    return response.data;
};

/**
 * Hủy meeting
 * @param {number} meetingId - ID của meeting
 */
export const cancelMeeting = async (meetingId) => {
    await api.delete(`/meetings/${meetingId}`);
};

/**
 * Tham gia meeting
 * @param {number} meetingId - ID của meeting
 */
export const joinMeeting = async (meetingId) => {
    const response = await api.post(`/meetings/${meetingId}/join`);
    return response.data;
};


// ============ PEERJS VIDEO CALL ============

let peer = null;
let localStream = null;
const calls = new Map();
const remoteStreams = new Map();

/**
 * Khởi tạo PeerJS connection
 * @param {string} peerId - Unique peer ID (từ user_id)
 * @param {object} options - PeerJS options (optional)
 */
export const initPeer = (peerId, options = {}) => {
    return new Promise((resolve, reject) => {
        const isLocalHost = !import.meta.env.VITE_PEER_HOST || import.meta.env.VITE_PEER_HOST === 'localhost';

        // If it's localhost and we're not explicitly told to use it, default to cloud for cross-machine support
        const config = isLocalHost ? {
            debug: import.meta.env.DEV ? 2 : 0,
            ...options
        } : {
            host: import.meta.env.VITE_PEER_HOST,
            port: import.meta.env.VITE_PEER_PORT || 9000,
            path: '/peerjs',
            secure: import.meta.env.VITE_PEER_SECURE === 'true',
            debug: import.meta.env.DEV ? 2 : 0,
            ...options
        };

        console.log('🔗 Initializing PeerJS with:', peerId, isLocalHost ? '(Public Cloud)' : '(Custom Server)');

        peer = new Peer(peerId, config);

        peer.on('open', (id) => {
            console.log('✅ PeerJS connected with ID:', id);
            resolve(peer);
        });

        peer.on('error', (error) => {
            console.error('❌ PeerJS error:', error.type, error);
            reject(error);
        });

        peer.on('call', (call) => {
            console.log('📞 Received call from:', call.peer);
            handleIncomingCall(call);
        });
    });
};

/**
 * Lấy local media stream
 * @param {object} constraints - { video: boolean, audio: boolean }
 */
export const getLocalStream = async (constraints = { video: true, audio: true }) => {
    try {
        if (localStream) {
            const hasLiveTrack = localStream.getTracks().some(track => track.readyState === 'live');
            if (hasLiveTrack) {
                return localStream;
            }
        }
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        return localStream;
    } catch (error) {
        console.error('Failed to get local stream:', error);
        throw error;
    }
};

/**
 * Gọi video cho một peer khác
 * @param {string} remotePeerId - Peer ID của người nhận
 * @param {MediaStream} stream - Local media stream (optional, uses cached stream)
 */
export const callPeer = async (remotePeerId, stream = null) => {
    if (!peer) {
        throw new Error('PeerJS not initialized');
    }

    const mediaStream = stream || localStream;
    if (!mediaStream) {
        throw new Error('No media stream available');
    }

    const call = peer.call(remotePeerId, mediaStream);

    return new Promise((resolve, reject) => {
        call.on('stream', (remoteStream) => {
            console.log('📹 Received remote stream from:', remotePeerId);
            calls.set(remotePeerId, call);
            remoteStreams.set(remotePeerId, remoteStream);

            // Emit event for UI
            window.dispatchEvent(new CustomEvent('peer-stream', {
                detail: { peerId: remotePeerId, stream: remoteStream }
            }));
            resolve(remoteStream);
        });

        call.on('close', () => {
            console.log('Call closed with:', remotePeerId);
            calls.delete(remotePeerId);
            remoteStreams.delete(remotePeerId);

            // Emit event for UI to remove participant
            window.dispatchEvent(new CustomEvent('peer-disconnected', {
                detail: { peerId: remotePeerId }
            }));
        });

        call.on('error', (error) => {
            console.error('Call error:', error);
            reject(error);
        });
    });
};

/**
 * Handler cho incoming calls
 * @param {MediaConnection} call - PeerJS call object
 */
const handleIncomingCall = (call) => {
    console.log('📞 Incoming call from:', call.peer);

    // Tự động answer nếu có local stream
    if (localStream) {
        call.answer(localStream);

        call.on('stream', (remoteStream) => {
            console.log('📹 Received remote stream from:', call.peer);
            calls.set(call.peer, call);
            remoteStreams.set(call.peer, remoteStream);

            // Emit custom event để UI có thể handle
            window.dispatchEvent(new CustomEvent('peer-stream', {
                detail: { peerId: call.peer, stream: remoteStream }
            }));
        });

        call.on('close', () => {
            console.log('Call closed from:', call.peer);
            calls.delete(call.peer);
            remoteStreams.delete(call.peer);

            // Emit event for UI to remove participant
            window.dispatchEvent(new CustomEvent('peer-disconnected', {
                detail: { peerId: call.peer }
            }));
        });
    }
};

/**
 * Kết thúc cuộc gọi với peer cụ thể
 * @param {string} remotePeerId - Peer ID cần disconnect
 */
export const endCall = (remotePeerId) => {
    const call = calls.get(remotePeerId);
    if (call) {
        call.close();
        calls.delete(remotePeerId);
        remoteStreams.delete(remotePeerId);
    }
};

/**
 * Kết thúc tất cả cuộc gọi
 */
export const endAllCalls = () => {
    calls.forEach((call, peerId) => {
        call.close();
    });
    calls.clear();
    remoteStreams.clear();
};

/**
 * Tắt local stream và cleanup
 */
export const stopLocalStream = () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
};

/**
 * Disconnect PeerJS hoàn toàn
 */
export const disconnectPeer = () => {
    endAllCalls();
    stopLocalStream();

    if (peer) {
        peer.destroy();
        peer = null;
    }

    console.log('PeerJS disconnected');
};

/**
 * Lấy tất cả remote streams hiện tại
 */
export const getRemoteStreams = () => {
    return new Map(remoteStreams);
};

/**
 * Lấy PeerJS instance
 */
export const getPeer = () => peer;

/**
 * Toggle mute audio
 */
export const toggleAudio = () => {
    if (!localStream) return false;

    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
    }
    return false;
};

/**
 * Toggle video on/off
 */
export const toggleVideo = () => {
    if (!localStream) return false;

    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
    }
    return false;
};


// ============ UTILITY FUNCTIONS ============

/**
 * Format thời gian meeting
 * @param {string} dateString - ISO date string
 */
export const formatMeetingTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

/**
 * Kiểm tra meeting có đang diễn ra không
 * @param {object} meeting - Meeting object với start_time và end_time
 */
export const isMeetingActive = (meeting) => {
    const now = new Date();
    const start = new Date(meeting.start_time);
    const end = meeting.end_time ? new Date(meeting.end_time) : null;

    return now >= start && (!end || now <= end);
};

/**
 * Kiểm tra meeting sắp diễn ra (trong 15 phút tới)
 * @param {object} meeting - Meeting object
 */
export const isMeetingSoon = (meeting) => {
    const now = new Date();
    const start = new Date(meeting.start_time);
    const diff = start - now;

    return diff > 0 && diff <= 15 * 60 * 1000; // 15 minutes
};


export default {
    // API
    scheduleMeeting,
    getTeamMeetings,
    getMeeting,
    updateMeeting,
    cancelMeeting,
    joinMeeting,
    // PeerJS
    initPeer,
    getLocalStream,
    callPeer,
    endCall,
    endAllCalls,
    stopLocalStream,
    disconnectPeer,
    getRemoteStreams,
    getPeer,
    toggleAudio,
    toggleVideo,
    // Utilities
    formatMeetingTime,
    isMeetingActive,
    isMeetingSoon
};
