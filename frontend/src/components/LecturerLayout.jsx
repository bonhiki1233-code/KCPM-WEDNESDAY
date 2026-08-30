import React, { useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout, Typography, Button, Avatar, Space, Badge, Input, Popover, List, message } from 'antd';
import {
    SettingOutlined,
    BellOutlined,
    SearchOutlined,
    DashboardOutlined,
    DesktopOutlined,
    BookOutlined,
    CheckSquareOutlined,
    LogoutOutlined,
    LeftOutlined,
    RightOutlined,
    CloudUploadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth, resolveRoleName } from './AuthContext';
import '../pages/StudentDashboard.css';
import '../pages/LecturerDashboard.css';

const { Title, Text } = Typography;
const { Header, Sider, Content } = Layout;

const LecturerLayout = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();

    const [collapsed, setCollapsed] = useState(false);
    const [hoveredNav, setHoveredNav] = useState(null);
    const [isNotificationOpen, setNotificationOpen] = useState(false);
    const notificationAnchorRef = useRef(null);
    const [currentDate, setCurrentDate] = useState(dayjs());

    const userRole = useMemo(() => {
        const rawRole = resolveRoleName(user) || 'Lecturer';
        return rawRole
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }, [user]);

    const greetingName = useMemo(() => {
        const fallback = user?.email || 'there';
        const source = user?.full_name || fallback;
        const parts = source.trim().split(' ').filter(Boolean);
        return parts.length ? parts[parts.length - 1] : source;
    }, [user]);

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

    const startDay = currentDate.startOf('month').day();
    const daysInMonth = currentDate.daysInMonth();
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const emptyDays = Array.from({ length: startDay }, (_, i) => i);
    const nextMonth = () => setCurrentDate(currentDate.add(1, 'month'));
    const prevMonth = () => setCurrentDate(currentDate.subtract(1, 'month'));

    const recentActivities = [
        'Topic review queue updated',
        'New mentoring request',
        'Evaluation summary ready',
        'Team progress report'
    ];

    const notificationContent = (
        <div style={{ width: 320 }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Notifications</div>
            <Text type="secondary" style={{ fontSize: 12 }}>No new notifications</Text>
        </div>
    );

    const isActive = (path) => location.pathname === path;

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
                            >
                                <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <span style={hamburgerLineStyle('top')} />
                                    <span style={hamburgerLineStyle('middle')} />
                                    <span style={hamburgerLineStyle('bottom')} />
                                </span>
                            </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32, justifyContent: collapsed ? 'center' : 'flex-start', flexDirection: collapsed ? 'column' : 'row' }}>
                            <Avatar size={collapsed ? 40 : 64} src={user?.avatar_url} style={{ backgroundColor: '#d9d9d9', marginRight: collapsed ? 0 : 16 }} />
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
                                    onClick={() => navigate('/lecturer')}
                                    {...navButtonInteractions('dashboard', { active: isActive('/lecturer') })}
                                >
                                    {!collapsed && "Dashboard"}
                                </Button>
                                <Button
                                    type="text"
                                    block
                                    icon={<BookOutlined />}
                                    onClick={() => navigate('/topics')}
                                    {...navButtonInteractions('topics', { active: isActive('/topics') })}
                                >
                                    {!collapsed && "Topic management"}
                                </Button>
                                <Button
                                    type="text"
                                    block
                                    icon={<CloudUploadOutlined />}
                                    onClick={() => navigate('/mentoring')}
                                    {...navButtonInteractions('mentoring', { active: isActive('/mentoring') })}
                                >
                                    {!collapsed && "AI Mentoring"}
                                </Button>
                                <Button
                                    type="text"
                                    block
                                    icon={<CheckSquareOutlined />}
                                    onClick={() => navigate('/evaluations')}
                                    {...navButtonInteractions('grading', { active: isActive('/evaluations') })}
                                >
                                    {!collapsed && "Grading & Feedback"}
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
                    {children}
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
                                    <Button size="small" type="text" icon={<LeftOutlined />} onClick={prevMonth} style={{ border: '1px solid #d9d9d9' }} />
                                    <Button size="small" type="text" icon={<RightOutlined />} onClick={nextMonth} style={{ border: '1px solid #d9d9d9' }} />
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
                                        <div key={day} className={`calendar-day${isToday ? ' calendar-day--today' : ''}`}>
                                            {day}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div style={{ marginBottom: 24 }}>
                            <Title level={5} style={{ marginBottom: 12 }}>Recent activities</Title>
                            <div style={{ background: '#f5f5f5', borderRadius: 12, padding: '16px', minHeight: 150 }}>
                                <List
                                    dataSource={recentActivities}
                                    renderItem={item => (
                                        <List.Item className="recent-activity-item">
                                            <Typography.Text style={{ fontSize: '14px' }}>{item}</Typography.Text>
                                        </List.Item>
                                    )}
                                />
                            </div>
                            <div style={{ textAlign: 'right', marginTop: 8 }}>
                                <Text className="recent-activity-cta">see more</Text>
                            </div>
                        </div>
                    </div>
                </Sider>
            </Layout>
        </Layout>
    );
};

export default LecturerLayout;
