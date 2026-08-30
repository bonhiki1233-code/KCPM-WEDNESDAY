import React from 'react';
import { Avatar, Typography } from 'antd';
import dayjs from 'dayjs';

const { Text } = Typography;

const MessageItem = ({ message, currentUserId }) => {
    const senderId = message.sender_id || message.sender?.id || message.sender?.user_id;
    const isOwn = currentUserId && senderId && String(senderId) === String(currentUserId);
    const senderName =
        message.sender_name ||
        message.sender?.full_name ||
        message.sender?.name ||
        message.sender?.email ||
        'Unknown';
    const createdAt = message.created_at || message.sent_at || message.timestamp;

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: isOwn ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                gap: 12,
                marginBottom: 16
            }}
        >
            <Avatar src={message.sender_avatar} style={{ backgroundColor: '#1890ff' }}>
                {senderName.charAt(0).toUpperCase()}
            </Avatar>
            <div style={{ maxWidth: '75%' }}>
                <div style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', gap: 8 }}>
                    <Text strong>{isOwn ? 'You' : senderName}</Text>
                    {createdAt && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            {dayjs(createdAt).format('HH:mm')}
                        </Text>
                    )}
                </div>
                <div
                    style={{
                        background: isOwn ? '#1890ff' : '#f5f5f5',
                        color: isOwn ? '#fff' : '#262626',
                        padding: '8px 12px',
                        borderRadius: 12,
                        marginTop: 4,
                        wordBreak: 'break-word'
                    }}
                >
                    {message.content || message.message || ''}
                </div>
            </div>
        </div>
    );
};

export default MessageItem;
