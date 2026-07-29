import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Typography, Button, Space, Avatar, List, Input, Divider, Badge, message, Select, Modal } from 'antd';
import {
    VideoCameraOutlined,
    VideoCameraAddOutlined,
    SettingOutlined,
    LogoutOutlined,
    AudioOutlined,
    AudioMutedOutlined,
    CameraOutlined,
    PhoneOutlined,
    UserOutlined,
    MessageOutlined,
    ShareAltOutlined,
    MoreOutlined,
    TeamOutlined
} from '@ant-design/icons';
import { useAuth } from '../components/AuthContext';
import MainLayout from '../components/MainLayout';
import { teamService } from '../services/api';
// Use the new named exports
import {
    scheduleMeeting,
    joinMeeting,
    cancelMeeting,
    getMeeting,
    initPeer,
    getLocalStream,
    stopLocalStream,
    disconnectPeer,
    callPeer,
    toggleAudio,
    toggleVideo,
    getPeer
} from '../services/meetingService';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

const TeamMeetings = () => {
    const { user } = useAuth();
    const [teams, setTeams] = useState([]);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [isInPreview, setIsInPreview] = useState(false);
    const [isInMeeting, setIsInMeeting] = useState(false);
    const [currentMeeting, setCurrentMeeting] = useState(null);
    const [currentTime, setCurrentTime] = useState(dayjs());
    const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [initialMicState, setInitialMicState] = useState(true);
    const [initialCameraState, setInitialCameraState] = useState(true);

    // Fetch user's teams on mount
    useEffect(() => {
        const fetchTeams = async () => {
            if (!user) return;
            try {
                const res = await teamService.getAll();
                const myTeams = (res.data.teams || res.data || []).filter(t => t.is_member);
                setTeams(myTeams);
                if (myTeams.length > 0) {
                    setSelectedTeam(myTeams[0]);
                }
            } catch (error) {
                console.error("Failed to fetch teams", error);
            }
        };
        fetchTeams();
    }, [user]);

    // Update clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(dayjs()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleStartMeeting = async () => {
        if (!selectedTeam) {
            message.warning("Please join a team to start a meeting.");
            return;
        }

        try {
            message.loading({ content: "Creating meeting...", key: "createMeeting" });
            const startTime = new Date();
            const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour later

            const meetingData = {
                team_id: selectedTeam.team_id || selectedTeam.id,
                title: `Meeting for ${selectedTeam.name}`,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString()
            };
            const res = await scheduleMeeting(meetingData);

            setCurrentMeeting(res);
            setIsInPreview(true); // Show preview screen first
            message.success({ content: "Meeting created!", key: "createMeeting" });
        } catch (error) {
            console.error("Failed to create meeting", error);
            message.error({ content: "Failed to create meeting", key: "createMeeting" });
        }
    };

    const handleLeaveMeeting = () => {
        // Stop all media streams
        stopLocalStream();
        disconnectPeer();

        setIsInMeeting(false);
        setIsInPreview(false);
        setCurrentMeeting(null);

        // Reset mic/camera state
        setInitialMicState(true);
        setInitialCameraState(true);
    };

    const handleJoinFromPreview = (micOn, cameraOn) => {
        // Save the preview settings
        setInitialMicState(micOn);
        setInitialCameraState(cameraOn);
        setIsInPreview(false);
        setIsInMeeting(true);
    };

    const handleJoinSubmit = async () => {
        if (!joinCode) return;

        let meetingId = joinCode.trim();

        if (!/^\d+$/.test(meetingId)) {
            // Basic validation
        }

        try {
            message.loading({ content: "Joining meeting...", key: "joinMeeting" });
            // joinMeeting returns response.data
            const res = await joinMeeting(meetingId);

            // Fetch details to get team info
            const meeting = await getMeeting(meetingId);

            if (meeting.team_id) {
                const team = teams.find(t => t.id === meeting.team_id);
                if (team) setSelectedTeam(team);
            }

            setCurrentMeeting(meeting);
            setIsInMeeting(true);
            setIsJoinModalOpen(false);
            setJoinCode('');
            message.success({ content: "Joined meeting successfully", key: "joinMeeting" });

        } catch (error) {
            console.error("Failed to join meeting", error);
            message.error({ content: "Failed to join meeting. Check ID.", key: "joinMeeting" });
        }
    };

    return (
        <MainLayout>
            {isInPreview && currentMeeting ? (
                <PreviewScreen
                    user={user}
                    team={selectedTeam}
                    meeting={currentMeeting}
                    onJoin={handleJoinFromPreview}
                    onCancel={handleLeaveMeeting}
                />
            ) : isInMeeting && currentMeeting ? (
                <MeetingRoom
                    user={user}
                    team={selectedTeam}
                    meeting={currentMeeting}
                    currentTime={currentTime}
                    onLeave={handleLeaveMeeting}
                    initialMicOn={initialMicState}
                    initialCameraOn={initialCameraState}
                />
            ) : (
                <div style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    background: '#fff',
                    borderRadius: '12px',
                    minHeight: '80vh'
                }}>
                    <div style={{ textAlign: 'center', maxWidth: '600px' }}>
                        <Title level={1} style={{ fontSize: '38px', marginBottom: '16px' }}>
                            Create video meeting room
                        </Title>
                        <Text style={{ fontSize: '18px', display: 'block', color: '#595959', lineHeight: '1.6' }}>
                            The call-making feature is for everyone.<br />
                            Connect, collaborate, and celebrate with your team.
                        </Text>

                        {teams.length > 0 && (
                            <div style={{ marginTop: '24px' }}>
                                <Text strong>Selected Team: </Text>
                                <Select
                                    value={selectedTeam?.team_id || selectedTeam?.id}
                                    onChange={(val) => setSelectedTeam(teams.find(t => (t.team_id || t.id) === val))}
                                    style={{ width: 200 }}
                                >
                                    {teams.map(t => (
                                        <Option key={t.team_id || t.id} value={t.team_id || t.id}>{t.name}</Option>
                                    ))}
                                </Select>
                            </div>
                        )}

                        <div style={{ marginTop: '40px' }}>
                            <Space size="large">
                                <Button
                                    type="primary"
                                    size="large"
                                    icon={<VideoCameraOutlined />}
                                    onClick={handleStartMeeting}
                                    disabled={!selectedTeam}
                                    style={{
                                        height: '56px',
                                        padding: '0 32px',
                                        fontSize: '18px',
                                        borderRadius: '28px',
                                        backgroundColor: '#52c41a',
                                        border: 'none',
                                        boxShadow: '0 4px 12px rgba(82, 196, 26, 0.35)'
                                    }}
                                >
                                    New Meeting
                                </Button>
                                <Button
                                    size="large"
                                    icon={<TeamOutlined />}
                                    onClick={() => setIsJoinModalOpen(true)}
                                    style={{
                                        height: '56px',
                                        padding: '0 32px',
                                        fontSize: '18px',
                                        borderRadius: '28px',
                                        backgroundColor: '#f0f0f0',
                                        border: 'none',
                                        color: '#595959'
                                    }}
                                >
                                    Join A Meeting
                                </Button>
                            </Space>
                        </div>
                    </div>
                </div>
            )}

            <Modal
                title="Join a Meeting"
                open={isJoinModalOpen}
                onOk={handleJoinSubmit}
                onCancel={() => setIsJoinModalOpen(false)}
                okText="Join"
            >
                <div style={{ padding: '24px 0' }}>
                    <Text style={{ display: 'block', marginBottom: 8 }}>Enter the Meeting ID:</Text>
                    <Input
                        placeholder="e.g. 123"
                        size="large"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                        prefix={<TeamOutlined />}
                    />
                </div>
            </Modal>
        </MainLayout>
    );
};

