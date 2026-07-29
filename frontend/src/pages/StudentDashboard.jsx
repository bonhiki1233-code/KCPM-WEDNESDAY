import React, { useState, useEffect } from 'react';
import { Typography, Card, Button, List, Space, Row, Col, Progress, Tag, Timeline, Upload, Dropdown, message, Modal, Form, DatePicker, Select, Input } from 'antd';
import {
    ProjectOutlined,
    CalendarOutlined,
    FileOutlined,
    PlusOutlined,
    RightOutlined,
    FolderOutlined,
    CloudUploadOutlined,
    MoreOutlined,
    DeleteOutlined,
    FilePdfOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    ExclamationCircleOutlined,
    FileTextOutlined,
    FileExcelOutlined,
    FileImageOutlined,
    FileWordOutlined,
    FilePptOutlined,
    DesktopOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useAuth, resolveRoleName } from '../components/AuthContext';
import { projectService, teamService } from '../services/api';
import { tasksService } from '../services/tasksService';
import './StudentDashboard.css';
import MainLayout from '../components/MainLayout';

const { Text } = Typography;

const StudentDashboard = () => {
    const navigate = useNavigate();
    const { user, token } = useAuth();

    const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

    const readStoredUser = () => {
        if (!canUseStorage()) return null;
        const raw = window.localStorage.getItem('user');
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (_err) {
            return null;
        }
    };

    const buildScopedKey = (baseKey, userInfo) => {
        const identifier = userInfo?.user_id || userInfo?.email || userInfo?.id;
        return identifier ? `${baseKey}_${identifier}` : null;
    };

    const readActiveProjects = () => {
        if (!canUseStorage()) return [];
        const storedUser = readStoredUser();
        const scopedKey = buildScopedKey('active_projects', storedUser || user);
        const scopedRaw = scopedKey && window.localStorage.getItem(scopedKey);
        const raw = scopedRaw || window.localStorage.getItem('active_projects');
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed;
            }
            if (parsed && Array.isArray(parsed.items)) {
                if (!scopedRaw && parsed._owner && storedUser?.email && parsed._owner !== storedUser.email) {
                    return [];
                }
                return parsed.items;
            }
            return [];
        } catch (_err) {
            return [];
        }
    };

    const hydrateActiveProjects = (items) => {
        if (!Array.isArray(items) || items.length === 0) {
            return [];
        }
        return items.map((item) => ({
            id: item.id,
            title: item.title || 'Untitled Project',
            description: item.description || 'Claimed project',
            progress: item.progress ?? 0,
            status: item.status || 'active',
            type: item.type || item.iconType || 'Project'
        }));
    };

    // Content-specific state
    const [activeProjects, setActiveProjects] = useState([]);
    const [timelineData, setTimelineData] = useState([]);
    const [uploadedFiles, setUploadedFiles] = useState([
        { id: 1, name: 'Project_Requirements.pdf', size: '2.4 MB', type: 'PDF', time: '2 hours ago', icon: <FilePdfOutlined style={{ fontSize: 24, color: '#ff4d4f' }} /> },
        { id: 2, name: 'Architecture_Diagram.png', size: '1.8 MB', type: 'Image', time: '5 hours ago', icon: <FileImageOutlined style={{ fontSize: 24, color: '#36cfc9' }} /> },
        { id: 3, name: 'Meeting_Notes.docx', size: '450 KB', type: 'Word', time: 'Yesterday', icon: <FileWordOutlined style={{ fontSize: 24, color: '#1890ff' }} /> },
    ]);
    const [recentFiles, setRecentFiles] = useState([
        { name: 'Final_Report.docx', size: '1.2 MB', type: 'Word', time: '10 mins ago', icon: <FileWordOutlined style={{ fontSize: 20, color: '#1890ff' }} /> },
        { name: 'Budget_Q3.xlsx', size: '850 KB', type: 'Excel', time: '2 hours ago', icon: <FileExcelOutlined style={{ fontSize: 20, color: '#52c41a' }} /> },
        { name: 'Presentation_v2.pptx', size: '5.4 MB', type: 'PPT', time: 'Yesterday', icon: <FilePptOutlined style={{ fontSize: 20, color: '#fa8c16' }} /> },
        { name: 'Design_System.fig', size: '12 MB', type: 'Figma', time: '2 days ago', icon: <FileTextOutlined style={{ fontSize: 20, color: '#722ed1' }} /> },
        { name: 'API_Spec.json', size: '120 KB', type: 'Code', time: '3 days ago', icon: <FileTextOutlined style={{ fontSize: 20, color: '#595959' }} /> },
        { name: 'Logo_Assets.zip', size: '24 MB', type: 'Archive', time: '1 week ago', icon: <FolderOutlined style={{ fontSize: 20, color: '#faad14' }} /> },
    ]);
    const [storageUsage, setStorageUsage] = useState(68);
    const [totalFiles, setTotalFiles] = useState(1248);

    const [isEventModalOpen, setEventModalOpen] = useState(false);
    const [eventForm] = Form.useForm();
    const userRole = resolveRoleName(user);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!user || !token) return;
            try {
                // 1. Fetch Active Projects (Claimed Projects)
                const projectsRes = await projectService.getAll({ claimed_by_me: true });
                const projects = projectsRes.data || [];

                const mappedProjects = projects.map(p => ({
                    id: p.project_id || p.id,
                    title: p.project_name || p.topic_title || 'Untitled Project',
                    description: p.topic_description || 'No description',
                    progress: 0,
                    status: p.status || 'active',
                    type: 'Project',
                    ...p
                }));
                setActiveProjects(mappedProjects);

                // 2. Fetch Project Timeline (Sprints with task statistics)
                const teamsRes = await teamService.getAll();
                const teams = (teamsRes.data.teams || []).filter(t => t.is_member);
                const allTimeline = [];

                for (const team of teams) {
                    const teamId = team.team_id || team.id;
                    try {
                        // Fetch sprints for this team
                        const sprintsRes = await tasksService.getTeamSprints(teamId);
                        const sprints = sprintsRes.data.sprints || [];

                        // For each sprint, fetch tasks to calculate statistics
                        for (const sprint of sprints) {
                            const sprintId = sprint.sprint_id || sprint.id;
                            let tasks = [];

                            try {
                                const tasksRes = await tasksService.getSprintTasks(sprintId);
                                tasks = tasksRes.data.tasks || [];
                            } catch (err) {
                                console.error(`Failed to fetch tasks for sprint ${sprintId}`, err);
                            }

                            // Calculate task statistics
                            const totalTasks = tasks.length;
                            const completedTasks = tasks.filter(t => t.status === 'DONE').length;
                            const inProgressTasks = tasks.filter(t => t.status === 'DOING').length;

                            // Determine sprint status
                            let status = 'pending';
                            const now = dayjs();
                            const startDate = sprint.start_date ? dayjs(sprint.start_date) : null;
                            const endDate = sprint.end_date ? dayjs(sprint.end_date) : null;

                            if (totalTasks > 0 && completedTasks === totalTasks) {
                                status = 'completed';
                            } else if (startDate && endDate) {
                                if (now.isAfter(endDate)) {
                                    status = 'completed';
                                } else if (now.isAfter(startDate) && now.isBefore(endDate)) {
                                    status = 'in-progress';
                                }
                            } else if (inProgressTasks > 0) {
                                status = 'in-progress';
                            }

                            // Format date range
                            let dateDisplay = 'No dates set';
                            if (startDate && endDate) {
                                dateDisplay = `${startDate.format('MMM DD')} - ${endDate.format('MMM DD, YYYY')}`;
                            } else if (startDate) {
                                dateDisplay = `Starts ${startDate.format('MMM DD, YYYY')}`;
                            }

                            // Create timeline event
                            allTimeline.push({
                                id: `sprint-${sprintId}`,
                                date: dateDisplay,
                                project: sprint.name || `Sprint ${sprintId}`,
                                description: `${team.name} • ${totalTasks} task${totalTasks !== 1 ? 's' : ''}, ${completedTasks} completed`,
                                status: status,
                                rawDate: startDate ? startDate.toISOString() : null,
                                teamName: team.name,
                                sprintId: sprintId
                            });
                        }
                    } catch (error) {
                        console.error(`Failed to fetch sprints for team ${teamId}`, error);
                    }
                }

                // Sort by date (upcoming first)
                allTimeline.sort((a, b) => {
                    if (!a.rawDate) return 1;
                    if (!b.rawDate) return -1;
                    return dayjs(a.rawDate).isAfter(dayjs(b.rawDate)) ? 1 : -1;
                });

                setTimelineData(allTimeline);

                console.log(`Loaded dashboard for role: ${userRole}`);
            } catch (error) {
                console.error("Failed to fetch dashboard data", error);
                message.error("Failed to load dashboard data");
            }
        };

        fetchDashboardData();
    }, [user, userRole, token]);

    useEffect(() => {
        const syncActiveProjects = (items) => {
            const nextItems = hydrateActiveProjects(items || readActiveProjects());
            if (nextItems.length) {
                setActiveProjects(nextItems);
            }
        };

        const handleActiveProjectsUpdated = (event) => {
            syncActiveProjects(event?.detail?.items);
        };

        const handleStorage = (event) => {
            if (event.key?.startsWith('active_projects') || event.key === 'active_projects') {
                syncActiveProjects();
            }
        };

        window.addEventListener('active-projects-updated', handleActiveProjectsUpdated);
        window.addEventListener('storage', handleStorage);

        return () => {
            window.removeEventListener('active-projects-updated', handleActiveProjectsUpdated);
            window.removeEventListener('storage', handleStorage);
        };
    }, []);


    const getProjectIcon = (project) => {
        if (project.type === 'IoT') return <CloudUploadOutlined />;
        if (project.type === 'Web') return <DesktopOutlined />; // Note: DesktopOutlined needs import if used, replacing with fallback
        return <ProjectOutlined />;
    };

    const getStatusTag = (status) => {
        switch (status) {
            case 'completed': return <Tag color="success" icon={<CheckCircleOutlined />}>Done</Tag>;
            case 'in-progress': return <Tag color="processing" icon={<ClockCircleOutlined />}>Doing</Tag>;
            case 'pending': return <Tag color="warning" icon={<ExclamationCircleOutlined />}>ToDo</Tag>;
            default: return <Tag color="default">Unknown</Tag>;
        }
    };

    const handleFileUpload = (file) => {
        const isLt10M = file.size / 1024 / 1024 < 10;
        if (!isLt10M) {
            message.error('File must be smaller than 10MB!');
            return Upload.LIST_IGNORE;
        }

        const newFile = {
            id: Date.now(),
            name: file.name,
            size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
            type: file.name.split('.').pop().toUpperCase(),
            time: 'Just now',
            icon: <FileOutlined style={{ fontSize: 24, color: '#1890ff' }} />
        };

        setUploadedFiles([newFile, ...uploadedFiles]);
        setTotalFiles(prev => prev + 1);
        message.success(`${file.name} uploaded successfully`);
        return false; // Prevent automatic upload
    };

    const handleRemoveUploadedFile = (id) => {
        setUploadedFiles(uploadedFiles.filter(f => f.id !== id));
        setTotalFiles(prev => prev - 1);
        message.success('File removed');
    };

    const deleteProject = (id) => {
        setActiveProjects(activeProjects.filter(p => p.id !== id));
        message.success('Project removed from dashboard');
    };

    const deleteEvent = (id) => {
        setTimelineData(timelineData.filter(e => e.id !== id));
        message.success('Event removed');
    };

    const handleEventSubmit = (values) => {
        const newEvent = {
            id: Date.now(),
            date: values.date.format('MMM D, HH:mm'),
            project: values.project,
            description: values.description,
            status: values.status
        };
        setTimelineData([newEvent, ...timelineData]);
        setEventModalOpen(false);
        eventForm.resetFields();
        message.success('New event added');
    };

    return (
        <MainLayout>
            <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
                {/* Active Projects Card */}
                <Col span={12}>
                    <Card
                        className="dashboard-card project-card"
                        title={
                            <Space>
                                <ProjectOutlined style={{ color: '#52c41a', fontSize: '18px' }} />
                                <Text strong style={{ fontSize: '16px' }}>Active Projects ({activeProjects.length})</Text>
                            </Space>
                        }
                        extra={
                            <Button type="text" icon={<RightOutlined />} size="small" onClick={() => navigate('/projects')}>
                                View Projects
                            </Button>
                        }
                        style={{ height: '100%', borderRadius: '12px', boxShadow: '0 20px 60px rgba(15, 18, 21, 0.06)' }}
                    >
                        <div style={{
                            maxHeight: '55vh',
                            overflowY: activeProjects.length > 6 ? 'auto' : 'visible',
                            paddingRight: activeProjects.length > 6 ? 8 : 0
                        }}>
                            <List
                                dataSource={activeProjects}
                                renderItem={(project) => (
                                    <List.Item
                                        style={{
                                            padding: '16px 0',
                                            borderBottom: '1px solid #f0f0f0',
                                            transition: 'all 0.3s'
                                        }}
                                        className="project-item"
                                    >
                                        <List.Item.Meta
                                            avatar={
                                                <div style={{
                                                    backgroundColor: '#f6ffed',
                                                    borderRadius: '8px',
                                                    padding: '8px',
                                                    color: '#52c41a'
                                                }}>
                                                    {getProjectIcon(project)}
                                                </div>
                                            }
                                            title={<Text strong style={{ fontSize: '14px' }}>{project.title}</Text>}
                                            description={
                                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                                    {project.description}
                                                </Text>
                                            }
                                        />
                                        <Dropdown
                                            menu={{
                                                items: [
                                                    {
                                                        key: 'remove',
                                                        label: 'Remove',
                                                        icon: <DeleteOutlined />,
                                                        onClick: () => deleteProject(project.id),
                                                    },
                                                ],
                                            }}
                                            trigger={['click']}
                                        >
                                            <Button size="small" type="text" icon={<MoreOutlined />} />
                                        </Dropdown>
                                    </List.Item>
                                )}
                            />
                        </div>
                    </Card>
                </Col>

                {/* Timeline Card */}
                <Col span={12}>
                    <Card
                        className="dashboard-card timeline-card"
                        title={
                            <Space>
                                <CalendarOutlined style={{ color: '#1890ff', fontSize: '18px' }} />
                                <Text strong style={{ fontSize: '16px' }}>Project Timeline ({timelineData.length})</Text>
                            </Space>
                        }
                        extra={
                            <Button type="text" icon={<PlusOutlined />} size="small" onClick={() => setEventModalOpen(true)}>
                                Add Event
                            </Button>
                        }
                        style={{ height: '100%', borderRadius: '12px', boxShadow: '0 20px 60px rgba(15, 18, 21, 0.06)' }}
                    >
                        <div className="timeline-scroll-container">
                            <Timeline
                                className="timeline-list"
                                items={timelineData.map((item, index) => ({
                                    color: index % 2 === 0 ? 'blue' : 'green',
                                    key: item.id,
                                    children: (
                                        <div className="timeline-event">
                                            <div className="timeline-event__content">
                                                <div className="timeline-event__details">
                                                    <Text strong style={{ fontSize: '12px', color: '#666' }}>{item.date}</Text>
                                                    <div style={{ marginTop: '4px' }}>
                                                        <Text strong style={{ fontSize: '14px' }}>{item.project}</Text>
                                                        <div style={{ marginTop: '2px' }}>
                                                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                                                {item.description}
                                                            </Text>
                                                        </div>
                                                    </div>
                                                </div>
                                                <Space size="small" className="timeline-event__actions">
                                                    {getStatusTag(item.status)}
                                                    <Dropdown
                                                        menu={{
                                                            items: [
                                                                {
                                                                    key: 'remove',
                                                                    label: 'Remove',
                                                                    icon: <DeleteOutlined />,
                                                                    onClick: () => deleteEvent(item.id),
                                                                },
                                                            ],
                                                        }}
                                                        trigger={['click']}
                                                    >
                                                        <Button size="small" type="text" icon={<MoreOutlined />} />
                                                    </Dropdown>
                                                </Space>
                                            </div>
                                        </div>
                                    )
                                }))}
                            />
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* Files Card */}
            <Card
                className="dashboard-card files-card"
                title={
                    <Space>
                        <FolderOutlined style={{ color: '#722ed1', fontSize: '18px' }} />
                        <Text strong style={{ fontSize: '16px' }}>Files & Documents</Text>
                    </Space>
                }
                extra={
                    <Space>
                        <Button type="text" size="small">
                            View All Files
                        </Button>
                        <Upload
                            beforeUpload={handleFileUpload}
                            showUploadList={false}
                            accept=".pdf,.doc,.docx,.json,.csv,.fig,.xd,.png,.jpg,.jpeg"
                        >
                            <Button type="primary" icon={<CloudUploadOutlined />} size="small">
                                Upload Files
                            </Button>
                        </Upload>
                    </Space>
                }
                style={{
                    borderRadius: 20,
                    boxShadow: '0 28px 65px rgba(15, 18, 21, 0.08)',
                    border: '1px solid #ffffff',
                    background: '#ffffff'
                }}
                styles={{ body: { background: '#ffffff' } }}
            >
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    <Col span={6}>
                        <Card
                            size="small"
                            className="file-stat-card file-stat-card--total"
                            style={{ background: '#f9f0ff', border: 'none', borderRadius: '6px' }}
                        >
                            <div style={{ textAlign: 'center' }}>
                                <Text strong style={{ fontSize: '24px', color: '#722ed1' }}>{totalFiles}</Text>
                                <div>
                                    <Text type="secondary" style={{ fontSize: '12px' }}>Total Files</Text>
                                </div>
                            </div>
                        </Card>
                    </Col>
                    <Col span={12}>
                        <Card
                            size="small"
                            className="file-stat-card"
                            style={{ border: 'none', borderRadius: '6px' }}
                        >
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <Text strong>Storage Usage</Text>
                                    <Text strong>{storageUsage}%</Text>
                                </div>
                                <Progress percent={storageUsage} status="active" strokeColor="#722ed1" />
                                <div style={{ marginTop: '8px' }}>
                                    <Text type="secondary" style={{ fontSize: '12px' }}>{recentFiles.length} Recent ({totalFiles} total available)</Text>
                                </div>
                            </div>
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card
                            size="small"
                            className="file-stat-card file-stat-card--shared"
                            style={{ background: '#f6ffed', border: 'none', borderRadius: '6px' }}
                        >
                            <div style={{ textAlign: 'center' }}>
                                <Text strong style={{ fontSize: '24px', color: '#52c41a' }}>86</Text>
                                <div>
                                    <Text type="secondary" style={{ fontSize: '12px' }}>Shared Files</Text>
                                </div>
                            </div>
                        </Card>
                    </Col>
                </Row>

                <div style={{ marginBottom: 24 }}>
                    <Text strong style={{ fontSize: '14px', display: 'block', marginBottom: 12 }}>Uploaded Files</Text>
                    {uploadedFiles.length === 0 ? (
                        <div
                            className="upload-placeholder"
                            style={{
                                border: '1px dashed #c7b1ff',
                                borderRadius: 12,
                                padding: '18px',
                                background: '#ffffff'
                            }}
                        >
                            <Text type="secondary" style={{ fontSize: 12 }}>No manual uploads yet. Use the Upload Files button to add documents.</Text>
                        </div>
                    ) : (
                        <List
                            dataSource={uploadedFiles}
                            bordered
                            renderItem={(file) => (
                                <List.Item
                                    className="uploaded-file-item"
                                    actions={[
                                        <Button
                                            key="remove"
                                            size="small"
                                            type="text"
                                            danger
                                            icon={<DeleteOutlined />}
                                            onClick={() => handleRemoveUploadedFile(file.id)}
                                        >
                                            Remove
                                        </Button>
                                    ]}
                                >
                                    <List.Item.Meta
                                        avatar={
                                            <div style={{
                                                backgroundColor: '#f2f0ff',
                                                borderRadius: 8,
                                                padding: 8,
                                                color: '#722ed1'
                                            }}>
                                                {file.icon}
                                            </div>
                                        }
                                        title={
                                            <Space direction="vertical" size={0}>
                                                <Text strong>{file.name}</Text>
                                                <Text type="secondary" style={{ fontSize: 12 }}>{file.type} • {file.size}</Text>
                                            </Space>
                                        }
                                    />
                                    <Text type="secondary" style={{ fontSize: 12 }}>{file.time}</Text>
                                </List.Item>
                            )}
                        />
                    )}
                </div>

                <div style={{ marginBottom: 16 }}>
                    <Text strong style={{ fontSize: '14px' }}>Recent Files</Text>
                </div>

                <Row gutter={[16, 16]}>
                    {recentFiles.map((file, index) => (
                        <Col span={8} key={index}>
                            <Card
                                size="small"
                                hoverable
                                className="recent-file-card"
                                style={{
                                    borderRadius: '6px',
                                    border: '1px solid #f0f0f0',
                                    height: '100%'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                                    <div style={{
                                        backgroundColor: '#f9f0ff',
                                        borderRadius: '6px',
                                        padding: '8px',
                                        marginRight: '12px',
                                        color: '#722ed1'
                                    }}>
                                        {file.icon}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <Text strong style={{ fontSize: '12px', display: 'block' }}>
                                            {file.name}
                                        </Text>
                                        <div style={{ marginTop: '4px' }}>
                                            <Tag size="small" color="purple">{file.type}</Tag>
                                            <Text type="secondary" style={{ fontSize: '10px', marginLeft: '8px' }}>
                                                {file.size}
                                            </Text>
                                        </div>
                                        <div style={{ marginTop: '8px' }}>
                                            <Text type="secondary" style={{ fontSize: '10px' }}>
                                                Updated {file.time}
                                            </Text>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </Col>
                    ))}
                </Row>

                <div className="quick-actions-panel" style={{ marginTop: 24, padding: '16px', background: '#fafafa', borderRadius: '6px' }}>
                    <Text strong style={{ fontSize: '14px', marginBottom: '12px', display: 'block' }}>
                        Quick Actions
                    </Text>
                    <Row gutter={[12, 12]}>
                        <Col>
                            <Button className="quick-action-btn" icon={<FilePdfOutlined />} size="small">
                                Export as PDF
                            </Button>
                        </Col>
                        <Col>
                            <Button className="quick-action-btn" icon={<FolderOutlined />} size="small">
                                Create Folder
                            </Button>
                        </Col>
                        <Col>
                            <Button className="quick-action-btn" icon={<FileOutlined />} size="small">
                                New Document
                            </Button>
                        </Col>
                    </Row>
                </div>
            </Card>

            <div style={{ height: '200px', marginTop: '24px' }} />

            <Modal
                title="Schedule Timeline Event"
                open={isEventModalOpen}
                onCancel={() => {
                    setEventModalOpen(false);
                    eventForm.resetFields();
                }}
                footer={null}
                width={520}
                destroyOnHidden
                styles={{ body: { paddingTop: 0 } }}
            >
                <div style={{ marginBottom: 16 }}>
                    <Text type="secondary">Add milestones to keep the project timeline aligned.</Text>
                </div>
                <Form layout="vertical" form={eventForm} onFinish={handleEventSubmit}>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                label="Event Date"
                                name="date"
                                rules={[{ required: true, message: 'Please choose a date' }]}
                            >
                                <DatePicker style={{ width: '100%' }} size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="Status"
                                name="status"
                                rules={[{ required: true, message: 'Select a status' }]}
                            >
                                <Select placeholder="Choose status" size="large">
                                    <Select.Option value="completed">Completed</Select.Option>
                                    <Select.Option value="in-progress">In Progress</Select.Option>
                                    <Select.Option value="pending">Pending</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item
                        label="Project"
                        name="project"
                        rules={[{ required: true, message: 'Please specify the project' }]}
                    >
                        <Input placeholder="e.g. Project Atlas" size="large" />
                    </Form.Item>
                    <Form.Item
                        label="Description"
                        name="description"
                        rules={[{ required: true, message: 'Please describe the event' }]}
                    >
                        <Input.TextArea rows={4} placeholder="What happens during this milestone?" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" block size="large">
                        Add Event
                    </Button>
                </Form>
            </Modal>
        </MainLayout>
    );
};

export default StudentDashboard;