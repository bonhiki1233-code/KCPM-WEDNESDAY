import React, { useState, useEffect } from 'react';
import { Layout, Typography, Button, Table, Modal, Form, Input, message, Row, Col, Card, Select } from 'antd';
import { PlusOutlined, TeamOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { studentTeamsService } from '../services/studentTeamsService';
import MainLayout from '../components/MainLayout';

const { Title, Text } = Typography;
const { Content } = Layout;
const { Option } = Select;

const TeamManagement = () => {
    const navigate = useNavigate();
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
    const [joinForm] = Form.useForm();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form] = Form.useForm();
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [claimedProjects, setClaimedProjects] = useState([]);
    const [projectForm] = Form.useForm();

    const fetchTeams = async () => {
        setLoading(true);
        try {
            const res = await studentTeamsService.listTeams();
            const payload = Array.isArray(res?.data?.teams)
                ? res.data.teams
                : Array.isArray(res?.data)
                    ? res.data
                    : [];
            setTeams(payload);
        } catch (error) {
            console.error("Failed to fetch teams", error);
            message.error("Failed to load teams");
        } finally {
            setLoading(false);
        }
    };

    const fetchClaimedProjects = async () => {
        try {
            const res = await fetch('/api/v1/projects?claimed_by_me=true');
            const data = await res.json();
            setClaimedProjects(data.projects || []);
        } catch (error) {
            console.error('Failed to fetch claimed projects:', error);
        }
    };

    useEffect(() => {
        fetchTeams();
        fetchClaimedProjects();
    }, []);

    const handleCreateTeam = async (values) => {
        try {
            await studentTeamsService.createTeam(values);
            message.success('Team created successfully');
            setIsModalOpen(false);
            form.resetFields();
            fetchTeams(); // Refresh list
        } catch (error) {
            console.error("Failed to create team", error);
            message.error('Failed to create team');
        }
    };

    const columns = [
        {
            title: 'Team Name',
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => <span style={{ fontWeight: 500 }}>{record.team_name || record.name}</span>
        },
        {
            title: 'Roles',
            key: 'roles',
            render: (_, record) => {
                const role = record.my_role || 'Member';
                const isLeader = String(role).toUpperCase() === 'LEADER';
                return (
                    <span style={{
                        background: isLeader ? '#fffbe6' : '#fff',
                        color: isLeader ? '#faad14' : 'rgba(0, 0, 0, 0.88)',
                        borderColor: isLeader ? '#ffe58f' : '#d9d9d9',
                        padding: '4px 12px',
                        borderRadius: 4,
                        border: '1px solid',
                        fontSize: 12
                    }}>
                        {isLeader ? 'Leader' : 'Member'}
                    </span>
                );
            }
        },
        {
            title: 'Project ID',
            dataIndex: 'project_id',
            key: 'project_id',
            render: (pid) => pid ? `Project_${pid}` : 'None'
        },
        {
            title: 'Status',
            key: 'status',
            render: (_, record) => (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: record.is_finalized ? '#ff4d4f' : '#52c41a' }} />
                    {record.is_finalized ? 'Finalized' : 'Active'}
                </span>
            )
        },
        {
            title: 'Action',
            key: 'action',
            render: (_, record) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                        size="small"
                        shape="round"
                        onClick={() => navigate(`/teams/${record.team_id || record.id}`)}
                        style={{ border: '1px solid #d9d9d9' }}
                    >
                        View
                    </Button>
                </div>
            )
        }
    ];
    const handleJoinTeam = async (values) => {
        try {
            // Using joinTeamByCode which assumes a global join endpoint exists
            await studentTeamsService.joinTeamByCode(values.join_code);
            message.success('Joined team successfully');
            setIsJoinModalOpen(false);
            joinForm.resetFields();
            fetchTeams();
        } catch (error) {
            console.error("Failed to join team", error);
            message.error(error.response?.data?.detail || 'Failed to join team');
        }
    };

    const handleSelectProject = async (values) => {
        try {
            const response = await fetch(`/api/v1/teams/${selectedTeam.team_id}/select-project`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ project_id: values.project_id })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to select project');
            }

            message.success('Project selected successfully');
            setIsProjectModalOpen(false);
            projectForm.resetFields();
            fetchTeams();
        } catch (error) {
            console.error("Failed to select project", error);
            message.error(error.message || 'Failed to select project');
        }
    };

    return (
        <MainLayout>
            <div style={{ marginBottom: 30 }}>
                <Title level={2} style={{ margin: '0 0 8px 0', fontWeight: 'normal' }}>Team Management</Title>
                <Text style={{ fontSize: 16, color: '#595959' }}>See your team and manage your team member and roles</Text>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 40 }}>
                <Button
                    type="primary"
                    shape="round"
                    icon={<PlusOutlined />}
                    size="large"
                    onClick={() => setIsModalOpen(true)}
                    style={{ height: 46, padding: '0 32px', fontSize: 16, fontWeight: 500 }}
                >
                    Create Team
                </Button>
                <Button
                    shape="round"
                    icon={<TeamOutlined />}
                    size="large"
                    onClick={() => setIsJoinModalOpen(true)}
                    style={{ height: 46, padding: '0 32px', fontSize: 16, fontWeight: 500, background: '#e6e6e6', border: 'none', color: '#000' }}
                >
                    Join a Team
                </Button>
            </div>

            <div style={{ background: '#e6e6e6', borderRadius: 30, padding: 32, minHeight: 500 }}>
                <div style={{ marginBottom: 24 }}>
                    <Title level={3} style={{ margin: '0 0 4px 0' }}>Your Team</Title>
                    <Text style={{ fontSize: 14, color: '#595959' }}>Manage team members, roles</Text>
                </div>

                <Table
                    loading={loading}
                    dataSource={teams.filter(t => t.is_member)}
                    columns={columns}
                    rowKey={(record) => record.team_id || record.id || Math.random()}
                    pagination={false}
                    style={{ borderRadius: 16, overflow: 'hidden' }}
                />
            </div>

            <Modal
                title="Create New Team"
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onOk={() => form.submit()}
            >
                <Form form={form} layout="vertical" onFinish={handleCreateTeam}>
                    <Form.Item name="name" label="Team Name" rules={[{ required: true }]}>
                        <Input placeholder="Enter team name" />
                    </Form.Item>
                    <Form.Item name="description" label="Description">
                        <Input.TextArea placeholder="Team description" />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Join Team by Code"
                open={isJoinModalOpen}
                onCancel={() => setIsJoinModalOpen(false)}
                onOk={() => joinForm.submit()}
            >
                <Form form={joinForm} layout="vertical" onFinish={handleJoinTeam}>
                    <Form.Item
                        name="join_code"
                        label="Join Code"
                        rules={[{ required: true, message: 'Please enter a join code' }]}
                    >
                        <Input placeholder="Enter 8-character code" />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Select Project for Team"
                open={isProjectModalOpen}
                onCancel={() => setIsProjectModalOpen(false)}
                onOk={() => projectForm.submit()}
            >
                <Form form={projectForm} layout="vertical" onFinish={handleSelectProject}>
                    <Form.Item
                        name="project_id"
                        label="Project"
                        rules={[{ required: true, message: 'Please select a project' }]}
                    >
                        <Select placeholder="Chọn dự án">
                            {claimedProjects.map((project) => (
                                <Option key={project.project_id} value={project.project_id}>
                                    {project.title}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </MainLayout>
    );
};

export default TeamManagement;
