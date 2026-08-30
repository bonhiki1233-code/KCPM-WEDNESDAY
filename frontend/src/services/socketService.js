/**
 * Socket Service - Phase 3
 * Copy file này vào: frontend/src/services/socketService.js
 * 
 * Quản lý WebSocket connections cho real-time features
 */

import { io } from 'socket.io-client';

// Socket.IO instance
let socket = null;

// Event listeners storage
const listeners = new Map();

/**
 * Khởi tạo Socket.IO connection
 * @param {string} token - JWT access token
 */
export const initSocket = (token) => {
    if (socket && socket.connected) {
        console.log('Socket already connected');
        return socket;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000';

    socket = io(socketUrl, {
        auth: {
            token: token
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000
    });

    // Connection events
    socket.on('connect', () => {
        console.log('✅ Socket connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error.message);
    });

    return socket;
};

/**
 * Đóng kết nối Socket
 */
export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
        listeners.clear();
        console.log('Socket disconnected manually');
    }
};

/**
 * Lấy socket instance hiện tại
 */
export const getSocket = () => socket;

/**
 * Kiểm tra socket đã connected chưa
 */
export const isConnected = () => socket && socket.connected;


// ============ CHANNEL/CHAT EVENTS ============

/**
 * Join vào room của channel
 * @param {number} channelId - ID của channel
 */
export const joinChannel = (channelId) => {
    if (!socket) return;
    socket.emit('join_channel', { channel_id: channelId });
    console.log(`Joined channel: ${channelId}`);
};

/**
 * Leave room của channel
 * @param {number} channelId - ID của channel
 */
export const leaveChannel = (channelId) => {
    if (!socket) return;
    socket.emit('leave_channel', { channel_id: channelId });
    console.log(`Left channel: ${channelId}`);
};

/**
 * Gửi tin nhắn qua socket (real-time)
 * @param {number} channelId - ID của channel
 * @param {string} content - Nội dung tin nhắn
 */
export const sendMessageSocket = (channelId, content) => {
    if (!socket) return;
    socket.emit('new_message', {
        channel_id: channelId,
        content: content
    });
};

/**
 * Lắng nghe tin nhắn mới
 * @param {function} callback - Handler function(message)
 */
export const onNewMessage = (callback) => {
    if (!socket) return;
    socket.on('message_received', callback);
    listeners.set('message_received', callback);
};

/**
 * Lắng nghe tin nhắn được cập nhật
 * @param {function} callback - Handler function(message)
 */
export const onMessageUpdated = (callback) => {
    if (!socket) return;
    socket.on('message_updated', callback);
    listeners.set('message_updated', callback);
};

/**
 * Lắng nghe tin nhắn bị xóa
 * @param {function} callback - Handler function({ message_id, channel_id })
 */
export const onMessageDeleted = (callback) => {
    if (!socket) return;
    socket.on('message_deleted', callback);
    listeners.set('message_deleted', callback);
};

/**
 * Lắng nghe typing indicator
 * @param {function} callback - Handler function({ user_id, user_name, channel_id })
 */
export const onTyping = (callback) => {
    if (!socket) return;
    socket.on('user_typing', callback);
    listeners.set('user_typing', callback);
};

/**
 * Gửi typing indicator
 * @param {number} channelId - ID của channel
 */
export const sendTyping = (channelId) => {
    if (!socket) return;
    socket.emit('typing', { channel_id: channelId });
};


// ============ NOTIFICATION EVENTS ============

/**
 * Lắng nghe notifications
 * @param {function} callback - Handler function(notification)
 */
export const onNotification = (callback) => {
    if (!socket) return;
    socket.on('notification', callback);
    listeners.set('notification', callback);
};


// ============ TEAM EVENTS ============

/**
 * Join vào room của team (để nhận cập nhật team-wide)
 * @param {number} teamId - ID của team
 */
export const joinTeam = (teamId) => {
    if (!socket) return;
    socket.emit('join_team', { team_id: teamId });
};

/**
 * Leave room của team
 * @param {number} teamId - ID của team
 */
export const leaveTeam = (teamId) => {
    if (!socket) return;
    socket.emit('leave_team', { team_id: teamId });
};

/**
 * Lắng nghe task updates
 * @param {function} callback - Handler function(task)
 */
export const onTaskUpdated = (callback) => {
    if (!socket) return;
    socket.on('task_updated', callback);
    listeners.set('task_updated', callback);
};


// ============ CLEANUP ============

/**
 * Xóa tất cả listeners
 */
export const removeAllListeners = () => {
    if (!socket) return;

    listeners.forEach((callback, event) => {
        socket.off(event, callback);
    });
    listeners.clear();
};

/**
 * Xóa listener cụ thể
 * @param {string} event - Tên event
 */
export const removeListener = (event) => {
    if (!socket || !listeners.has(event)) return;

    socket.off(event, listeners.get(event));
    listeners.delete(event);
};


export default {
    initSocket,
    disconnectSocket,
    getSocket,
    isConnected,
    joinChannel,
    leaveChannel,
    sendMessageSocket,
    onNewMessage,
    onTyping,
    sendTyping,
    onNotification,
    joinTeam,
    leaveTeam,
    onTaskUpdated,
    removeAllListeners,
    removeListener
};
