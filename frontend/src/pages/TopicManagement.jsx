import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Alert, Layout, Typography, Button, Card, Row, Col, Progress, List, Table,
    Avatar, Space, Badge, Input, Upload, Timeline, Tag, Divider,
    Modal, Form, Select, DatePicker, message, Dropdown, Popover
} from 'antd';
import {
    SettingOutlined, BellOutlined, SearchOutlined, PlusOutlined,
    DashboardOutlined, TeamOutlined, DesktopOutlined, TableOutlined,
    FileTextOutlined, VideoCameraOutlined, SendOutlined, FormOutlined,
    BookOutlined, CheckSquareOutlined,
    LogoutOutlined, UserOutlined, FilePdfOutlined,
    FileImageOutlined, FileOutlined, ClockCircleOutlined, UploadOutlined,
    MoreOutlined, CheckCircleOutlined, SyncOutlined, PlayCircleOutlined,
    FolderOutlined, CloudUploadOutlined, CalendarOutlined, ProjectOutlined,
    LeftOutlined, RightOutlined, DeleteOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth, resolveRoleName } from '../components/AuthContext';
import { lecturerTopicsService } from '../services/lecturerTopicsService';
import './StudentDashboard.css';
import './TopicManagement.css';

const { Title, Text } = Typography;
const { Header, Sider, Content } = Layout;

const STORAGE_BASE_KEYS = {
    avatar: 'user_avatar',
};

const LEGACY_KEYS = {
    avatar: 'user_avatar',
};

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const buildScopedKey = (baseKey, user) => {
    const identifier = user?.id || user?.email;
    return identifier ? `${baseKey}_${identifier}` : `${baseKey}_default`;
};

const readScopedAvatar = (storageKey, fallback) => {
    if (!canUseStorage() || !storageKey) {
        return fallback;
    }
    const scopedValue = window.localStorage.getItem(storageKey);
    return scopedValue || fallback;
};

const readScopedProfile = (storageKey, user) => {
    if (!canUseStorage() || !storageKey) {
        return null;
    }
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw);
        if (parsed?._owner && user?.email && parsed._owner !== user.email) {
            return null;
        }
        return parsed;
    } catch (_err) {
        return null;
    }
};

const readActiveProjectsPayload = (storageKey, user) => {
    if (!canUseStorage()) {
        return [];
    }
    const scopedRaw = storageKey ? window.localStorage.getItem(storageKey) : null;
    const raw = scopedRaw || window.localStorage.getItem('active_projects');
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed;
        }
        if (parsed && Array.isArray(parsed.items)) {
            if (!scopedRaw && parsed._owner && user?.email && parsed._owner !== user.email) {
                return [];
            }
            return parsed.items;
        }
        return [];
    } catch (_err) {
        return [];
    }
};

const getProjectIcon = (project) => {
    if (React.isValidElement(project.icon)) {
        return project.icon;
    }
    if (project.iconType === 'project') {
        return <ProjectOutlined />;
    }
    return <ProjectOutlined />;
};

const normalizeStatus = (value) => (value ? String(value).toUpperCase() : 'UNKNOWN');

const formatTopicStatus = (value) => {
    const normalized = normalizeStatus(value);
    switch (normalized) {
        case 'APPROVED':
            return 'Approved';
        case 'REJECTED':
            return 'Rejected';
        case 'PENDING':
            return 'Pending';
        case 'DRAFT':
            return 'Draft';
        default:
            return normalized;
    }
};

const buildTopicRow = (topic) => {
    const rawStatus = normalizeStatus(topic?.status);
    return {
        key: String(topic?.topic_id ?? topic?.id ?? Math.random()),
        topicId: topic?.topic_id ?? topic?.id,
        author: topic?.created_by || 'Unknown',
        title: topic?.title || 'Untitled',
        description: topic?.description || '',
        requirements: topic?.requirements || '',
        team: topic?.team || topic?.team_name || '-',
        status: formatTopicStatus(rawStatus),
        rawStatus,
        createdAt: topic?.created_at,
        approvedBy: topic?.approved_by,
        approvedAt: topic?.approved_at,
    };
};

const extractErrorMessage = (error, fallback) => {
    if (error?.response?.data?.detail) {
        return error.response.data.detail;
    }
    if (error?.message) {
        return error.message;
    }
    return fallback;
};

const isAuthError = (error) => error?.response?.status === 401;
const isForbiddenError = (error) => error?.response?.status === 403;

const getStatusTag = (status) => {
    const normalized = normalizeStatus(status);
    switch (normalized) {
        case 'APPROVED':
            return <Tag color="green">Approved</Tag>;
        case 'REJECTED':
            return <Tag color="red">Rejected</Tag>;
        case 'PENDING':
            return <Tag color="gold">Pending</Tag>;
        case 'DRAFT':
            return <Tag color="blue">Draft</Tag>;
        default:
            return <Tag>{normalized}</Tag>;
    }
};