const PreviewScreen = ({ user, team, meeting, onJoin, onCancel }) => {
    const [micOn, setMicOn] = useState(true);
    const [cameraOn, setCameraOn] = useState(true);
    const [stream, setStream] = useState(null);
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const isJoiningRef = useRef(false);

    useEffect(() => {
        const setupPreview = async () => {
            try {
                const mediaStream = await getLocalStream({ video: true, audio: true });
                setStream(mediaStream);
                streamRef.current = mediaStream;
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
            } catch (err) {
                console.error("Failed to get media stream", err);
                message.error("Cannot access camera/microphone");
            }
        };
        setupPreview();

        return () => {
            if (isJoiningRef.current) {
                return;
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
            stopLocalStream();
        };
    }, []);

    const handleToggleMic = () => {
        if (streamRef.current) {
            const audioTrack = streamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setMicOn(audioTrack.enabled);
            }
        }
    };

    const handleToggleCam = async () => {
        if (!streamRef.current) {
            console.log("No stream available");
            return;
        }

        const videoTrack = streamRef.current.getVideoTracks()[0];
        console.log("Toggle camera - current state:", cameraOn, "videoTrack:", videoTrack);

        if (cameraOn) {
            // Turning OFF: Stop the video track
            if (videoTrack) {
                console.log("Stopping video track...");
                videoTrack.stop();
                streamRef.current.removeTrack(videoTrack);
                console.log("Video track stopped and removed");
            }

            // Clear srcObject to release camera
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
            setCameraOn(false);
        } else {
            // Turning ON: Request new video stream
            try {
                console.log("Requesting new video stream...");
                const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
                const newVideoTrack = newStream.getVideoTracks()[0];
                streamRef.current.addTrack(newVideoTrack);

                // Update video element
                if (videoRef.current) {
                    videoRef.current.srcObject = streamRef.current;
                }
                setCameraOn(true);
                console.log("Video track added back");
            } catch (err) {
                console.error("Failed to re-enable camera", err);
                message.error("Cannot access camera");
            }
        }
    };

    const handleJoin = () => {
        // Pass current mic/camera state to parent
        isJoiningRef.current = true;
        onJoin(micOn, cameraOn);
    };

    const handleCancel = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        onCancel();
    };

    return (
        <div style={{
            height: '100vh',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px'
        }}>
            {/* Header */}
            <div style={{ position: 'absolute', top: 24, left: 24, color: 'white' }}>
                <Title level={4} style={{ color: 'white', margin: 0 }}>
                    Ready to join?
                </Title>
                <Text style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {team?.name || 'Meeting'} • Meeting ID: {meeting?.meeting_id || meeting?.id}
                </Text>
            </div>

            {/* Video Preview */}
            <div style={{
                width: '640px',
                height: '480px',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                position: 'relative',
                background: '#000'
            }}>
                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: 'scaleX(-1)' // Mirror effect
                    }}
                />
                {!cameraOn && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: '#1a1a2e',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column'
                    }}>
                        <Avatar size={80} icon={<UserOutlined />} style={{ background: '#52c41a' }} />
                        <Text style={{ color: 'white', marginTop: 16, fontSize: 18 }}>
                            {user?.full_name || user?.name || 'You'}
                        </Text>
                    </div>
                )}

                {/* User name overlay */}
                <div style={{
                    position: 'absolute',
                    bottom: 16,
                    left: 16,
                    background: 'rgba(0,0,0,0.6)',
                    padding: '8px 16px',
                    borderRadius: '8px'
                }}>
                    <Text style={{ color: 'white', fontWeight: 500 }}>
                        {user?.full_name || user?.name || 'You'}
                    </Text>
                </div>
            </div>

            {/* Controls */}
            <div style={{ marginTop: 32, display: 'flex', gap: 16, alignItems: 'center' }}>
                <Button
                    type="text"
                    size="large"
                    icon={micOn ? <AudioOutlined /> : <AudioMutedOutlined />}
                    onClick={handleToggleMic}
                    style={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        background: micOn ? 'rgba(255,255,255,0.1)' : '#ff4d4f',
                        color: 'white',
                        fontSize: 20
                    }}
                />
                <Button
                    type="text"
                    size="large"
                    icon={cameraOn ? <VideoCameraOutlined /> : <VideoCameraAddOutlined />}
                    onClick={handleToggleCam}
                    style={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        background: cameraOn ? 'rgba(255,255,255,0.1)' : '#ff4d4f',
                        color: 'white',
                        fontSize: 20
                    }}
                />
                <Button
                    type="primary"
                    size="large"
                    onClick={handleJoin}
                    style={{
                        height: 56,
                        padding: '0 48px',
                        fontSize: 18,
                        borderRadius: 28,
                        background: '#52c41a',
                        border: 'none',
                        marginLeft: 16
                    }}
                >
                    Join Now
                </Button>
                <Button
                    size="large"
                    onClick={handleCancel}
                    style={{
                        height: 56,
                        padding: '0 32px',
                        fontSize: 16,
                        borderRadius: 28,
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        color: 'white'
                    }}
                >
                    Cancel
                </Button>
            </div>
        </div>
    );
};

