import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Layout, Typography, Button, Card, Row, Col, Progress, List,
    Avatar, Space, Badge, Input, Upload, Timeline, Tag, Divider,
    Modal, Form, Select, DatePicker, message, Dropdown, Popover
} from 'antd';
import {
    SettingOutlined, BellOutlined, SearchOutlined, PlusOutlined,
    DashboardOutlined, TeamOutlined, DesktopOutlined, TableOutlined,
    FileTextOutlined, VideoCameraOutlined, SendOutlined, FormOutlined,
    LogoutOutlined, UserOutlined, FilePdfOutlined,
    FileImageOutlined, FileOutlined, ClockCircleOutlined, UploadOutlined,
    MoreOutlined, CheckCircleOutlined, SyncOutlined, PlayCircleOutlined,
    FolderOutlined, CloudUploadOutlined, CalendarOutlined, ProjectOutlined,
    LeftOutlined, RightOutlined, DeleteOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { teamService } from '../services/api';
import { tasksService } from '../services/tasksService';

// ... (imports remain)

const ProjectDashboard = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [collapsed, setCollapsed] = useState(false);

    // ... (other states remain)

    // Real Data State
    const [activeProjects, setActiveProjects] = useState([]);
    const [timelineData, setTimelineData] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!user) return;
            setLoading(true);
            try {
                // 1. Fetch Active Projects (Teams)
                const teamsRes = await teamService.getAll();
                const teams = (teamsRes.data.teams || []).filter(t => t.is_member);

                const mappedProjects = teams.map(t => ({
                    id: t.team_id || t.id,
                    title: t.name,
                    description: t.description || 'No description',
                    icon: <ProjectOutlined />,
                    ...t
                }));
                setActiveProjects(mappedProjects);

                // 2. Fetch Project Timeline (Sprints with task statistics)
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

                // Sort by date (upcoming first, then by start date)
                allTimeline.sort((a, b) => {
                    if (!a.rawDate) return 1;
                    if (!b.rawDate) return -1;
                    return dayjs(a.rawDate).isAfter(dayjs(b.rawDate)) ? 1 : -1;
                });

                setTimelineData(allTimeline);

            } catch (error) {
                console.error("Failed to fetch dashboard data", error);
                message.error("Failed to load dashboard data");
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [user]);

    // Recent Files Data
    const [recentFiles, setRecentFiles] = useState([
        { name: 'Test_report_2025.pdf', size: '1.0 MB', time: '2h ago', icon: <FilePdfOutlined />, type: 'PDF' },
        { name: 'Mockup.fig', size: '4.2 MB', time: '2h ago', icon: <FileImageOutlined />, type: 'Design' },
        { name: 'Requirements.docx', size: '1.1 MB', time: '1d ago', icon: <FileOutlined />, type: 'Document' },
        { name: 'Design_specs.pdf', size: '3.5 MB', time: '1d ago', icon: <FilePdfOutlined />, type: 'PDF' },
        { name: 'Wireframes.xd', size: '2.8 MB', time: '2d ago', icon: <FileImageOutlined />, type: 'Design' },
        { name: 'Backend_api.json', size: '0.8 MB', time: '3d ago', icon: <FileOutlined />, type: 'JSON' },
    ]);

    const notifications = useMemo(() => ([
        {
            id: 1,
            title: 'New Task Assigned',
            description: 'You have been assigned a new task titled "Complete Project Report."',
            timeAgo: '10 minutes ago',
        },
        {
            id: 2,
            title: 'Deadline Warning',
            description: "Reminder: The deadline for the task 'Submit Proposal' is approaching.",
            timeAgo: '10 minutes ago',
        },
        {
            id: 3,
            title: 'New Message Received',
            description: 'You have a new message from Test user.',
            timeAgo: '10 minutes ago',
        },
    ]), []);

    const notificationContent = (
        <div style={{ width: 320 }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Notifications</div>
            <Divider style={{ margin: '0 0 12px' }} />
            <div>
                {notifications.map((item, index) => (
                    <div key={item.id} style={{ padding: '8px 0' }}>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <Avatar shape="square" size={36} style={{ backgroundColor: '#f0f0f0', color: '#8c8c8c' }}>
                                <BellOutlined />
                            </Avatar>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <Text strong style={{ display: 'block' }}>{item.title}</Text>
                                        <Text type="secondary" style={{ fontSize: 12 }}>{item.description}</Text>
                                    </div>
                                    <Text type="secondary" style={{ fontSize: 11 }}>{item.timeAgo}</Text>
                                </div>
                            </div>
                        </div>
                        {index !== notifications.length - 1 && <Divider style={{ margin: '12px 0' }} />}
                    </div>
                ))}
            </div>
            <Divider style={{ margin: '8px 0 12px' }} />
            <Button type="link" block onClick={() => setNotificationOpen(false)}>
                View all Notifications
            </Button>
        </div>
    );

    const formatFileSize = (bytes = 0) => {
        if (!bytes) {
            return '0 MB';
        }
        const mb = bytes / (1024 * 1024);
        return `${mb < 1 ? (mb * 1024).toFixed(0) + ' KB' : mb.toFixed(1) + ' MB'}`;
    };

    const resolveFileDisplay = (fileName = '') => {
        const ext = fileName.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'pdf':
                return { type: 'PDF', icon: <FilePdfOutlined /> };
            case 'fig':
            case 'xd':
            case 'png':
            case 'jpg':
            case 'jpeg':
                return { type: 'Design', icon: <FileImageOutlined /> };
            case 'doc':
            case 'docx':
            case 'txt':
                return { type: 'Document', icon: <FileOutlined /> };
            case 'json':
            case 'csv':
                return { type: 'JSON', icon: <FileOutlined /> };
            default:
                return { type: ext ? ext.toUpperCase() : 'FILE', icon: <FileOutlined /> };
        }
    };

    const handleFileUpload = (file) => {
        const { type, icon } = resolveFileDisplay(file.name);
        const uploadedFile = {
            id: Date.now(),
            name: file.name,
            size: formatFileSize(file.size),
            time: 'just now',
            icon,
            type,
        };
        setUploadedFiles((prev) => [uploadedFile, ...prev]);
        setTotalFiles((prev) => prev + 1);
        setStorageUsage((prev) => Math.min(100, prev + 2));
        message.success(`${file.name} uploaded`);
        return false;
    };

    const handleRemoveUploadedFile = (fileId) => {
        setUploadedFiles((prev) => prev.filter((file) => file.id !== fileId));
        setTotalFiles((prev) => Math.max(0, prev - 1));
        message.success('File removed');
    };

    // Recent Activities Data
    const recentActivities = [
        'Smart Inventory System',
        'AI Health Monitor',
        'Smart Campus App',
        'Drone Delivery'
    ];

    // Calendar Logic
    const startDay = currentDate.startOf('month').day();
    const daysInMonth = currentDate.daysInMonth();
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const emptyDays = Array.from({ length: startDay }, (_, i) => i);

    const nextMonth = () => setCurrentDate(currentDate.add(1, 'month'));
    const prevMonth = () => setCurrentDate(currentDate.subtract(1, 'month'));

    const getStatusTag = (status) => {
        switch (status) {
            case 'completed': return <Tag color="green" icon={<CheckCircleOutlined />}>Completed</Tag>;
            case 'in-progress': return <Tag color="blue" icon={<SyncOutlined spin />}>In Progress</Tag>;
            default: return <Tag color="orange">Pending</Tag>;
        }
    };



    const handleEventSubmit = (values) => {
        const newEvent = {
            date: values.date ? values.date.format('MMM. DD, YYYY') : dayjs().format('MMM. DD, YYYY'),
            project: values.project,
            description: values.description,
            status: values.status,
            id: Date.now(),
        };
        setTimelineData((prev) => [newEvent, ...prev]);
        message.success('Event added');
        setEventModalOpen(false);
        eventForm.resetFields();
    };

    const deleteProject = (id) => {
        // Only remove from local view for now, as we don't have a leave/delete API hooked up here yet
        setActiveProjects((prev) => prev.filter((project) => project.id !== id));
        message.success('Project removed from view');
    };

    const deleteEvent = (id) => {
        setTimelineData((prev) => prev.filter((event) => event.id !== id));
        message.success('Event removed');
    };

    return (
        <Layout className="dashboard-layout" style={{ minHeight: '100vh', background: '#f5f5f5' }}>
            {/* Fixed Header */}
            <Header className="dashboard-header" style={{
                position: 'fixed',
                top: 0,
                zIndex: 1000,
                width: '100%',
                background: '#fff',
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0 24px',
                borderBottom: '1px solid #f0f0f0',
                height: '64px',
                lineHeight: '64px',
            }}>
                <Space size="large">
                    <Avatar size="small" style={{ backgroundColor: '#1890ff' }}>C</Avatar>
                    <Text strong style={{ fontSize: '16px' }}>CollabSphere</Text>
                </Space>
                <Space size="large">
                    <div ref={notificationAnchorRef} style={{ display: 'inline-flex' }}>
                        <Popover
                            content={notificationContent}
                            trigger="click"
                            placement="bottomRight"
                            open={isNotificationOpen}
                            onOpenChange={setNotificationOpen}
                            overlayStyle={{ padding: 0 }}
                            arrowPointAtCenter
                            getPopupContainer={() => notificationAnchorRef.current || document.body}
                        >
                            <Badge dot offset={[-5, 5]}>
                                <BellOutlined style={{ fontSize: 20, color: '#000', cursor: 'pointer' }} />
                            </Badge>
                        </Popover>
                    </div>
                    <Input
                        placeholder="Search..."
                        prefix={<SearchOutlined />}
                        style={{ width: 200, borderRadius: '6px' }}
                    />
                </Space>
            </Header>

            <Layout style={{ marginTop: '64px', height: 'calc(100vh - 64px)', background: '#f5f5f5' }}>
                {/* Fixed Left Sidebar */}
                <Sider
                    className="dashboard-sider"
                    width={240}
                    theme="light"
                    style={{
                        borderRight: '1px solid #f0f0f0',
                        height: 'calc(100vh - 64px)',
                        overflow: 'hidden',
                        position: 'fixed',
                        left: 0,
                        top: '64px',
                        background: '#ffffff',
                        boxShadow: '6px 0 18px rgba(15, 18, 21, 0.04)'
                    }}
                    collapsible
                    collapsed={collapsed}
                    trigger={null}
                >
                    <div style={{ padding: collapsed ? '24px 8px' : '24px 24px 0', display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ marginBottom: 24, paddingLeft: collapsed ? 12 : 0 }}>
                            <button
                                type="button"
                                onClick={() => setCollapsed(!collapsed)}
                                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                                style={{
                                    border: '1px solid #f0f0f0',
                                    borderRadius: 12,
                                    width: 40,
                                    height: 36,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    background: '#fff',
                                    transition: 'box-shadow 0.3s ease',
                                }}
                                onMouseEnter={(event) => {
                                    event.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)';
                                }}
                                onMouseLeave={(event) => {
                                    event.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <span style={hamburgerLineStyle('top')} />
                                    <span style={hamburgerLineStyle('middle')} />
                                    <span style={hamburgerLineStyle('bottom')} />
                                </span>
                            </button>
                        </div>

                        {/* User Info Section */}
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32, justifyContent: collapsed ? 'center' : 'flex-start', flexDirection: collapsed ? 'column' : 'row' }}>
                            <Avatar size={collapsed ? 40 : 64} src={avatarUrl} style={{ backgroundColor: '#d9d9d9', marginRight: collapsed ? 0 : 16 }} />
                            {!collapsed && (
                                <div>
                                    <Title level={4} style={{ margin: 0, fontWeight: 'normal' }}>Hi <span style={{ color: '#1890ff' }}>{greetingName}</span>!</Title>
                                    <Text type="secondary">{userRole}</Text>
                                </div>
                            )}
                        </div>

                        {/* Navigation Menu */}
                        <div style={{ marginBottom: 16 }}>
                            {!collapsed && <Text strong style={{ color: '#1890ff', fontSize: '12px', letterSpacing: '1px' }}>OVERVIEW</Text>}
                            <Space direction="vertical" style={{ width: '100%', marginTop: 16 }} size={8}>
                                <Button
                                    type="text"
                                    block
                                    icon={<DashboardOutlined />}
                                    {...navButtonInteractions('dashboard', { active: true })}
                                >
                                    {!collapsed && "Dashboard"}
                                </Button>
                                <Button
                                    type="text"
                                    block
                                    icon={<TeamOutlined />}
                                    {...navButtonInteractions('team')}
                                >
                                    {!collapsed && "Team Management"}
                                </Button>
                                <Button
                                    type="text"
                                    block
                                    icon={<DesktopOutlined />}
                                    {...navButtonInteractions('workspace')}
                                >
                                    {!collapsed && "Real-time Workspace"}
                                </Button>
                                <Button
                                    type="text"
                                    block
                                    icon={<TableOutlined />}
                                    {...navButtonInteractions('kanban')}
                                >
                                    {!collapsed && "Kanban Board Detail"}
                                </Button>
                                <Button
                                    type="text"
                                    block
                                    icon={<FormOutlined />}
                                    {...navButtonInteractions('whiteboard')}
                                >
                                    {!collapsed && "Whiteboard Canvas"}
                                </Button>
                                <Button
                                    type="text"
                                    block
                                    icon={<VideoCameraOutlined />}
                                    {...navButtonInteractions('video')}
                                >
                                    {!collapsed && "Video Meeting Room"}
                                </Button>
                                <Button
                                    type="text"
                                    block
                                    icon={<SendOutlined />}
                                    {...navButtonInteractions('submission')}
                                >
                                    {!collapsed && "Submission Portal"}
                                </Button>
                                <Button
                                    type="text"
                                    block
                                    icon={<FileTextOutlined />}
                                    {...navButtonInteractions('peer')}
                                >
                                    {!collapsed && "Peer Review Form"}
                                </Button>
                            </Space>
                        </div>

                        {/* Spacer to position settings slightly lower */}
                        <div style={{ height: collapsed ? 12 : 200 }} />

                        {/* Settings Section */}
                        <div>
                            {!collapsed && <Text strong style={{ color: '#1890ff', fontSize: '12px', letterSpacing: '1px' }}>SETTINGS</Text>}
                            <Space direction="vertical" style={{ width: '100%', marginTop: 16 }} size={8}>
                                <Button
                                    type="text"
                                    block
                                    icon={<SettingOutlined />}
                                    onClick={() => navigate('/profile')}
                                    {...navButtonInteractions('settings')}
                                >
                                    {!collapsed && "Settings"}
                                </Button>
                                <Button
                                    type="text"
                                    block
                                    icon={<LogoutOutlined />}
                                    onClick={logout}
                                    {...navButtonInteractions('logout', { danger: true })}
                                >
                                    {!collapsed && "Logout"}
                                </Button>
                            </Space>
                        </div>
                    </div>
                </Sider>

                {/* Main Content */}
                <Content className="dashboard-content" style={{
                    marginLeft: collapsed ? '80px' : '240px',
                    marginRight: '300px',
                    padding: '24px',
                    background: '#f5f5f5',
                    minHeight: 'calc(100vh - 64px)'
                }}>
                    {/* TOP SECTION: Active Projects and Timeline */}
                    <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
                        {/* Active Projects Box */}
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

                        {/* Timeline Box */}
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
                                    <Timeline className="timeline-list">
                                        {timelineData.map((item, index) => (
                                            <Timeline.Item color={index % 2 === 0 ? 'blue' : 'green'} key={item.id}>
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
                                            </Timeline.Item>
                                        ))}
                                    </Timeline>
                                </div>
                            </Card>
                        </Col>
                    </Row>

                    {/* BOTTOM SECTION: Files */}
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
                        {/* Files Stats Row */}
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

                        {/* Uploaded Files List */}
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

                        {/* Recent Files Header */}
                        <div style={{ marginBottom: 16 }}>
                            <Text strong style={{ fontSize: '14px' }}>Recent Files</Text>
                        </div>

                        {/* Files Grid */}
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

                        {/* Quick Actions */}
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

                    {/* Extra content to show scrolling */}
                    <div style={{ height: '200px', marginTop: '24px' }} />
                </Content>

                {/* Fixed Right Sidebar - Calendar & Recent Activities */}
                <Sider
                    className="dashboard-sider dashboard-sider--right"
                    width={300}
                    theme="light"
                    style={{
                        position: 'fixed',
                        right: 0,
                        top: '64px',
                        height: 'calc(100vh - 64px)',
                        overflow: 'auto',
                        borderLeft: '1px solid #f0f0f0',
                        background: '#fff'
                    }}
                >
                    <div style={{ padding: '24px' }}>
                        {/* CALENDAR SECTION */}
                        <div style={{
                            background: '#fff',
                            borderRadius: 12,
                            padding: '16px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                            marginBottom: 24
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Text strong style={{ fontSize: '16px' }}>{currentDate.format('MMMM YYYY')}</Text>
                                <Space>
                                    <Button
                                        size="small"
                                        type="text"
                                        icon={<LeftOutlined />}
                                        onClick={prevMonth}
                                        style={{ border: '1px solid #d9d9d9' }}
                                    />
                                    <Button
                                        size="small"
                                        type="text"
                                        icon={<RightOutlined />}
                                        onClick={nextMonth}
                                        style={{ border: '1px solid #d9d9d9' }}
                                    />
                                </Space>
                            </div>

                            {/* Calendar Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', gap: '4px' }}>
                                {/* Weekday headers */}
                                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                                    <Text key={day} type="secondary" style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: 4 }}>{day}</Text>
                                ))}

                                {/* Empty days from previous month */}
                                {emptyDays.map(i => <div key={`empty-${i}`} style={{ height: '32px' }} />)}

                                {/* Days of current month */}
                                {daysArray.map(day => {
                                    const isToday = day === dayjs().date() && currentDate.isSame(dayjs(), 'month');
                                    return (
                                        <div
                                            key={day}
                                            className={`calendar-day${isToday ? ' calendar-day--today' : ''}`}
                                        >
                                            {day}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* RECENT ACTIVITIES SECTION */}
                        <div style={{ marginBottom: 24 }}>
                            <Title level={5} style={{ marginBottom: 12 }}>Recent activities</Title>
                            <div style={{
                                background: '#f5f5f5',
                                borderRadius: 12,
                                padding: '16px',
                                minHeight: 150
                            }}>
                                <List
                                    dataSource={recentActivities}
                                    renderItem={item => (
                                        <List.Item
                                            className="recent-activity-item"
                                        >
                                            <Typography.Text style={{ fontSize: '14px' }}>{item}</Typography.Text>
                                        </List.Item>
                                    )}
                                />
                            </div>
                            <div style={{ textAlign: 'right', marginTop: 8 }}>
                                <Text className="recent-activity-cta">
                                    see more
                                </Text>
                            </div>
                        </div>

                        {/* Optional: Additional widget */}
                        <div style={{
                            background: '#f9f0ff',
                            borderRadius: 12,
                            padding: '16px',
                            textAlign: 'center'
                        }}>
                            <Title level={5} style={{ color: '#722ed1' }}>Upcoming Events</Title>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                No events scheduled for today
                            </Text>
                        </div>
                    </div>
                </Sider>
            </Layout>



            <Modal
                title="Schedule Timeline Event"
                open={isEventModalOpen}
                onCancel={() => {
                    setEventModalOpen(false);
                    eventForm.resetFields();
                }}
                footer={null}
                width={520}
                destroyOnClose
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
        </Layout>
    );
};

export default ProjectDashboard;