const TopicManagement = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [collapsed, setCollapsed] = useState(false);
    const [isNotificationOpen, setNotificationOpen] = useState(false);
    const notificationAnchorRef = useRef(null);
    const profileStorageKey = useMemo(() => buildScopedKey('user_profile', user), [user]);
    const avatarStorageKey = useMemo(() => buildScopedKey(STORAGE_BASE_KEYS.avatar, user), [user]);
    const activeProjectsStorageKey = useMemo(() => buildScopedKey('active_projects', user), [user]);
    const [avatarUrl, setAvatarUrl] = useState(() => readScopedAvatar(avatarStorageKey, user?.avatar_url || null));
    const [profileSnapshot, setProfileSnapshot] = useState(() => {
        const scoped = readScopedProfile(profileStorageKey, user);
        if (scoped) {
            return scoped;
        }
        if (!canUseStorage()) {
            return null;
        }
        const raw = window.localStorage.getItem('user_profile');
        if (!raw) {
            return null;
        }
        try {
            const parsed = JSON.parse(raw);
            if (parsed?._owner && user?.email && parsed._owner !== user.email) {
                return null;
            }
            return parsed;
        } catch (_err) {
            return null;
        }
    });

    useEffect(() => {
        if (!canUseStorage()) {
            return;
        }
        window.localStorage.removeItem(LEGACY_KEYS.avatar);
    }, []);

    useEffect(() => {
        setAvatarUrl(readScopedAvatar(avatarStorageKey, user?.avatar_url || null));
    }, [avatarStorageKey, user?.avatar_url]);

    useEffect(() => {
        const handleAvatarUpdated = () => {
            setAvatarUrl(readScopedAvatar(avatarStorageKey, user?.avatar_url || null));
        };

        window.addEventListener('avatar-updated', handleAvatarUpdated);
        window.addEventListener('storage', handleAvatarUpdated);
        return () => {
            window.removeEventListener('avatar-updated', handleAvatarUpdated);
            window.removeEventListener('storage', handleAvatarUpdated);
        };
    }, [avatarStorageKey, user?.avatar_url]);

    useEffect(() => {
        const scopedProfile = readScopedProfile(profileStorageKey, user);
        if (scopedProfile) {
            setProfileSnapshot(scopedProfile);
            return;
        }
        if (!canUseStorage()) {
            setProfileSnapshot(null);
            return;
        }
        const raw = window.localStorage.getItem('user_profile');
        if (!raw) {
            setProfileSnapshot(null);
            return;
        }
        try {
            const parsed = JSON.parse(raw);
            if (parsed?._owner && user?.email && parsed._owner !== user.email) {
                setProfileSnapshot(null);
                return;
            }
            setProfileSnapshot(parsed);
        } catch (_err) {
            setProfileSnapshot(null);
        }
    }, [profileStorageKey, user?.full_name, user?.email]);

    useEffect(() => {
        const handleProfileUpdated = () => {
            const scopedProfile = readScopedProfile(profileStorageKey, user);
            if (scopedProfile) {
                setProfileSnapshot(scopedProfile);
                return;
            }
            if (!canUseStorage()) {
                return;
            }
            const raw = window.localStorage.getItem('user_profile');
            if (!raw) {
                setProfileSnapshot(null);
                return;
            }
            try {
                const parsed = JSON.parse(raw);
                if (parsed?._owner && user?.email && parsed._owner !== user.email) {
                    setProfileSnapshot(null);
                    return;
                }
                setProfileSnapshot(parsed);
            } catch (_err) {
                setProfileSnapshot(null);
            }
        };

        window.addEventListener('profile-updated', handleProfileUpdated);
        window.addEventListener('storage', handleProfileUpdated);
        return () => {
            window.removeEventListener('profile-updated', handleProfileUpdated);
            window.removeEventListener('storage', handleProfileUpdated);
        };
    }, [profileStorageKey, user]);

    useEffect(() => {
        if (!canUseStorage() || !avatarStorageKey) {
            return;
        }
        if (avatarUrl) {
            window.localStorage.setItem(avatarStorageKey, avatarUrl);
        } else {
            window.localStorage.removeItem(avatarStorageKey);
        }
    }, [avatarUrl, avatarStorageKey]);
    const greetingName = useMemo(() => {
        const fallback = user?.email || 'there';
        const source = profileSnapshot?.name || user?.full_name || fallback;
        const parts = source.trim().split(' ').filter(Boolean);
        return parts.length ? parts[parts.length - 1] : source;
    }, [profileSnapshot?.name, user]);
    const [currentDate, setCurrentDate] = useState(dayjs());
    const [isEventModalOpen, setEventModalOpen] = useState(false);
    const [eventForm] = Form.useForm();
    const [isTopicModalOpen, setTopicModalOpen] = useState(false);
    const [topicForm] = Form.useForm();
    const [editingTopic, setEditingTopic] = useState(null);
    const [totalFiles, setTotalFiles] = useState(124);
    const [storageUsage, setStorageUsage] = useState(65);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [hoveredNav, setHoveredNav] = useState(null);
    const [activeTopicTab, setActiveTopicTab] = useState('list');
    const [topicSearch, setTopicSearch] = useState('');
    const [topicStatusFilter, setTopicStatusFilter] = useState('ALL');
    const [topicsLoading, setTopicsLoading] = useState(false);
    const [topicsError, setTopicsError] = useState('');
    const [topicActionLoading, setTopicActionLoading] = useState({});
    const [topicDetailOpen, setTopicDetailOpen] = useState(false);
    const [selectedTopic, setSelectedTopic] = useState(null);
    const [evaluationOpen, setEvaluationOpen] = useState(false);
    const [evaluationForm] = Form.useForm();

    const navButtonStyles = (key, { active, danger } = {}) => ({
        textAlign: collapsed ? 'center' : 'left',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 8,
        padding: collapsed ? '8px 0' : '8px 12px',
        color: danger ? '#d4380d' : active ? '#1890ff' : '#595959',
        fontWeight: active ? 600 : 500,
        backgroundColor: hoveredNav === key ? 'rgba(24, 144, 255, 0.08)' : 'transparent',
        transform: hoveredNav === key && !collapsed ? 'translateX(2px)' : 'none',
        transition: 'all 0.2s ease',
    });

    const navButtonInteractions = (key, options) => ({
        style: navButtonStyles(key, options),
        onMouseEnter: () => setHoveredNav(key),
        onMouseLeave: () => setHoveredNav(null),
    });

    const hamburgerLineBase = {
        width: 18,
        height: 2,
        backgroundColor: '#262626',
        display: 'block',
        borderRadius: 2,
        transition: 'transform 0.3s ease, opacity 0.3s ease',
    };

    const hamburgerLineStyle = (position) => {
        if (collapsed) {
            switch (position) {
                case 'top':
                    return { ...hamburgerLineBase, transform: 'translateY(0) rotate(0)' };
                case 'middle':
                    return { ...hamburgerLineBase, opacity: 1 };
                case 'bottom':
                default:
                    return { ...hamburgerLineBase, transform: 'translateY(0) rotate(0)' };
            }
        }
        switch (position) {
            case 'top':
                return { ...hamburgerLineBase, transform: 'translateY(6px) rotate(45deg)' };
            case 'middle':
                return { ...hamburgerLineBase, opacity: 0 };
            case 'bottom':
            default:
                return { ...hamburgerLineBase, transform: 'translateY(-6px) rotate(-45deg)' };
        }
    };

    // Determine Role
    const userRole = useMemo(() => {
        const rawRole = resolveRoleName(user) || 'Student'; // Fallback
        // Normalize for display: "HEAD_DEPT" -> "Head Dept"
        return rawRole
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }, [user]);

    // Role-based Data
    const roleBasedProjects = useMemo(() => {
        const roleUpper = userRole.toUpperCase();
        if (roleUpper === 'STUDENT') {
            return [
                { id: 1, title: 'Introduction to AI', description: 'Complete the weekly assignments and quiz', icon: <PlayCircleOutlined /> },
                { id: 2, title: 'Web Development', description: 'Build a personal portfolio website', icon: <PlayCircleOutlined /> },
                { id: 3, title: 'Database Systems', description: 'Design a relational database schema', icon: <PlayCircleOutlined /> },
            ];
        } else if (roleUpper === 'LECTURER' || roleUpper === 'ADMIN' || roleUpper === 'STAFF') {
            return [
                { id: 1, title: 'AI Course Grading', description: 'Grade the midterm submissions', icon: <PlayCircleOutlined /> },
                { id: 2, title: 'Curriculum Review', description: 'Update the syllabus for next semester', icon: <PlayCircleOutlined /> },
                { id: 3, title: 'Research Grant', description: 'Prepare proposal for research funding', icon: <PlayCircleOutlined /> },
                { id: 4, title: 'Department Meeting', description: 'Weekly sync with faculty members', icon: <PlayCircleOutlined /> },
            ];
        }
        return [
            { id: 1, title: 'Project A', description: 'Website redesign with improved UX and responsive layout', icon: <PlayCircleOutlined /> },
            { id: 2, title: 'Project B', description: 'Mobile app development for campus navigation', icon: <PlayCircleOutlined /> },
            { id: 3, title: 'Project C', description: 'AI-powered learning assistant system', icon: <PlayCircleOutlined /> },
            { id: 4, title: 'Project D', description: 'E-commerce platform optimization', icon: <PlayCircleOutlined /> },
        ];
    }, [userRole]);

    const roleBasedTimeline = useMemo(() => {
        const roleUpper = userRole.toUpperCase();
        if (roleUpper === 'STUDENT') {
            return [
                { id: 101, date: 'Nov. 10, 2025', project: 'Intro to AI', description: 'Submitted Assignment 1', status: 'completed' },
                { id: 102, date: 'Nov. 12, 2025', project: 'Web Dev', description: 'Started working on Portfolio', status: 'in-progress' },
                { id: 103, date: 'Nov. 15, 2025', project: 'Database', description: 'Quiz 2 due', status: 'pending' },
            ];
        } else if (roleUpper === 'LECTURER' || roleUpper === 'ADMIN' || roleUpper === 'STAFF') {
            return [
                { id: 101, date: 'Nov. 10, 2025', project: 'AI Grading', description: 'Completed grading for section A', status: 'completed' },
                { id: 102, date: 'Nov. 12, 2025', project: 'Curriculum', description: 'Drafted new module', status: 'in-progress' },
                { id: 103, date: 'Nov. 15, 2025', project: 'Meeting', description: 'Faculty board meeting', status: 'pending' },
            ];
        }
        return [
            { id: 101, date: 'Nov. 10, 2025', project: 'Project A', description: 'Project kickoff meeting and requirements gathering', status: 'completed' },
            { id: 102, date: 'Nov. 12, 2025', project: 'Project B', description: 'Initial design review and feedback session', status: 'in-progress' },
            { id: 103, date: 'Nov. 15, 2025', project: 'Project C', description: 'Development sprint planning and task assignment', status: 'pending' },
            { id: 104, date: 'Nov. 17, 2025', project: 'Project D', description: 'Client presentation and milestone review', status: 'in-progress' },
            { id: 105, date: 'Nov. 20, 2025', project: 'Project A', description: 'User testing phase begins', status: 'pending' },
        ];
    }, [userRole]);


    // Active Projects Data
    const [activeProjects, setActiveProjects] = useState(() => {
        const stored = readActiveProjectsPayload(activeProjectsStorageKey, user);
        return [...roleBasedProjects, ...stored].reduce((acc, item) => {
            const id = String(item.id ?? item.title ?? Math.random());
            if (acc.some((existing) => String(existing.id ?? existing.title) === id)) {
                return acc;
            }
            acc.push(item);
            return acc;
        }, []);
    });

    // Update state when role changes
    useEffect(() => {
        const stored = readActiveProjectsPayload(activeProjectsStorageKey, user);
        const merged = [...roleBasedProjects, ...stored].reduce((acc, item) => {
            const id = String(item.id ?? item.title ?? Math.random());
            if (acc.some((existing) => String(existing.id ?? existing.title) === id)) {
                return acc;
            }
            acc.push(item);
            return acc;
        }, []);
        setActiveProjects(merged);
    }, [roleBasedProjects, activeProjectsStorageKey, user]);

    useEffect(() => {
        const handleActiveProjectsUpdate = () => {
            const stored = readActiveProjectsPayload(activeProjectsStorageKey, user);
            const merged = [...roleBasedProjects, ...stored].reduce((acc, item) => {
                const id = String(item.id ?? item.title ?? Math.random());
                if (acc.some((existing) => String(existing.id ?? existing.title) === id)) {
                    return acc;
                }
                acc.push(item);
                return acc;
            }, []);
            setActiveProjects(merged);
        };

        window.addEventListener('active-projects-updated', handleActiveProjectsUpdate);
        window.addEventListener('storage', handleActiveProjectsUpdate);
        return () => {
            window.removeEventListener('active-projects-updated', handleActiveProjectsUpdate);
            window.removeEventListener('storage', handleActiveProjectsUpdate);
        };
    }, [activeProjectsStorageKey, roleBasedProjects, user]);

    // Timeline Data
    const [timelineData, setTimelineData] = useState(roleBasedTimeline);

    // Update state when role changes
    useEffect(() => {
        setTimelineData(roleBasedTimeline);
    }, [roleBasedTimeline]);

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

    const initialTopics = [];

    const [topicRows, setTopicRows] = useState(initialTopics);

    const proposalRows = useMemo(() => topicRows.filter((item) => {
        const status = item.rawStatus || normalizeStatus(item.status);
        return status === 'DRAFT' || status === 'PENDING';
    }), [topicRows]);

    const handleRefreshTopics = useCallback(async () => {
        setTopicsLoading(true);
        setTopicsError('');
        try {
            const response = await lecturerTopicsService.listTopics();
            const payload = Array.isArray(response?.data?.topics)
                ? response.data.topics
                : Array.isArray(response?.data)
                    ? response.data
                    : [];
            const mappedTopics = payload.map((topic) => buildTopicRow(topic));
            setTopicRows(mappedTopics);
        } catch (error) {
            if (isAuthError(error)) {
                message.error('Session expired. Please sign in again.');
                logout();
                navigate('/login', { replace: true });
                return;
            }
            const errorMessage = extractErrorMessage(error, 'Failed to load topics');
            setTopicsError(errorMessage);
            message.error(errorMessage);
        } finally {
            setTopicsLoading(false);
        }
    }, [logout, navigate]);

    useEffect(() => {
        handleRefreshTopics();
    }, [handleRefreshTopics]);

    // Auto-refresh topics every 5 seconds to sync with database changes (e.g., when admin approves topics)
    useEffect(() => {
        const refreshInterval = setInterval(() => {
            handleRefreshTopics();
        }, 5000); // Refresh every 5 seconds

        return () => clearInterval(refreshInterval);
    }, [handleRefreshTopics]);

    const filteredTopics = useMemo(() => {
        const query = topicSearch.trim().toLowerCase();
        if (!query) {
            return topicRows.filter((item) => (
                topicStatusFilter === 'ALL'
                    ? true
                    : normalizeStatus(item.rawStatus || item.status) === topicStatusFilter
            ));
        }
        return topicRows.filter((item) => (
            item.author?.toLowerCase().includes(query)
            || item.title?.toLowerCase().includes(query)
            || item.team?.toLowerCase().includes(query)
            || item.status?.toLowerCase().includes(query)
        )).filter((item) => (
            topicStatusFilter === 'ALL'
                ? true
                : normalizeStatus(item.rawStatus || item.status) === topicStatusFilter
        ));
    }, [topicRows, topicSearch, topicStatusFilter]);

    const filteredProposals = useMemo(() => {
        const query = topicSearch.trim().toLowerCase();
        const statusMatch = (item) => {
            if (topicStatusFilter === 'ALL') {
                return true;
            }
            return normalizeStatus(item.rawStatus || item.status) === topicStatusFilter;
        };
        if (!query) {
            return proposalRows.filter(statusMatch);
        }
        return proposalRows.filter((item) => (
            item.author?.toLowerCase().includes(query)
            || item.title?.toLowerCase().includes(query)
            || item.team?.toLowerCase().includes(query)
        )).filter(statusMatch);
    }, [proposalRows, topicSearch, topicStatusFilter]);

    const openTopicDetail = (record) => {
        setSelectedTopic(record);
        setTopicDetailOpen(true);
    };

    const openEvaluationForm = (record) => {
        setSelectedTopic(record);
        evaluationForm.resetFields();
        evaluationForm.setFieldsValue({
            team_id: null,
            project_id: null,
            score: null,
            feedback: '',
        });
        setEvaluationOpen(true);
    };

    const topicColumns = [
        {
            title: 'Author',
            dataIndex: 'author',
            key: 'author',
        },
        {
            title: 'Topic title',
            dataIndex: 'title',
            key: 'title',
        },
        {
            title: 'Team',
            dataIndex: 'team',
            key: 'team',
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (_value, record) => getStatusTag(record.rawStatus || record.status),
        },
        {
            title: 'Activity',
            key: 'activity',
            width: 240,
            align: 'center',
            render: (_value, record) => (
                <Space size="small">
                    <Button size="small" onClick={() => openTopicDetail(record)}>View</Button>
                    <Button size="small" onClick={() => openEvaluationForm(record)}>Evaluate</Button>
                    <Button size="small" onClick={() => openEditTopic(record)}>Edit</Button>
                    <Button size="small" danger onClick={() => handleDeleteTopic(record)}>Delete</Button>
                </Space>
            ),
        },
    ];

    const proposalColumns = [
        {
            title: 'Team',
            dataIndex: 'team',
            key: 'team',
        },
        {
            title: 'Name of topic',
            dataIndex: 'title',
            key: 'title',
        },
        {
            title: 'Activity',
            key: 'activity',
            width: 200,
            align: 'center',
            render: (_value, record) => (
                <Space size="small">
                    <Button size="small" onClick={() => openTopicDetail(record)}>View</Button>
                    <Button
                        size="small"
                        type="primary"
                        loading={!!topicActionLoading[record.topicId]}
                        onClick={() => {
                            Modal.confirm({
                                title: 'Approve topic?',
                                content: `Approve "${record.title}"?`,
                                okText: 'Approve',
                                cancelText: 'Cancel',
                                onOk: () => handleApproveProposal(record),
                            });
                        }}
                    >
                        Approve
                    </Button>
                    <Button
                        size="small"
                        danger
                        loading={!!topicActionLoading[record.topicId]}
                        onClick={() => {
                            Modal.confirm({
                                title: 'Reject topic?',
                                content: `Reject "${record.title}"?`,
                                okText: 'Reject',
                                okButtonProps: { danger: true },
                                cancelText: 'Cancel',
                                onOk: () => handleRejectProposal(record),
                            });
                        }}
                    >
                        Reject
                    </Button>
                </Space>
            ),
        },
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

    const openCreateTopic = () => {
        setEditingTopic(null);
        topicForm.setFieldsValue({
            title: '',
            description: '',
            requirements: '',
        });
        setTopicModalOpen(true);
    };

    const openEditTopic = (record) => {
        setEditingTopic(record);
        topicForm.setFieldsValue({
            title: record.title,
            description: record.description || '',
            requirements: record.requirements || '',
        });
        setTopicModalOpen(true);
    };

    const handleSaveTopic = async () => {
        const values = await topicForm.validateFields();
        if (editingTopic) {
            setTopicRows((prev) => prev.map((item) => (
                item.key === editingTopic.key
                    ? { ...item, ...values }
                    : item
            )));
            message.success('Topic updated');
        } else {
            try {
                const response = await lecturerTopicsService.createTopic({
                    title: values.title,
                    description: values.description,
                    requirements: values.requirements,
                });
                const created = buildTopicRow(response?.data);
                setTopicRows((prev) => [created, ...prev]);
                message.success('Topic created');
            } catch (error) {
                if (isAuthError(error)) {
                    message.error('Session expired. Please sign in again.');
                    logout();
                    navigate('/login', { replace: true });
                    return;
                }
                if (isForbiddenError(error)) {
                    message.error(extractErrorMessage(error, 'You do not have permission to create topics.'));
                    return;
                }
                message.error(extractErrorMessage(error, 'Failed to create topic'));
                return;
            }
        }
        setTopicModalOpen(false);
        topicForm.resetFields();
    };

    const handleDeleteTopic = async (record) => {
        if (!record?.topicId) {
            message.error('Missing topic id');
            return;
        }
        try {
            await lecturerTopicsService.deleteTopic(record.topicId);
            setTopicRows((prev) => prev.filter((item) => item.topicId !== record.topicId));
            message.success('Topic deleted');
        } catch (error) {
            if (isAuthError(error)) {
                message.error('Session expired. Please sign in again.');
                logout();
                navigate('/login', { replace: true });
                return;
            }
            if (isForbiddenError(error)) {
                message.error(extractErrorMessage(error, 'You do not have permission to delete this topic.'));
                return;
            }
            message.error(extractErrorMessage(error, 'Failed to delete topic'));
        }
    };

    const handleApproveProposal = async (record) => {
        if (!record?.topicId) {
            message.error('Missing topic id');
            return;
        }
        setTopicActionLoading((prev) => ({ ...prev, [record.topicId]: true }));
        try {
            await lecturerTopicsService.approveTopic(record.topicId);
            setTopicRows((prev) => prev.map((item) => (
                item.topicId === record.topicId
                    ? { ...item, status: formatTopicStatus('APPROVED'), rawStatus: 'APPROVED' }
                    : item
            )));
            setActiveTopicTab('list');
            message.success('Topic approved');
        } catch (error) {
            if (isAuthError(error)) {
                message.error('Session expired. Please sign in again.');
                logout();
                navigate('/login', { replace: true });
                return;
            }
            if (isForbiddenError(error)) {
                message.error(extractErrorMessage(error, 'You do not have permission to approve topics.'));
                return;
            }
            message.error(extractErrorMessage(error, 'Failed to approve topic'));
        } finally {
            setTopicActionLoading((prev) => ({ ...prev, [record.topicId]: false }));
        }
    };

    const handleRejectProposal = async (record) => {
        if (!record?.topicId) {
            message.error('Missing topic id');
            return;
        }
        setTopicActionLoading((prev) => ({ ...prev, [record.topicId]: true }));
        try {
            await lecturerTopicsService.rejectTopic(record.topicId);
            setTopicRows((prev) => prev.map((item) => (
                item.topicId === record.topicId
                    ? { ...item, status: formatTopicStatus('REJECTED'), rawStatus: 'REJECTED' }
                    : item
            )));
            message.success('Topic rejected');
        } catch (error) {
            if (isAuthError(error)) {
                message.error('Session expired. Please sign in again.');
                logout();
                navigate('/login', { replace: true });
                return;
            }
            if (isForbiddenError(error)) {
                message.error(extractErrorMessage(error, 'You do not have permission to reject topics.'));
                return;
            }
            message.error(extractErrorMessage(error, 'Failed to reject topic'));
        } finally {
            setTopicActionLoading((prev) => ({ ...prev, [record.topicId]: false }));
        }
    };

    const handleEvaluationSubmit = async () => {
        if (!selectedTopic?.topicId) {
            message.error('Missing topic id');
            return;
        }
        try {
            const values = await evaluationForm.validateFields();
            await lecturerTopicsService.createEvaluation(selectedTopic.topicId, values);
            message.success('Evaluation submitted');
            setEvaluationOpen(false);
            evaluationForm.resetFields();
        } catch (error) {
            if (isAuthError(error)) {
                message.error('Session expired. Please sign in again.');
                logout();
                navigate('/login', { replace: true });
                return;
            }
            if (isForbiddenError(error)) {
                message.error(extractErrorMessage(error, 'You do not have permission to create evaluations.'));
                return;
            }
            message.error(extractErrorMessage(error, 'Failed to submit evaluation'));
        }
    };

    const deleteProject = (id) => {
        setActiveProjects((prev) => prev.filter((project) => project.id !== id));
        if (canUseStorage() && activeProjectsStorageKey) {
            const stored = readActiveProjectsPayload(activeProjectsStorageKey, user);
            const nextItems = stored.filter((project) => String(project.id) !== String(id));
            const payload = { _owner: user?.email || null, items: nextItems };
            window.localStorage.setItem(activeProjectsStorageKey, JSON.stringify(payload));
            window.localStorage.setItem('active_projects', JSON.stringify(payload));
            window.dispatchEvent(new CustomEvent('active-projects-updated', { detail: { items: nextItems } }));
        }
        message.success('Project removed');
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
                            arrow={{ pointAtCenter: true }}
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
                                    onClick={() => navigate('/lecturer')}
                                    {...navButtonInteractions('dashboard')}
                                >
                                    {!collapsed && "Dashboard"}
                                </Button>
                                <Button
                                    type="text"
                                    block
                                    icon={<BookOutlined />}
                                    onClick={() => navigate('/topics')}
                                    {...navButtonInteractions('topics', { active: true })}
                                >
                                    {!collapsed && "Topic management"}
                                </Button>
                                <Button
                                    type="text"
                                    block
                                    icon={<CloudUploadOutlined />}
                                    onClick={() => navigate('/mentoring')}
                                    {...navButtonInteractions('mentoring')}
                                >
                                    {!collapsed && "AI Mentoring"}
                                </Button>
                                <Button
                                    type="text"
                                    block
                                    icon={<CheckSquareOutlined />}
                                    onClick={() => navigate('/evaluations')}
                                    {...navButtonInteractions('grading')}
                                >
                                    {!collapsed && "Grading & Feedback"}
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
                    <div className="topic-header" style={{ marginBottom: 20 }}>
                        <Title level={3} style={{ marginBottom: 4 }}>TOPIC MANAGEMENT</Title>
                        <Text type="secondary">Create Topics or Approve Student Ideas</Text>
                    </div>

                    <Card
                        className="topic-create-card"
                        variant="borderless"
                        style={{
                            background: '#ebe7e7',
                            borderRadius: 12,
                            marginBottom: 24
                        }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <Text strong>Create new topic</Text>
                            <Button
                                type="default"
                                className="topic-create-btn"
                                icon={<PlusOutlined />}
                                style={{ alignSelf: 'flex-start' }}
                                onClick={openCreateTopic}
                            >
                                Create new topic
                            </Button>
                        </div>
                    </Card>

                    <div className="topic-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Space>
                            <Button
                                type={activeTopicTab === 'list' ? 'primary' : 'default'}
                                shape="round"
                                className="topic-tab"
                                onClick={() => setActiveTopicTab('list')}
                            >
                                List of topic
                            </Button>
                            <Button
                                type={activeTopicTab === 'proposals' ? 'primary' : 'default'}
                                shape="round"
                                className="topic-tab"
                                onClick={() => setActiveTopicTab('proposals')}
                            >
                                Student proposals
                            </Button>
                        </Space>
                        <Space>
                            <Select
                                value={topicStatusFilter}
                                onChange={setTopicStatusFilter}
                                style={{ minWidth: 150 }}
                            >
                                <Select.Option value="ALL">All statuses</Select.Option>
                                <Select.Option value="DRAFT">Draft</Select.Option>
                                <Select.Option value="PENDING">Pending</Select.Option>
                                <Select.Option value="APPROVED">Approved</Select.Option>
                                <Select.Option value="REJECTED">Rejected</Select.Option>
                            </Select>
                            <Input
                                prefix={<SearchOutlined />}
                                placeholder="Search a topic..."
                                className="topic-search"
                                style={{ maxWidth: 280 }}
                                value={topicSearch}
                                onChange={(event) => setTopicSearch(event.target.value)}
                            />
                        </Space>
                    </div>

                    {topicsError && (
                        <Alert
                            type="error"
                            showIcon
                            message="Unable to load topics"
                            description={topicsError}
                            action={(
                                <Button size="small" onClick={handleRefreshTopics}>
                                    Retry
                                </Button>
                            )}
                            style={{ marginBottom: 12 }}
                        />
                    )}

                    <Card variant="borderless" className="topic-table-card" style={{ borderRadius: 12 }}>
                        <Table
                            className="topic-table"
                            columns={activeTopicTab === 'proposals' ? proposalColumns : topicColumns}
                            dataSource={activeTopicTab === 'proposals' ? filteredProposals : filteredTopics}
                            loading={topicsLoading}
                            pagination={false}
                            size="small"
                            tableLayout="fixed"
                        />
                    </Card>

                    <Modal
                        title={editingTopic ? 'Edit topic' : 'Create topic'}
                        open={isTopicModalOpen}
                        onCancel={() => {
                            setTopicModalOpen(false);
                            topicForm.resetFields();
                        }}
                        onOk={handleSaveTopic}
                        okText={editingTopic ? 'Save' : 'Create'}
                        destroyOnHidden
                        forceRender
                    >
                        {!editingTopic && (
                            <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                                Projects are created after a topic is approved.
                            </Text>
                        )}
                        <Form layout="vertical" form={topicForm}>
                            <Form.Item
                                label="Topic title"
                                name="title"
                                rules={[{ required: true, message: 'Please enter a topic title' }]}
                            >
                                <Input placeholder="e.g. Smart Attendance Tracker" />
                            </Form.Item>
                            <Form.Item
                                label="Description"
                                name="description"
                            >
                                <Input.TextArea rows={3} placeholder="Short description" />
                            </Form.Item>
                            <Form.Item
                                label="Requirements"
                                name="requirements"
                            >
                                <Input.TextArea rows={2} placeholder="Optional requirements" />
                            </Form.Item>
                        </Form>
                    </Modal>

                    <Modal
                        title="Topic details"
                        open={topicDetailOpen}
                        onCancel={() => setTopicDetailOpen(false)}
                        footer={null}
                        destroyOnHidden
                    >
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            <Text><strong>Title:</strong> {selectedTopic?.title || '-'}</Text>
                            <Text><strong>Author:</strong> {selectedTopic?.author || '-'}</Text>
                            <Text><strong>Status:</strong> {formatTopicStatus(selectedTopic?.rawStatus || selectedTopic?.status)}</Text>
                            <Text><strong>Description:</strong> {selectedTopic?.description || 'No description'}</Text>
                            <Text><strong>Requirements:</strong> {selectedTopic?.requirements || 'No requirements'}</Text>
                            <Text><strong>Created at:</strong> {selectedTopic?.createdAt ? dayjs(selectedTopic.createdAt).format('MMM DD, YYYY HH:mm') : '-'}</Text>
                            <Text><strong>Approved by:</strong> {selectedTopic?.approvedBy || '-'}</Text>
                            <Text><strong>Approved at:</strong> {selectedTopic?.approvedAt ? dayjs(selectedTopic.approvedAt).format('MMM DD, YYYY HH:mm') : '-'}</Text>
                        </Space>
                    </Modal>

                    <Modal
                        title="Create evaluation"
                        open={evaluationOpen}
                        onCancel={() => {
                            setEvaluationOpen(false);
                            evaluationForm.resetFields();
                        }}
                        onOk={handleEvaluationSubmit}
                        okText="Submit"
                        destroyOnHidden
                        forceRender
                    >
                        <Form layout="vertical" form={evaluationForm}>
                            <Form.Item
                                label="Team ID"
                                name="team_id"
                                rules={[{ required: true, message: 'Please enter team id' }]}
                            >
                                <Input placeholder="e.g. 1" />
                            </Form.Item>
                            <Form.Item
                                label="Project ID"
                                name="project_id"
                                rules={[{ required: true, message: 'Please enter project id' }]}
                            >
                                <Input placeholder="e.g. 2" />
                            </Form.Item>
                            <Form.Item
                                label="Score"
                                name="score"
                                rules={[{ required: true, message: 'Please enter score' }]}
                            >
                                <Input placeholder="e.g. 8.5" />
                            </Form.Item>
                            <Form.Item label="Feedback" name="feedback">
                                <Input.TextArea rows={3} placeholder="Optional feedback" />
                            </Form.Item>
                        </Form>
                    </Modal>
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
                destroyOnHidden
                styles={{ body: { paddingTop: 0 } }}
                forceRender
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

export default TopicManagement;