const MeetingRoom = ({ user, team, meeting, currentTime, onLeave, initialMicOn = true, initialCameraOn = true }) => {
    const [micOn, setMicOn] = useState(initialMicOn);
    const [cameraOn, setCameraOn] = useState(initialCameraOn);
    const [participants, setParticipants] = useState([]);
    const [isLeader, setIsLeader] = useState(false);
    const [remoteStreams, setRemoteStreams] = useState({}); // Map of peerId -> stream
    const [localStreamState, setLocalStreamState] = useState(null);

    // Video refs
    const myVideoRef = useRef(null);
    const localStreamRef = useRef(null);

    // Display Meeting ID as code
    const roomCode = meeting ? `${meeting.meeting_id || meeting.id}` : (team ? `TEAM-${team.team_id || team.id}` : 'N/A');

    useEffect(() => {
        if (team && user) {
            setIsLeader(team.leader_id === (user?.user_id || user?.id));
        }
    }, [team, user]);

    // Initialize PeerJS and Media
    useEffect(() => {
        const setupMediaAndPeer = async () => {
            // 1. Get Local Stream
            try {
                const stream = await getLocalStream();
                localStreamRef.current = stream;
                setLocalStreamState(stream);

                const audioTrack = stream.getAudioTracks()[0];
                const videoTrack = stream.getVideoTracks()[0];
                if (audioTrack) audioTrack.enabled = initialMicOn;
                if (videoTrack) videoTrack.enabled = initialCameraOn;

                if (myVideoRef.current) {
                    myVideoRef.current.srcObject = stream;
                }
            } catch (err) {
                message.error("Không thể truy cập Camera/Micro");
            }

            // 2. Init Peer with Suffix Fallback (for multi-device/collisions)
            const tryInitPeer = async (id, attempt = 1) => {
                const finalId = attempt === 1 ? id : `${id}-${attempt}`;
                try {
                    await initPeer(finalId);
                    console.log(`✅ Peer initialized as: ${finalId}`);

                    window.addEventListener('peer-stream', handleRemoteStream);
                    window.addEventListener('peer-disconnected', handlePeerDisconnected);
                } catch (err) {
                    if (err.type === 'unavailable-id' && attempt < 5) {
                        console.log(`⚠️ ID ${finalId} đã được sử dụng, thử ID khác...`);
                        await tryInitPeer(id, attempt + 1);
                    } else {
                        console.error("❌ Peer init failed:", err);
                    }
                }
            };

            if (user?.user_id) {
                await tryInitPeer(`${user.user_id}`);
            }
        };

        setupMediaAndPeer();

        return () => {
            window.removeEventListener('peer-stream', handleRemoteStream);
            window.removeEventListener('peer-disconnected', handlePeerDisconnected);
            disconnectPeer();
            stopLocalStream();
        };
    }, [user, team?.team_id]);

    // Ensure local video element stays synced with stream
    useEffect(() => {
        if (myVideoRef.current && localStreamState) {
            myVideoRef.current.srcObject = localStreamState;
        }
    }, [localStreamState, cameraOn]);

    // Robust Discovery Loop: Keep trying to call others until they answer
    useEffect(() => {
        let interval = null;
        const currentPeer = getPeer();

        if (currentPeer && currentPeer.id && participants.length > 0 && localStreamState) {
            const startDiscovery = () => {
                const myId = currentPeer.id;
                participants.forEach(member => {
                    const memberId = `${member.student_id || member.user_id || member.id}`;

                    // Don't call myself (or my other sessions)
                    if (myId.startsWith(memberId)) return;

                    // Check if we already have a stream for this member
                    const alreadyConnected = Object.keys(remoteStreams).some(peerId => peerId.startsWith(memberId));

                    if (!alreadyConnected) {
                        // Call the base ID and variants to find them on any device
                        [memberId, `${memberId}-2`, `${memberId}-3`].forEach(idVariant => {
                            console.log(`🔍 Discovering participant: ${idVariant}`);
                            callPeer(idVariant).catch(() => {
                                // Silent fail is expected if they aren't online
                            });
                        });
                    }
                });
            };

            // Initial call
            startDiscovery();

            // Loop every 5 seconds to find new people joining
            interval = setInterval(startDiscovery, 5000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [participants, localStreamState, getPeer()?.id, Object.keys(remoteStreams).length]);

    const handleRemoteStream = (e) => {
        const { peerId, stream } = e.detail;
        console.log(`📹 Connected to: ${peerId}`);
        setRemoteStreams(prev => ({
            ...prev,
            [peerId]: stream
        }));
    };

    const handlePeerDisconnected = (e) => {
        const { peerId } = e.detail;
        console.log(`❌ Disconnected: ${peerId}`);
        setRemoteStreams(prev => {
            const newState = { ...prev };
            delete newState[peerId];
            return newState;
        });
    };

    // Toggle logic utilizing service
    const handleToggleMic = () => {
        const newState = toggleAudio();
        setMicOn(newState);
    };

    const handleToggleCam = () => {
        const newState = toggleVideo();
        setCameraOn(newState);

        // Update local video element visibility
        if (myVideoRef.current) {
            myVideoRef.current.style.display = newState ? 'block' : 'none';
        }
    };

    // Fetch participants
    useEffect(() => {
        const fetchMembers = async () => {
            if (!team) return;
            try {
                const res = await teamService.getDetail(team.team_id || team.id);
                setParticipants(res.data.members || []);
            } catch (error) {
                console.error("Failed to load participants", error);
            }
        };
        fetchMembers();
    }, [team?.team_id]);

    // Derive active participants list for display
    const activeParticipantsList = useMemo(() => {
        if (!participants.length) return [];

        const list = [];

        // 1. My Current Session
        const me = participants.find(m => `${m.student_id || m.user_id || m.id}` === `${user?.user_id || user?.id}`);
        if (me) {
            list.push({
                id: `me-${getPeer()?.id}`,
                name: me.full_name || me.name,
                isMe: true,
                avatar: me.avatar_url,
                peerId: getPeer()?.id
            });
        }

        // 2. Remote Sessions
        Object.entries(remoteStreams).forEach(([pId, stream]) => {
            const member = participants.find(m => {
                const mID = `${m.student_id || m.user_id || m.id}`;
                return pId.startsWith(mID);
            });

            if (member) {
                list.push({
                    id: pId,
                    name: member.full_name || member.name,
                    isMe: false,
                    avatar: member.avatar_url,
                    peerId: pId,
                    stream: stream
                });
            }
        });

        return list;
    }, [participants, remoteStreams, user?.user_id, getPeer()?.id]);

    const handleCancelMeeting = async () => {
        if (!meeting) return;
        try {
            await cancelMeeting(meeting.meeting_id || meeting.id);
            message.success("Meeting canceled successfully");
            onLeave();
        } catch (error) {
            console.error("Failed to cancel meeting", error);
            message.error("Failed to cancel meeting");
        }
    };

    return (
        <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>

            {/* Top Bar */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                background: '#fff',
                padding: '12px 24px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', background: '#f0f0f0', padding: '6px 16px', borderRadius: '8px' }}>
                    <Badge status={getPeer()?.disconnected ? "error" : "processing"} color={getPeer()?.disconnected ? "red" : "#52c41a"} style={{ marginRight: 8 }} />
                    <Text strong style={{ marginRight: 8, color: '#595959' }}>Meeting ID:</Text>
                    <Text copyable>{roomCode}</Text>
                </div>

                <Title level={4} style={{ margin: 0 }}>{currentTime.format('h:mm A')}</Title>

                <Space size="middle">
                    <Button icon={<SettingOutlined />} shape="circle" />
                    <Button icon={<MoreOutlined />} shape="circle" />
                </Space>
            </div>

            {/* Main Content */}
            <div style={{ display: 'flex', flex: 1, gap: '24px', overflow: 'hidden' }}>

                {/* Video Grid */}
                <div style={{ flex: 3, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', overflowY: 'auto' }}>
                    {activeParticipantsList.map((p) => {
                        const remoteStream = p.isMe ? null : p.stream;
                        const hasVideo = p.isMe ? cameraOn : (remoteStream?.getVideoTracks()?.some(t => t.enabled) ?? false);

                        return (
                            <div key={p.id} style={{
                                background: '#1a1a2e',
                                borderRadius: '16px',
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minHeight: '200px',
                                aspectRatio: '16/9',
                                overflow: 'hidden',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                            }}>
                                {p.isMe ? (
                                    <video
                                        ref={myVideoRef}
                                        autoPlay
                                        muted
                                        playsInline
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: cameraOn ? 'block' : 'none' }}
                                    />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: hasVideo ? 'block' : 'none' }}>
                                        <RemoteVideo stream={remoteStream} />
                                    </div>
                                )}

                                {!hasVideo && (
                                    <div style={{ textAlign: 'center', position: 'absolute', zIndex: 1 }}>
                                        <Avatar size={100} icon={<UserOutlined />} src={p.avatar} style={{ border: '4px solid rgba(255,255,255,0.2)', backgroundColor: '#434343' }} />
                                        <div style={{ fontWeight: 500, color: '#fff', marginTop: 12, fontSize: 18 }}>{p.name} {p.isMe ? '(Bạn)' : ''}</div>
                                    </div>
                                )}

                                <div style={{
                                    position: 'absolute',
                                    bottom: 16,
                                    left: 16,
                                    background: 'rgba(0,0,0,0.6)',
                                    color: '#fff',
                                    padding: '6px 14px',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    backdropFilter: 'blur(4px)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8
                                }}>
                                    <div style={{ width: 8, height: 8, background: '#52c41a', borderRadius: '50%' }} />
                                    {p.name} {p.isMe ? '(Bạn)' : ''}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Sidebar */}
                <div style={{
                    flex: 1,
                    background: '#fff',
                    borderRadius: '16px',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                    maxWidth: '320px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'center' }}>
                        <Title level={5} style={{ margin: 0 }}>Người tham gia ({activeParticipantsList.length})</Title>
                        <UserOutlined style={{ color: '#8c8c8c' }} />
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        <List
                            itemLayout="horizontal"
                            dataSource={activeParticipantsList}
                            renderItem={item => (
                                <List.Item style={{ padding: '12px 4px', border: 'none' }}>
                                    <List.Item.Meta
                                        avatar={<Avatar size="large" src={item.avatar} icon={<UserOutlined />} style={{ backgroundColor: '#f0f0f0', border: '1px solid #d9d9d9' }} />}
                                        title={<Text style={{ fontSize: '15px', fontWeight: 500 }}>{item.name} {item.isMe ? '(Bạn)' : ''}</Text>}
                                        description={<Badge status="success" text="Đang trong cuộc họp" />}
                                    />
                                </List.Item>
                            )}
                        />
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div style={{
                marginTop: '16px',
                background: '#434343',
                borderRadius: '16px',
                padding: '16px 32px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: '#fff'
            }}>
                <Space size="large">
                    <Button
                        shape="circle"
                        size="large"
                        icon={micOn ? <AudioOutlined /> : <AudioMutedOutlined />}
                        onClick={handleToggleMic}
                        className={!micOn ? 'danger-button' : ''}
                        type={!micOn ? 'primary' : 'default'}
                        danger={!micOn}
                    />
                    <Button
                        shape="circle"
                        size="large"
                        icon={<CameraOutlined />}
                        onClick={handleToggleCam}
                        type={!cameraOn ? 'primary' : 'default'}
                        danger={!cameraOn}
                    />
                    <Button shape="circle" size="large" icon={<ShareAltOutlined />} />
                </Space>

                <Space size="large">
                    <Button shape="circle" size="large" icon={<UserOutlined />} />
                    <Button shape="circle" size="large" icon={<MessageOutlined />} />
                    <Button shape="circle" size="large" icon={<MoreOutlined />} />
                </Space>

                {isLeader ? (
                    <Button
                        type="primary"
                        danger
                        shape="round"
                        size="large"
                        icon={<PhoneOutlined rotate={225} />}
                        onClick={handleCancelMeeting}
                        style={{ padding: '0 32px', height: '48px' }}
                    >
                        End Meeting
                    </Button>
                ) : (
                    <Button
                        type="primary"
                        danger
                        shape="round"
                        size="large"
                        icon={<PhoneOutlined rotate={225} />}
                        onClick={onLeave}
                        style={{ padding: '0 32px', height: '48px' }}
                    >
                        Leave Meeting
                    </Button>
                )}
            </div>
        </div>
    );
};

// Helper component for remote video
const RemoteVideo = ({ stream }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
    );
};

export default TeamMeetings;
