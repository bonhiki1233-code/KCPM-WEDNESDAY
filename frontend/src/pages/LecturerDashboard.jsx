import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Alert, Layout, Typography, Button, Card, Row, Col, Progress, List,
    Avatar, Space, Badge, Input, Upload, Timeline, Tag, Divider,
    Modal, Form, Select, DatePicker, message, Dropdown, Popover
} from 'antd';
import {
    SettingOutlined, BellOutlined, SearchOutlined, PlusOutlined,
    DashboardOutlined, BookOutlined, CheckSquareOutlined,
    LogoutOutlined, UserOutlined, FilePdfOutlined,
    FileImageOutlined, FileOutlined, ClockCircleOutlined, UploadOutlined,
    MoreOutlined, CheckCircleOutlined, SyncOutlined, PlayCircleOutlined,
    FolderOutlined, CloudUploadOutlined, CalendarOutlined, ProjectOutlined,
    LeftOutlined, RightOutlined, DeleteOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth, resolveRoleName } from '../components/AuthContext';
import { lecturerTopicsService } from '../services/lecturerTopicsService';
import submissionService from '../services/submissionService';
import './StudentDashboard.css';
import './LecturerDashboard.css';

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

const normalizeTopicStatus = (value) => (value ? String(value).toUpperCase() : 'UNKNOWN');

