import React, { useState, useEffect } from 'react';
import { Typography, Button, Descriptions, message, Card, List, Avatar, Space, Tag, Modal, Form, Input, Table, Select } from 'antd';
import { UserOutlined, ArrowLeftOutlined, DownOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { teamService } from '../services/api';
import MainLayout from '../components/MainLayout';

const { Title, Text } = Typography;
const { Option } = Select;

const TeamDetail = () => {
    const { teamId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [team, setTeam] = useState(null);
    const [loading, setLoading] = useState(true);

    const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
    const [joinForm] = Form.useForm();
    const [isMember, setIsMember] = useState(false);
    const [isLeader, setIsLeader] = useState(false);
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [claimedProjects, setClaimedProjects] = useState([]);
    const [projectForm] = Form.useForm();

    const fetchTeamDetail = async () => {
        setLoading(true);
        try {
            const res = await teamService.getDetail(teamId);
            setTeam(res.data);
        } catch (error) {
            console.error("Failed to fetch team detail", error);
            message.error("Failed to load team detail");
        } finally {
            setLoading(false);
        }
    };

    const fetchClaimedProjects = async () => {
        try {
            const res = await fetch('/api/v1/projects?claimed_by_me=true', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await res.json();
            setClaimedProjects(data.projects || []);
        } catch (error) {
            console.error('Failed to fetch claimed projects:', error);
        }
    };

    useEffect(() => {
        if (teamId) {
            fetchTeamDetail();
            fetchClaimedProjects();
        }
    }, [teamId]);

    useEffect(() => {
        if (team && user) {
            // Check if user is leader
            setIsLeader(team.leader_id === user.user_id || team.leader_id === user.id);
            // Check if user is member
            const memberFound = team.members?.find(m => m.user_id === user.user_id || m.user_id === user.id);
            setIsMember(!!memberFound);
        }
    }, [team, user]);

    const handleJoinSubmit = async (values) => {
        try {
            await teamService.join(teamId, { join_code: values.join_code });
            message.success("Joined team successfully");
            setIsJoinModalOpen(false);
            fetchTeamDetail();
        } catch (error) {
            message.error(error.response?.data?.detail || "Failed to join team");
        }
    };

    const handleLeave = async () => {
        try {
            await teamService.leave(teamId);
            message.success("Left team successfully");
            navigate('/teams');
        } catch (error) {
            message.error(error.response?.data?.detail || "Failed to leave team");
        }
    };

    const handleFinalize = async () => {
        try {
            // Confirm dialog could be added here
            await teamService.finalize(teamId);
            message.success("Team finalized");
            fetchTeamDetail();
        } catch (error) {
            message.error("Failed to finalize team");
        }
    };

    const handleSelectProject = () => {
        // According to user request: navigate to project list view with current team ID
        navigate(`/projects?teamId=${teamId}`);
    };

    // ... (handleFinalize etc)

    // ... (handleFinalize etc)

    // ... (handleFinalize etc)

    if (loading) {
        return (
            <MainLayout>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <div style={{ fontSize: '18px' }}>Loading team details...</div>
                </div>
            </MainLayout>
        );
    }

    if (!team) {
        return (
            <MainLayout>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <div style={{ fontSize: '18px', color: 'red' }}>Team not found or failed to load.</div>
                    <Button onClick={() => navigate('/teams')} style={{ marginTop: 16 }}>Back to Teams</Button>
                </div>
            </MainLayout>
        );
    }

    const columns = [
        {
            title: 'Member',
            key: 'member',
            render: (_, record) => {
                const role = record.role || 'Member';
                const isLeader = String(role).toUpperCase() === 'LEADER';
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar size={48} src={record.avatar_url} icon={<UserOutlined />} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <Text strong style={{ fontSize: 16 }}>{record.full_name || record.name}</Text>
                            <Tag color={isLeader ? 'gold' : 'default'} style={{ width: 'fit-content', marginTop: 4 }}>
                                {isLeader ? 'Leader' : 'Member'}
                            </Tag>
                        </div>
                    </div>
                );
            }
        },
        {
            title: 'Roles',
            key: 'roles',
            render: (_, record) => {
                const role = record.role || 'Member';
                const isLeader = String(role).toUpperCase() === 'LEADER';
                return (
                    <Button style={{
                        background: '#fff',
                        border: '1px solid #d9d9d9',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '4px 12px',
                        height: 'auto'
                    }}>
                        <span style={{ fontWeight: 500 }}>{isLeader ? 'Leader' : 'Member'}</span>
                        <DownOutlined style={{ fontSize: 10, color: '#bfbfbf' }} /> {/* Placeholder for logic */}
                    </Button>
                );
            }
        },
        {
            title: 'Contact Info',
            key: 'contact',
            render: (_, record) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 24, height: 24, background: '#f0f0f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ textDecoration: 'none', color: '#8c8c8c' }}>@</div>
                        </div>
                        <Text style={{ color: '#595959' }}>{record.email || 'No email'}</Text>
                    </div>
                    {/* Mock Phone */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 24, height: 24, background: '#f0f0f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ color: '#8c8c8c', fontSize: 12 }}>📞</div>
                        </div>
                        <Text style={{ color: '#595959' }}>+84 0903449932</Text>
                    </div>
                </div>
            )
        },
        {
            title: 'Status',
            key: 'status',
            render: (_, record) => {
                // Using join_code presence or is_active from dummy logic for now
                const isActive = true; // record.is_active; // Check actual field
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: isActive ? '#52c41a' : '#ff4d4f' }} />
                        <Text style={{ color: isActive ? '#52c41a' : '#ff4d4f' }}>{isActive ? 'Active' : 'Offline'}</Text>
                    </div>
                );
            }
        },
        {
            title: 'Action',
            key: 'action',
            render: () => (
                <Button icon={<span style={{ fontSize: 16 }}>✏️</span>}>Edit</Button>
            )
        }
    ];

    return (
        <MainLayout>
            <div style={{ marginBottom: 24 }}>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/teams')} style={{ border: 'none', background: 'transparent', padding: 0, fontSize: 16 }}>
                    Back
                </Button>
            </div>

            <div style={{ background: '#e6e6e6', borderRadius: 24, padding: '32px', minHeight: '80vh' }}>

                {/* Header Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <Title level={2} style={{ margin: 0, fontWeight: 'normal' }}>Team Members</Title>
                            {team.project_id && (
                                <Tag color="blue" style={{ fontSize: 14, padding: '2px 8px' }}>
                                    Project ID: {team.project_id}
                                </Tag>
                            )}
                        </div>
                        <Text style={{ fontSize: 16, color: '#595959' }}>Manage team members, roles</Text>
                    </div>

                    <div style={{ display: 'flex', gap: 12 }}>

                        {isLeader ? (
                            <>
                                <Button
                                    onClick={handleFinalize}
                                    disabled={team.is_finalized}
                                    style={{ height: 40, borderRadius: 8, border: 'none', fontWeight: 500 }}
                                >
                                    Finalize
                                </Button>
                                {!team.project_id && (
                                    <Button
                                        onClick={handleSelectProject}
                                        disabled={team.is_finalized}
                                        type="primary"
                                        style={{ height: 40, borderRadius: 8, border: 'none', fontWeight: 500 }}
                                    >
                                        Select Project
                                    </Button>
                                )}
                                {!team.is_finalized && (
                                    <div style={{
                                        background: '#fff',
                                        padding: '0 16px',
                                        height: 40,
                                        borderRadius: 8,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        fontWeight: 500
                                    }}>
                                        <span>Join Code:</span>
                                        <Text copyable strong>{team.join_code}</Text>
                                    </div>
                                )}
                            </>
                        ) : (
                            <Button
                                onClick={handleLeave}
                                icon={<span style={{ fontSize: 16 }}>🚪</span>} // Using emoji as icon placeholder
                                style={{
                                    height: 40,
                                    borderRadius: 8,
                                    border: 'none',
                                    fontWeight: 500,
                                    background: '#fff',
                                    color: '#ff4d4f'
                                }}
                            >
                                Leave Team
                            </Button>
                        )}

                    </div>
                </div>

                {/* Table */}
                <Table
                    dataSource={team.members || []}
                    columns={columns}
                    rowKey="user_id"
                    pagination={false}
                    style={{ background: 'transparent' }}
                // rowClassName={() => 'team-member-row'}
                />
            </div>

            <Modal
                title="Join Team"
                open={isJoinModalOpen}
                onCancel={() => setIsJoinModalOpen(false)}
                onOk={() => joinForm.submit()}
            >
                <Form form={joinForm} layout="vertical" onFinish={handleJoinSubmit}>
                    <Form.Item name="join_code" label="Enter Join Code" rules={[{ required: true }]}>
                        <Input placeholder="Team code..." />
                    </Form.Item>
                </Form>
            </Modal>
        </MainLayout >
    );
};

export default TeamDetail;
