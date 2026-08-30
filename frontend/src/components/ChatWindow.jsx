import React, { useEffect, useRef, useState } from 'react';
import { Card, Typography, List, Empty, Spin } from 'antd';
import MessageItem from './MessageItem';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';

const { Title, Text } = Typography;

const ChatWindow = ({
    channel,
    messages,
    currentUserId,
    onSend,
    onTyping,
    onLoadMore,
    hasMore,
    loadingMessages,
    typingUsers
}) => {
    const scrollRef = useRef(null);
    const [isNearBottom, setIsNearBottom] = useState(true);

    useEffect(() => {
        const container = scrollRef.current;
        if (!container) return;

        if (isNearBottom) {
            container.scrollTop = container.scrollHeight;
        }
    }, [messages, isNearBottom]);

    const handleScroll = () => {
        const container = scrollRef.current;
        if (!container) return;

        const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
        setIsNearBottom(nearBottom);

        if (container.scrollTop <= 0 && hasMore && !loadingMessages) {
            onLoadMore();
        }
    };

    return (
        <Card
            title={
                channel ? (
                    <div>
                        <Title level={5} style={{ margin: 0 }}>{channel.name}</Title>
                        <Text type="secondary" style={{ fontSize: 12 }}>{channel.description || 'No description'}</Text>
                    </div>
                ) : (
                    <Title level={5} style={{ margin: 0 }}>Select a channel</Title>
                )
            }
            style={{ height: '100%', borderRadius: 16 }}
            styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' } }}
        >
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px 24px',
                    background: '#fafafa'
                }}
            >
                {loadingMessages && messages.length === 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 24 }}>
                        <Spin />
                    </div>
                ) : !messages.length ? (
                    <Empty description="No messages yet" />
                ) : (
                    <List
                        dataSource={messages}
                        renderItem={(message) => (
                            <MessageItem
                                key={message.id || message.message_id || message.temp_id}
                                message={message}
                                currentUserId={currentUserId}
                            />
                        )}
                    />
                )}
            </div>

            <TypingIndicator users={typingUsers} />

            <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0' }}>
                <MessageInput onSend={onSend} onTyping={onTyping} disabled={!channel} />
            </div>
        </Card>
    );
};

export default ChatWindow;