const formatTopicStatus = (value) => {
    const normalized = normalizeTopicStatus(value);
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

const extractErrorMessage = (error, fallback) => {
    if (error?.response?.data?.detail) {
        return error.response.data.detail;
    }
    if (error?.message) {
        return error.message;
    }
    return fallback;
};

const LecturerDashboard = () => {
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
    const projectScrollRef = useRef(null);

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

    const handleProjectWheel = (event) => {
        const container = projectScrollRef.current;
        if (!container) {
            return;
        }
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
            return;
        }
        // Enable horizontal scroll with mouse wheel on vertical movement
        // Note: preventDefault() removed due to passive event listener
        container.scrollLeft += event.deltaY;
    };
    const greetingName = useMemo(() => {
        const fallback = user?.email || 'there';
        const source = profileSnapshot?.name || user?.full_name || fallback;
        const parts = source.trim().split(' ').filter(Boolean);
        return parts.length ? parts[parts.length - 1] : source;
    }, [profileSnapshot?.name, user]);
    const [currentDate, setCurrentDate] = useState(dayjs());
    const [isEventModalOpen, setEventModalOpen] = useState(false);
    const [eventForm] = Form.useForm();
    const [totalFiles, setTotalFiles] = useState(124);
    const [storageUsage, setStorageUsage] = useState(65);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [hoveredNav, setHoveredNav] = useState(null);
    const [topics, setTopics] = useState([]);
    const [topicsLoading, setTopicsLoading] = useState(false);
    const [topicsError, setTopicsError] = useState('');
    const [submissions, setSubmissions] = useState([]);
    const [submissionsLoading, setSubmissionsLoading] = useState(false);
    const [submissionsError, setSubmissionsError] = useState('');
    const [isSubmissionModalOpen, setSubmissionModalOpen] = useState(false);
    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [submissionDetailLoading, setSubmissionDetailLoading] = useState(false);

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
        const rawRole = resolveRoleName(user) || 'Student';
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

    const handleLoadTopics = useCallback(async () => {
        setTopicsLoading(true);
        setTopicsError('');
        try {
            const response = await lecturerTopicsService.listTopics();
            const payload = Array.isArray(response?.data?.topics)
                ? response.data.topics
                : Array.isArray(response?.data)
                    ? response.data
                    : [];
            setTopics(payload);
        } catch (error) {
            if (error?.response?.status === 401) {
                message.error('Session expired. Please sign in again.');
                logout();
                navigate('/login', { replace: true });
                return;
            }
            const errorMessage = extractErrorMessage(error, 'Failed to load topics');
            setTopicsError(errorMessage);
        } finally {
            setTopicsLoading(false);
        }
    }, [logout, navigate]);

    useEffect(() => {
        handleLoadTopics();
    }, [handleLoadTopics]);

    // Auto-refresh topics every 5 seconds to sync with database changes (e.g., when admin approves topics)
    useEffect(() => {
        const refreshInterval = setInterval(() => {
            handleLoadTopics();
        }, 5000); // Refresh every 5 seconds

        return () => clearInterval(refreshInterval);
    }, [handleLoadTopics]);

    const handleLoadSubmissions = useCallback(async () => {
        setSubmissionsLoading(true);
        setSubmissionsError('');
        try {
            const response = await submissionService.getSubmissions({ limit: 20 });
            const payload = Array.isArray(response) ? response : response?.data;
            setSubmissions(Array.isArray(payload) ? payload : []);
        } catch (error) {
            if (error?.response?.status === 401) {
                message.error('Session expired. Please sign in again.');
                logout();
                navigate('/login', { replace: true });
                return;
            }
            const errorMessage = extractErrorMessage(error, 'Failed to load submissions');
            setSubmissionsError(errorMessage);
        } finally {
            setSubmissionsLoading(false);
        }
    }, [logout, navigate]);

    useEffect(() => {
        handleLoadSubmissions();
    }, [handleLoadSubmissions]);

    const handleOpenSubmission = useCallback(async (submissionId) => {
        if (!submissionId) return;
        setSubmissionDetailLoading(true);
        setSubmissionModalOpen(true);
        try {
            const detail = await submissionService.getSubmission(submissionId);
            setSelectedSubmission(detail);
        } catch (error) {
            const errorMessage = extractErrorMessage(error, 'Failed to load submission');
            message.error(errorMessage);
            setSelectedSubmission(null);
        } finally {
            setSubmissionDetailLoading(false);
        }
    }, []);

    const [timelineData, setTimelineData] = useState(roleBasedTimeline);

    useEffect(() => {
        setTimelineData(roleBasedTimeline);
    }, [roleBasedTimeline]);

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

    const topicStats = useMemo(() => {
        const total = topics.length;
        const pending = topics.filter((topic) => {
            const status = normalizeTopicStatus(topic?.status);
            return status === 'DRAFT' || status === 'PENDING';
        }).length;
        const approved = topics.filter((topic) => normalizeTopicStatus(topic?.status) === 'APPROVED').length;
        return [
            { title: 'Total topics', subtitle: String(total), accent: '#EFEFEF', icon: <BookOutlined /> },
            { title: 'Pending topics', subtitle: String(pending), accent: '#EFEFEF', icon: <ClockCircleOutlined /> },
            { title: 'Approved topics', subtitle: String(approved), accent: '#EFEFEF', icon: <CheckCircleOutlined /> },
        ];
    }, [topics]);

    const projects = useMemo(() => (
        topics.slice(0, 12).map((topic) => ({
            title: topic.title || 'Untitled',
            subtitle: formatTopicStatus(topic.status),
            date: topic.created_at ? dayjs(topic.created_at).format('MMM DD YYYY') : '—',
        }))
    ), [topics]);

    const recentActivities = useMemo(() => (
        topics.slice(0, 6).map((topic) => topic.title || 'Untitled topic')
    ), [topics]);

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
        <Layout className="dashboard-layout lecturer-dashboard" style={{ minHeight: '100vh', background: '#f5f5f5' }}>
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

                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32, justifyContent: collapsed ? 'center' : 'flex-start', flexDirection: collapsed ? 'column' : 'row' }}>
                            <Avatar size={collapsed ? 40 : 64} src={avatarUrl} style={{ backgroundColor: '#d9d9d9', marginRight: collapsed ? 0 : 16 }} />
                            {!collapsed && (
                                <div>
                                    <Title level={4} style={{ margin: 0, fontWeight: 'normal' }}>Hi <span style={{ color: '#1890ff' }}>{greetingName}</span>!</Title>
                                    <Text type="secondary">{userRole}</Text>
                                </div>
                            )}
                        </div>

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
                                    icon={<BookOutlined />}
                                    onClick={() => navigate('/topics')}
                                    {...navButtonInteractions('topics')}
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
                                <Button
                                    type="text"
                                    block
                                    icon={<FolderOutlined />}
                                    onClick={() => navigate('/resources')}
                                    {...navButtonInteractions('resources')}
                                >
                                    {!collapsed && "Files & Documents"}
                                </Button>
                            </Space>
                        </div>

                        <div style={{ height: collapsed ? 12 : 200 }} />

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

                <Content className="dashboard-content" style={{
                    marginLeft: collapsed ? '80px' : '240px',
                    marginRight: '300px',
                    padding: '24px',
                    paddingBottom: '12px',
                    background: '#f5f5f5',
                    minHeight: 'auto'
                }}>
                    <Card className="hero-card hero-placeholder dashboard-card" variant="borderless">
                        <div className="hero-content">
                            <div>
                                <Title level={3} className="hero-title">Welcome back, {greetingName}</Title>
                                <Text className="hero-subtitle">Here is a quick overview of your grading queue.</Text>
                            </div>
                        </div>
                    </Card>

                    {topicsError && (
                        <Alert
                            type="error"
                            showIcon
                            message="Unable to load topics"
                            description={topicsError}
                            action={(
                                <Button size="small" onClick={handleLoadTopics}>
                                    Retry
                                </Button>
                            )}
                            style={{ marginBottom: 16 }}
                        />
                    )}

                    <Row gutter={16} className="stats-row">
                        {topicStats.map((stat) => (
                            <Col key={stat.title} xs={24} sm={8}>
                                <Card className="stat-card dashboard-card" variant="borderless">
                                    <div className="stat-content">
                                        <div>
                                            <Text className="stat-title">{stat.title}</Text>
                                            <Text className="stat-subtitle">{stat.subtitle}</Text>
                                        </div>
                                        <div className="stat-icon" style={{ background: stat.accent }}>
                                            {stat.icon}
                                        </div>
                                    </div>
                                </Card>
                            </Col>
                        ))}
                    </Row>

                    <div className="projects-header">
                        <Title level={5} style={{ margin: 0 }}>Your project</Title>
                    </div>

                    <div
                        className="project-scroll"
                        ref={projectScrollRef}
                        tabIndex={0}
                        onWheel={handleProjectWheel}
                    >
                        {topicsLoading && (
                            <Card className="project-card dashboard-card" variant="borderless">
                                <Title level={5} style={{ marginTop: 16 }}>Loading topics...</Title>
                                <Text type="secondary">Please wait</Text>
                                <div className="project-footer">
                                    <Text type="secondary">—</Text>
                                </div>
                            </Card>
                        )}
                        {!topicsLoading && projects.length === 0 && (
                            <Card className="project-card dashboard-card" variant="borderless">
                                <Title level={5} style={{ marginTop: 16 }}>No topics yet</Title>
                                <Text type="secondary">Create a topic to get started</Text>
                                <div className="project-footer">
                                    <Text type="secondary">—</Text>
                                </div>
                            </Card>
                        )}
                        {!topicsLoading && projects.map((project, index) => (
                            <Card key={`${project.title}-${index}`} className="project-card dashboard-card" variant="borderless">
                                <div className="project-thumb" />
                                <Title level={5} style={{ marginTop: 16 }}>{project.title}</Title>
                                <Text type="secondary">{project.subtitle}</Text>
                                <div className="project-footer">
                                    <Text type="secondary">{project.date}</Text>
                                </div>
                            </Card>
                        ))}
                    </div>

                    <div style={{ marginTop: 24 }}>
                        <Title level={5} style={{ marginBottom: 12 }}>Recent submissions</Title>
                        <Card className="dashboard-card" variant="borderless">
                            {submissionsError && (
                                <Alert
                                    type="error"
                                    showIcon
                                    message="Unable to load submissions"
                                    description={submissionsError}
                                    action={(
                                        <Button size="small" onClick={handleLoadSubmissions}>
                                            Retry
                                        </Button>
                                    )}
                                    style={{ marginBottom: 16 }}
                                />
                            )}
                            <List
                                loading={submissionsLoading}
                                dataSource={submissions}
                                locale={{ emptyText: 'No submissions yet' }}
                                renderItem={(item) => {
                                    const submittedAt = item?.submitted_at
                                        ? dayjs(item.submitted_at).format('DD/MM/YYYY HH:mm')
                                        : 'Unknown time';
                                    return (
                                        <List.Item
                                            onClick={() => handleOpenSubmission(item.submission_id)}
                                            style={{ cursor: item.submission_id ? 'pointer' : 'default' }}
                                        >
                                            <List.Item.Meta
                                                title={`Submission #${item.submission_id || '-'} • Checkpoint ${item.checkpoint_id || '-'}`}
                                                description={`Submitted at ${submittedAt}`}
                                            />
                                            <Space>
                                                {item.is_late && <Tag color="orange">Late</Tag>}
                                                {item.has_evaluation && <Tag color="green">Graded</Tag>}
                                            </Space>
                                        </List.Item>
                                    );
                                }}
                            />
                        </Card>
                    </div>

                </Content>

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

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', gap: '4px' }}>
                                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                                    <Text key={day} type="secondary" style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: 4 }}>{day}</Text>
                                ))}

                                {emptyDays.map(i => <div key={`empty-${i}`} style={{ height: '32px' }} />)}

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
                title="Submission details"
                open={isSubmissionModalOpen}
                onCancel={() => {
                    setSubmissionModalOpen(false);
                    setSelectedSubmission(null);
                }}
                footer={null}
                destroyOnHidden
                styles={{ body: { paddingTop: 0 } }}
            >
                {submissionDetailLoading ? (
                    <Text>Loading...</Text>
                ) : selectedSubmission ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                            <Text strong>Submission ID</Text>
                            <div>{selectedSubmission.submission_id}</div>
                        </div>
                        <div>
                            <Text strong>Checkpoint</Text>
                            <div>{selectedSubmission.checkpoint_id}</div>
                        </div>
                        <div>
                            <Text strong>Submitted at</Text>
                            <div>
                                {selectedSubmission.submitted_at
                                    ? dayjs(selectedSubmission.submitted_at).format('DD/MM/YYYY HH:mm')
                                    : 'Unknown'}
                            </div>
                        </div>
                        <div>
                            <Text strong>Content</Text>
                            <div>{selectedSubmission.content || '-'}</div>
                        </div>
                        <div>
                            <Text strong>File URL</Text>
                            <div>
                                {selectedSubmission.file_url ? (
                                    <a
                                        href={selectedSubmission.file_url}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Open file
                                    </a>
                                ) : '-'}
                            </div>
                        </div>
                        {selectedSubmission.is_late && <Tag color="orange">Late</Tag>}
                        {selectedSubmission.evaluation && <Tag color="green">Graded</Tag>}
                    </div>
                ) : (
                    <Text>No submission selected.</Text>
                )}
            </Modal>

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
        </Layout>
    );
};

export default LecturerDashboard;
