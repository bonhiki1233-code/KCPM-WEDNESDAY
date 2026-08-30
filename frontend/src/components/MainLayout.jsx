import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout, Typography, Button, Avatar, Space, Badge, Input, message, Divider, List, Tag, Popover } from 'antd';
import {
    SettingOutlined, BellOutlined, SearchOutlined,
    DashboardOutlined, TeamOutlined, DesktopOutlined, TableOutlined,
    FileTextOutlined, VideoCameraOutlined, SendOutlined, FormOutlined, MessageOutlined,
    LogoutOutlined, LeftOutlined, RightOutlined, FolderOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth, resolveRoleName } from './AuthContext';
import '../pages/StudentDashboard.css'; // Reuse existing styles

const { Title, Text } = Typography;
const { Header, Sider, Content } = Layout;

const MainLayout = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const [collapsed, setCollapsed] = useState(false);
    const [isNotificationOpen, setNotificationOpen] = useState(false);
    const notificationAnchorRef = useRef(null);
    const [currentDate, setCurrentDate] = useState(dayjs());
    const [hoveredNav, setHoveredNav] = useState(null);

    // Helpers
    const userRole = useMemo(() => {
        const rawRole = resolveRoleName(user) || 'Student';
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

    // Navigation Logic
    const isActive = (path) => location.pathname === path;

    const navButtonStyles = (key, path, { danger } = {}) => ({
        textAlign: collapsed ? 'center' : 'left',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 8,
        padding: collapsed ? '8px 0' : '8px 12px',
        color: danger ? '#d4380d' : isActive(path) ? '#1890ff' : '#595959',
        fontWeight: isActive(path) ? 600 : 500,
        backgroundColor: hoveredNav === key ? 'rgba(24, 144, 255, 0.08)' : 'transparent',
        transform: hoveredNav === key && !collapsed ? 'translateX(2px)' : 'none',
        transition: 'all 0.2s ease',
        cursor: 'pointer'
    });

    const hamburgerLineStyle = (position) => {
        const base = {
            width: 18, height: 2, backgroundColor: '#262626', display: 'block', borderRadius: 2, transition: 'transform 0.3s ease, opacity 0.3s ease'
        };
        if (collapsed) {
            if (position === 'middle') return { ...base, opacity: 1 };
            return { ...base, transform: 'translateY(0) rotate(0)' };
        }
        if (position === 'top') return { ...base, transform: 'translateY(6px) rotate(45deg)' };
        if (position === 'middle') return { ...base, opacity: 0 };
        return { ...base, transform: 'translateY(-6px) rotate(-45deg)' };
    };

    // Calendar
    const startDay = currentDate.startOf('month').day();
    const daysInMonth = currentDate.daysInMonth();
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const emptyDays = Array.from({ length: startDay }, (_, i) => i);
    const nextMonth = () => setCurrentDate(currentDate.add(1, 'month'));
    const prevMonth = () => setCurrentDate(currentDate.subtract(1, 'month'));

    // Recent Activity (Static for look-and-feel)
    const recentActivities = [
        'Smart Inventory System', 'AI Health Monitor', 'Smart Campus App', 'Drone Delivery'
    ];

    const notificationContent = (
        <div style={{ width: 320 }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Notifications</div>
            <Divider style={{ margin: '0 0 12px' }} />
            <Text type="secondary" style={{ fontSize: 12 }}>No new notifications</Text>
        </div>
    );

    return (
        <Layout className="dashboard-layout" style={{ minHeight: '100vh', background: '#f5f5f5' }}>
            <Header className="dashboard-header" style={{
                position: 'fixed', top: 0, zIndex: 1000, width: '100%', background: '#fff',
                display: 'flex', justifyContent: 'space-between', padding: '0 24px',
                borderBottom: '1px solid #f0f0f0', height: '64px', lineHeight: '64px'
            }}>
                <Space size="large">
                    <Avatar size="small" style={{ backgroundColor: '#1890ff' }}>C</Avatar>
                    <Text strong style={{ fontSize: '16px' }}>CollabSphere</Text>
                </Space>
                <Space size="large">
                    <Popover content={notificationContent} trigger="click" placement="bottomRight">
                        <Badge dot offset={[-5, 5]}>
                            <BellOutlined style={{ fontSize: 20, color: '#000', cursor: 'pointer' }} />
                        </Badge>
                    </Popover>
                    <Input placeholder="Search..." prefix={<SearchOutlined />} style={{ width: 200, borderRadius: '6px' }} />
                </Space>
            </Header>

            <Layout style={{ marginTop: '64px', height: 'calc(100vh - 64px)', background: '#f5f5f5' }}>
                <Sider
                    className="dashboard-sider" width={240} theme="light"
                    style={{
                        borderRight: '1px solid #f0f0f0', height: 'calc(100vh - 64px)', overflowY: 'auto',
                        position: 'fixed', left: 0, top: '64px', background: '#ffffff',
                        boxShadow: '6px 0 18px rgba(15, 18, 21, 0.04)'
                    }}
                    collapsible collapsed={collapsed} trigger={null}
                >
                    <div style={{ padding: collapsed ? '24px 8px' : '24px 24px 0', display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ marginBottom: 24, paddingLeft: collapsed ? 12 : 0 }}>
                            <button onClick={() => setCollapsed(!collapsed)} style={{ border: '1px solid #f0f0f0', borderRadius: 12, width: 40, height: 36, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                                <div style={navButtonStyles('dashboard', '/student')} onClick={() => navigate('/student')} onMouseEnter={() => setHoveredNav('dashboard')} onMouseLeave={() => setHoveredNav(null)}>
                                    <DashboardOutlined /> {!collapsed && <span style={{ marginLeft: 10 }}>Dashboard</span>}
                                </div>
                                <div style={navButtonStyles('team', '/teams')} onClick={() => navigate('/teams')} onMouseEnter={() => setHoveredNav('team')} onMouseLeave={() => setHoveredNav(null)}>
                                    <TeamOutlined /> {!collapsed && <span style={{ marginLeft: 10 }}>Team Management</span>}
                                </div>
                                <div style={navButtonStyles('chat', '/chat')} onClick={() => navigate('/chat')} onMouseEnter={() => setHoveredNav('chat')} onMouseLeave={() => setHoveredNav(null)}>
                                    <MessageOutlined /> {!collapsed && <span style={{ marginLeft: 10 }}>Team Chat</span>}
                                </div>
                                <div style={navButtonStyles('kanban', '/kanban')} onClick={() => navigate('/kanban')} onMouseEnter={() => setHoveredNav('kanban')} onMouseLeave={() => setHoveredNav(null)}>
                                    <TableOutlined /> {!collapsed && <span style={{ marginLeft: 10 }}>Kanban Board Detail</span>}
                                </div>
                                <div style={navButtonStyles('video', '/video')} onClick={() => navigate('/video')} onMouseEnter={() => setHoveredNav('video')} onMouseLeave={() => setHoveredNav(null)}>
                                    <VideoCameraOutlined /> {!collapsed && <span style={{ marginLeft: 10 }}>Video Meeting Room</span>}
                                </div>
                                <div style={navButtonStyles('submission', '/submission')} onClick={() => navigate('/submission')} onMouseEnter={() => setHoveredNav('submission')} onMouseLeave={() => setHoveredNav(null)}>
                                    <SendOutlined /> {!collapsed && <span style={{ marginLeft: 10 }}>Submission Portal</span>}
                                </div>
                                <div style={navButtonStyles('peer', '/peer-review')} onClick={() => navigate('/peer-review')} onMouseEnter={() => setHoveredNav('peer')} onMouseLeave={() => setHoveredNav(null)}>
                                    <FileTextOutlined /> {!collapsed && <span style={{ marginLeft: 10 }}>Peer Review Form</span>}
                                </div>
                                <div style={navButtonStyles('resources', '/resources')} onClick={() => navigate('/resources')} onMouseEnter={() => setHoveredNav('resources')} onMouseLeave={() => setHoveredNav(null)}>
                                    <FolderOutlined /> {!collapsed && <span style={{ marginLeft: 10 }}>Files & Documents</span>}
                                </div>
                            </Space>
                        </div>

                        <div style={{ marginTop: 'auto', paddingBottom: 24 }}>
                            {!collapsed && <Text strong style={{ color: '#1890ff', fontSize: '12px', letterSpacing: '1px' }}>SETTINGS</Text>}
                            <Space direction="vertical" style={{ width: '100%', marginTop: 16 }} size={8}>
                                <div style={navButtonStyles('profile', '/profile')} onClick={() => navigate('/profile')} onMouseEnter={() => setHoveredNav('profile')} onMouseLeave={() => setHoveredNav(null)}>
                                    <SettingOutlined /> {!collapsed && <span style={{ marginLeft: 10 }}>Settings</span>}
                                </div>
                                <div style={navButtonStyles('logout', '#', { danger: true })} onClick={logout} onMouseEnter={() => setHoveredNav('logout')} onMouseLeave={() => setHoveredNav(null)}>
                                    <LogoutOutlined /> {!collapsed && <span style={{ marginLeft: 10 }}>Logout</span>}
                                </div>
                            </Space>
                        </div>
                    </div>
                </Sider>

                <Content className="dashboard-content" style={{
                    marginLeft: collapsed ? '80px' : '240px',
                    marginRight: '300px',
                    padding: '24px',
                    background: '#f5f5f5',
                    minHeight: 'calc(100vh - 64px)',
                    overflowY: 'auto'
                }}>
                    {children}
                </Content>

                <Sider
                    className="dashboard-sider dashboard-sider--right"
                    width={300} theme="light"
                    style={{
                        position: 'fixed', right: 0, top: '64px', height: 'calc(100vh - 64px)',
                        overflow: 'auto', borderLeft: '1px solid #f0f0f0', background: '#fff', padding: '24px'
                    }}
                >
                    {/* Calendar */}
                    <div style={{ background: '#fff', borderRadius: 12, padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text strong style={{ fontSize: '16px' }}>{currentDate.format('MMMM YYYY')}</Text>
                            <Space>
                                <Button size="small" type="text" icon={<LeftOutlined />} onClick={prevMonth} />
                                <Button size="small" type="text" icon={<RightOutlined />} onClick={nextMonth} />
                            </Space>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', gap: '4px' }}>
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <Text key={d} type="secondary" style={{ fontSize: 12, fontWeight: 'bold' }}>{d}</Text>)}
                            {emptyDays.map(i => <div key={`empty-${i}`} />)}
                            {daysArray.map(day => {
                                const isToday = day === dayjs().date() && currentDate.isSame(dayjs(), 'month');
                                return <div key={day} className={`calendar-day${isToday ? ' calendar-day--today' : ''}`}>{day}</div>;
                            })}
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div style={{ marginBottom: 24 }}>
                        <Title level={5} style={{ marginBottom: 12 }}>Recent activities</Title>
                        <div style={{ background: '#f5f5f5', borderRadius: 12, padding: '16px' }}>
                            <List dataSource={recentActivities} renderItem={item => (
                                <List.Item style={{ padding: '8px 0', borderBottom: '1px solid #e8e8e8' }}>
                                    <Text style={{ fontSize: '14px' }}>{item}</Text>
                                </List.Item>
                            )} />
                        </div>
                    </div>
                </Sider>
            </Layout>
        </Layout>
    );
};

export default MainLayout;
