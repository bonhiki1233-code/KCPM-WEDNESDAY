import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Typography, message as toast } from 'antd';
import MainLayout from '../components/MainLayout';
import ChatSidebar from '../components/ChatSidebar';
import ChatWindow from '../components/ChatWindow';
import { useAuth } from '../components/AuthContext';
import { teamService } from '../services/api';
import { createChannel, getChannels, getMessages, sendMessage } from '../services/chatService';
import {
    joinChannel,
    leaveChannel,
    onNewMessage,
    onTyping,
    onMessageUpdated,
    onMessageDeleted,
    sendTyping
} from '../services/socketService';
import './TeamChat.css';

const { Title, Text } = Typography;

const PAGE_SIZE = 50;

const normalizeMessages = (items = []) => {
    const list = Array.isArray(items) ? items : [];
    return [...list].sort((a, b) => {
        const aTime = new Date(a.created_at || a.sent_at || a.timestamp || 0).getTime();
        const bTime = new Date(b.created_at || b.sent_at || b.timestamp || 0).getTime();
        return aTime - bTime;
    });
};

const mergeMessages = (existing, incoming) => {
    const map = new Map();
    [...existing, ...incoming].forEach((msg) => {
        const key = msg.id || msg.message_id || msg.temp_id;
        if (key) {
            map.set(String(key), msg);
        } else {
            map.set(`${msg.sender_id || 'unknown'}-${msg.created_at || msg.content}`, msg);
        }
    });
    return normalizeMessages(Array.from(map.values()));
};

const TeamChat = () => {
    const { user } = useAuth();
    const currentUserId = user?.user_id || user?.id;

    const [teams, setTeams] = useState([]);
    const [selectedTeamId, setSelectedTeamId] = useState(null);
    const [channels, setChannels] = useState([]);
    const [selectedChannel, setSelectedChannel] = useState(null);
    const [messages, setMessages] = useState([]);
    const [hasMore, setHasMore] = useState(true);
    const [loadingChannels, setLoadingChannels] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [typingUsers, setTypingUsers] = useState([]);

    const selectedChannelId = selectedChannel?.id || selectedChannel?.channel_id;
    const messagesRef = useRef([]);
    const typingTimeoutsRef = useRef(new Map());

    useEffect(() => {
        const fetchTeams = async () => {
            try {
                const res = await teamService.getAll();
                const list = (Array.isArray(res?.data?.teams)
                    ? res.data.teams
                    : Array.isArray(res?.data)
                        ? res.data
                        : []).filter(t => t.is_member);
                setTeams(list);
                if (list.length) {
                    setSelectedTeamId(list[0].team_id || list[0].id);
                }
            } catch (error) {
                console.error('Failed to fetch teams', error);
                toast.error('Failed to load teams');
            }
        };
        fetchTeams();
    }, []);

    useEffect(() => {
        const fetchChannels = async () => {
            if (!selectedTeamId) {
                setChannels([]);
                setSelectedChannel(null);
                return;
            }
            setLoadingChannels(true);
            try {
                const res = await getChannels(selectedTeamId);
                const list = res?.items || res?.data || res || [];
                setChannels(list);
                setSelectedChannel(list[0] || null);
            } catch (error) {
                console.error('Failed to load channels', error);
                toast.error('Failed to load channels');
            } finally {
                setLoadingChannels(false);
            }
        };
        fetchChannels();
    }, [selectedTeamId]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        if (!selectedChannelId) {
            setMessages([]);
            setHasMore(false);
            return;
        }

        joinChannel(selectedChannelId);
        loadMessages(true);

        return () => {
            leaveChannel(selectedChannelId);
        };
    }, [selectedChannelId]);

    const loadMessages = async (reset = false) => {
        if (!selectedChannelId || loadingMessages) return;
        setLoadingMessages(true);
        try {
            const skip = reset ? 0 : messagesRef.current.length;
            const res = await getMessages(selectedChannelId, { skip, limit: PAGE_SIZE });
            const list = res?.items || res?.data || res || [];
            const normalized = normalizeMessages(list);

            if (reset) {
                setMessages(normalized);
            } else {
                setMessages((prev) => mergeMessages(prev, normalized));
            }
            setHasMore(list.length === PAGE_SIZE);
        } catch (error) {
            console.error('Failed to load messages', error);
            toast.error('Failed to load messages');
        } finally {
            setLoadingMessages(false);
        }
    };

    const handleSendMessage = async (content) => {
        if (!selectedChannelId) return;
        try {
            const res = await sendMessage({ channel_id: selectedChannelId, content });
            const messageData = res?.message || res?.data || res;
            if (messageData) {
                setMessages((prev) => mergeMessages(prev, [messageData]));
            }
        } catch (error) {
            console.error('Failed to send message', error);
            toast.error('Failed to send message');
        }
    };

    const handleCreateChannel = async (values) => {
        if (!selectedTeamId) return;
        try {
            const res = await createChannel({ team_id: selectedTeamId, ...values });
            const channel = res?.data || res;
            if (channel) {
                setChannels((prev) => [channel, ...prev]);
                setSelectedChannel(channel);
                toast.success('Channel created');
            }
        } catch (error) {
            console.error('Failed to create channel', error);
            toast.error('Failed to create channel');
        }
    };

    const handleTyping = () => {
        if (selectedChannelId) {
            sendTyping(selectedChannelId);
        }
    };

    useEffect(() => {
        const handleIncomingMessage = (payload) => {
            const channelId = payload.channel_id || payload.message?.channel_id;
            const messageData = payload.message || payload.data || payload;
            if (!channelId || !messageData) return;
            if (String(channelId) !== String(selectedChannelId)) return;
            setMessages((prev) => mergeMessages(prev, [messageData]));
        };

        const handleMessageUpdated = (payload) => {
            const channelId = payload.channel_id || payload.message?.channel_id;
            if (String(channelId) !== String(selectedChannelId)) return;
            const messageData = payload.message || payload.data || payload;
            if (!messageData) return;
            setMessages((prev) => mergeMessages(prev, [messageData]));
        };

        const handleMessageDeleted = (payload) => {
            const channelId = payload.channel_id || selectedChannelId;
            if (String(channelId) !== String(selectedChannelId)) return;
            const messageId = payload.message_id || payload.id;
            if (!messageId) return;
            setMessages((prev) => prev.filter((msg) => String(msg.id || msg.message_id) !== String(messageId)));
        };

        const handleTypingEvent = (payload) => {
            if (String(payload.channel_id) !== String(selectedChannelId)) return;
            if (payload.user_id && String(payload.user_id) === String(currentUserId)) return;

            setTypingUsers((prev) => {
                const next = new Set(prev);
                next.add(payload.user_id || 'unknown');
                return Array.from(next);
            });

            if (typingTimeoutsRef.current.has(payload.user_id)) {
                clearTimeout(typingTimeoutsRef.current.get(payload.user_id));
            }
            const timeout = setTimeout(() => {
                setTypingUsers((prev) => prev.filter((id) => id !== payload.user_id));
                typingTimeoutsRef.current.delete(payload.user_id);
            }, 2000);
            typingTimeoutsRef.current.set(payload.user_id, timeout);
        };

        onNewMessage(handleIncomingMessage);
        onMessageUpdated(handleMessageUpdated);
        onMessageDeleted(handleMessageDeleted);
        onTyping(handleTypingEvent);

        return () => {
            typingTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
            typingTimeoutsRef.current.clear();
        };
    }, [selectedChannelId, currentUserId]);

    const layoutTitle = useMemo(() => selectedChannel ? selectedChannel.name : 'Team Chat', [selectedChannel]);

    return (
        <MainLayout>
            <div className="team-chat">
                <div className="team-chat__header">
                    <Title level={3} style={{ marginBottom: 4 }}>{layoutTitle}</Title>
                    <Text type="secondary">Collaborate with your team in real time.</Text>
                </div>

                <div className="team-chat__body">
                    <div className="team-chat__sidebar">
                        <ChatSidebar
                            teams={teams}
                            selectedTeamId={selectedTeamId}
                            onTeamChange={setSelectedTeamId}
                            channels={channels}
                            selectedChannelId={selectedChannelId}
                            onSelectChannel={setSelectedChannel}
                            onCreateChannel={handleCreateChannel}
                            loadingChannels={loadingChannels}
                        />
                    </div>
                    <div className="team-chat__window">
                        <ChatWindow
                            channel={selectedChannel}
                            messages={messages}
                            currentUserId={currentUserId}
                            onSend={handleSendMessage}
                            onTyping={handleTyping}
                            onLoadMore={() => loadMessages(false)}
                            hasMore={hasMore}
                            loadingMessages={loadingMessages}
                            typingUsers={typingUsers}
                        />
                    </div>
                </div>
            </div>
        </MainLayout>
    );
};

export default TeamChat;
